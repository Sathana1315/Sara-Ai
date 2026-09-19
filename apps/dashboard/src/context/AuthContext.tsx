import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import type { SaraUser, AuthState } from '@sara/shared';

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** The raw Supabase auth session — used internally for token forwarding to backend */
  session: Session | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider — wraps the dashboard to provide authentication state globally.
 *
 * Flow:
 *   Supabase Auth session resolved on mount
 *     → auth.users identity verified
 *     → public.users SARA profile fetched
 *     → AuthState updated to 'authenticated'
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    status: 'loading',
    accessToken: null,
    saraUser: null
  });
  const [session, setSession] = useState<Session | null>(null);

  const resolveProfile = useCallback(async (authUser: User, token: string) => {
    try {
      // Fetch the SARA application profile linked to this auth identity
      const { data: profile, error } = await supabase
        .from('users')
        .select('id, email, full_name, avatar_url, created_at, updated_at, auth_user_id')
        .eq('auth_user_id', authUser.id)
        .single();

      if (error || !profile) {
        // Profile not yet provisioned (trigger may not have fired)
        // This should auto-provision on the backend when the first authenticated API call is made
        setAuthState({
          status: 'authenticated',
          accessToken: token,
          saraUser: null
        });
        return;
      }

      const saraUser: SaraUser = {
        id: profile.id,
        authUserId: profile.auth_user_id,
        email: profile.email || authUser.email || '',
        fullName: profile.full_name || authUser.user_metadata?.full_name || '',
        avatarUrl: profile.avatar_url || authUser.user_metadata?.avatar_url || '',
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      };

      setAuthState({
        status: 'authenticated',
        accessToken: token,
        saraUser
      });
    } catch {
      setAuthState({ status: 'unauthenticated', accessToken: null, saraUser: null });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Get initial session on mount
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!isMounted) return;
        if (initialSession) {
          setSession(initialSession);
          resolveProfile(initialSession.user, initialSession.access_token);
        } else {
          setAuthState({ status: 'unauthenticated', accessToken: null, saraUser: null });
        }
      })
      .catch((err) => {
        console.warn('[SARA Auth] getSession error, defaulting to unauthenticated:', err);
        if (isMounted) {
          setAuthState({ status: 'unauthenticated', accessToken: null, saraUser: null });
        }
      });

    // 2. Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (newSession) {
        resolveProfile(newSession.user, newSession.access_token);
      } else {
        setAuthState({ status: 'unauthenticated', accessToken: null, saraUser: null });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [resolveProfile]);

  /**
   * Initiates Google OAuth sign-in via Supabase Auth.
   * Redirects to Google → returns to the dashboard origin (PKCE flow).
   *
   * REQUIRES USER ACTION: Google OAuth Client ID must be configured in:
   * - Google Cloud Console → OAuth 2.0 Clients
   * - Supabase Dashboard → Authentication → Providers → Google
   *
   * Redirect URI for dashboard: http://localhost:3000 (dev) / your production URL (prod)
   */
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',  // Request refresh token
          prompt: 'select_account'  // Allow switching accounts
        }
      }
    });

    if (error) {
      console.error('Google sign-in error:', error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthState({ status: 'unauthenticated', accessToken: null, saraUser: null });
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, session, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook for consuming the SARA auth context in dashboard components.
 */
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
