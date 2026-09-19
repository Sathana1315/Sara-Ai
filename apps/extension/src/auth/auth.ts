/**
 * SARA Extension Auth Module
 *
 * Chrome Extension Authentication Architecture:
 *
 * Flow:
 *   User clicks "Sign in with Google" in extension popup/overlay
 *     ↓
 *   Background service worker calls supabase.auth.signInWithOAuth() + chrome.identity.launchWebAuthFlow
 *   pointing to Supabase's Google OAuth URL
 *     ↓
 *   User authenticates with Google
 *     ↓
 *   Supabase returns access_token + refresh_token in the redirect URL hash/query
 *     ↓
 *   Background service worker extracts tokens from redirect URL
 *     ↓
 *   Tokens stored in chrome.storage.local (trusted extension context only)
 *     ↓
 *   Content scripts communicate through safe chrome.runtime.sendMessage
 *   (tokens are NEVER passed to content scripts directly)
 *     ↓
 *   All API requests from background include Authorization: Bearer <token>
 */

import { createClient } from '@supabase/supabase-js';
import type { AuthSession, SaraUser } from '@sara/shared';

const SUPABASE_URL = 'https://xloherpfgrrkgegdxipx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_UVoJ0YHaACT9mIKf0ABxtw_4PNNeQSA';
const BACKEND_URL = 'http://localhost:3001';

const STORAGE_KEY_SESSION = 'sara_auth_session';

/**
 * Extension Supabase Client.
 * Configured explicitly for implicit flow without auto-refreshing or web localStorage session persistence.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    flowType: 'implicit',
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

let authFlowInProgress = false;

export function isAuthFlowInProgress(): boolean {
  return authFlowInProgress;
}

export function resetAuthFlowLock(): void {
  authFlowInProgress = false;
}

/**
 * Retrieves the current stored auth session from chrome.storage.local.
 * Returns null if no session exists or if it has expired.
 */
export async function getStoredSession(): Promise<AuthSession | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_SESSION);
    const session: AuthSession = result[STORAGE_KEY_SESSION];
    if (!session) return null;

    // Check expiry — if within 5 minutes of expiry, treat as expired
    const fiveMinutes = 5 * 60 * 1000;
    if (session.expiresAt && Date.now() > session.expiresAt - fiveMinutes) {
      console.log('[SARA Auth] Session expired or near expiry — clearing.');
      await clearStoredSession();
      return null;
    }

    return session;
  } catch (err) {
    console.error('[SARA Auth] Failed to retrieve session:', err);
    return null;
  }
}

/**
 * Stores an authenticated session in chrome.storage.local.
 * Only called from the background service worker after successful OAuth.
 */
export async function storeSession(session: AuthSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_SESSION]: session });
}

/**
 * Clears the stored session on sign-out or expiry.
 */
export async function clearStoredSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY_SESSION);
}

/**
 * Initiates Google OAuth via Supabase client & chrome.identity.launchWebAuthFlow.
 */
export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  if (authFlowInProgress) {
    console.warn('[SARA OAuth] signInWithGoogle rejected: lock acquired by another request.');
    return { success: false, error: 'Sign-in is already in progress. Please wait.' };
  }

  authFlowInProgress = true;
  console.log('[SARA OAuth] START');
  console.log('[SARA OAuth] LOCK_ACQUIRED');

  try {
    const redirectUri = chrome.identity.getRedirectURL();
    console.log('[SARA OAuth] REDIRECT_URL:', redirectUri);

    const { data, error: oauthUrlErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true
      }
    });

    if (oauthUrlErr || !data?.url) {
      const errMsg = oauthUrlErr?.message || 'Failed to generate OAuth URL';
      console.error('[SARA OAuth] FAILED_AT: SUPABASE_OAUTH_URL_CREATION', errMsg);
      return { success: false, error: errMsg };
    }

    console.log('[SARA OAuth] SUPABASE_OAUTH_URL_CREATED');
    console.log('[SARA OAuth] LAUNCHING_WEB_AUTH_FLOW');

    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: data.url, interactive: true },
        (callbackUrl) => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || 'Unknown OAuth launch error';
            console.warn('[SARA OAuth] CHROME_ERROR:', msg);
            reject(new Error(msg));
          } else if (callbackUrl) {
            resolve(callbackUrl);
          } else {
            reject(new Error('OAuth window closed before callback was received.'));
          }
        }
      );
    });

    console.log('[SARA OAuth] CALLBACK_RECEIVED');

    let callbackOrigin = '';
    try {
      callbackOrigin = new URL(responseUrl).origin;
    } catch {}
    console.log('[SARA OAuth] CALLBACK_ORIGIN:', callbackOrigin);

    const urlObj = new URL(responseUrl);
    const searchParams = urlObj.searchParams;
    const hashFragment = responseUrl.includes('#') ? responseUrl.split('#')[1] : '';
    const hashParams = new URLSearchParams(hashFragment);

    const paramNames = Array.from(new Set([...hashParams.keys(), ...searchParams.keys()]));
    console.log('[SARA OAuth] CALLBACK_PARAMETER_NAMES:', paramNames.join(', '));

    const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
    const rawExpiresIn = hashParams.get('expires_in') || searchParams.get('expires_in') || '3600';
    let expiresIn = parseInt(rawExpiresIn, 10);
    if (isNaN(expiresIn) || expiresIn <= 0) expiresIn = 3600;

    console.log('[SARA OAuth] ACCESS_TOKEN_PRESENT:', !!accessToken);
    console.log('[SARA OAuth] REFRESH_TOKEN_PRESENT:', !!refreshToken);

    if (!accessToken) {
      const authErr = hashParams.get('error_description') || hashParams.get('error') || searchParams.get('error') || 'No access token in callback';
      console.error('[SARA OAuth] FAILED_AT: TOKEN_PARSING', authErr);
      return { success: false, error: `Authentication failed: ${authErr}` };
    }

    console.log('[SARA OAuth] PROFILE_REQUEST_STARTED');
    const profileRes = await fetch(`${BACKEND_URL}/api/user/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('[SARA OAuth] PROFILE_RESPONSE:', profileRes.status);

    if (!profileRes.ok) {
      console.error('[SARA OAuth] FAILED_AT: PROFILE_RESOLUTION');
      return { success: false, error: 'Failed to resolve SARA profile after authentication.' };
    }

    const profileData = await profileRes.json();
    const profile = profileData.profile;

    const saraUser: SaraUser = {
      id: profile.id,
      authUserId: profile.authUserId,
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };

    const session: AuthSession = {
      accessToken,
      refreshToken: refreshToken || '',
      expiresAt: Date.now() + expiresIn * 1000,
      saraUser
    };

    console.log('[SARA OAuth] SESSION_STORAGE_STARTED');
    await storeSession(session);
    console.log('[SARA OAuth] SESSION_STORAGE_COMPLETE');
    console.log('[SARA OAuth] AUTH_SUCCESS');
    return { success: true };
  } catch (err: any) {
    const rawMsg = err.message || '';
    console.error('[SARA OAuth] signInWithGoogle failed:', rawMsg);

    if (rawMsg.includes('did not approve access') || rawMsg.includes('user canceled') || rawMsg.includes('User canceled') || rawMsg.includes('window closed')) {
      return { success: false, error: 'Sign-in was cancelled or window closed before authentication was completed.' };
    }
    if (rawMsg.includes('Only one web auth flow')) {
      return { success: false, error: 'Sign-in is already in progress. Please wait.' };
    }
    return { success: false, error: `Sign-in failed: ${rawMsg}` };
  } finally {
    authFlowInProgress = false;
    console.log('[SARA OAuth] LOCK_RELEASED');
  }
}

/**
 * Signs out the current user by clearing local storage.
 */
export async function signOut(): Promise<void> {
  await clearStoredSession();
  console.log('[SARA Auth] User signed out.');
}
