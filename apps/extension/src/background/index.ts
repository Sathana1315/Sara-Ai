import { BehaviorEvent } from '@sara/shared';
import { getStoredSession, signInWithGoogle, signOut, storeSession, isAuthFlowInProgress, resetAuthFlowLock } from '../auth/auth';

const BACKEND_URL = 'http://localhost:3001';

// Bounded in-memory offline queue — max 50 events stored while offline
let offlineEventQueue: any[] = [];
const MAX_QUEUE_SIZE = 50;

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SARA Extension Service Worker] Installed & active.');
  chrome.storage.local.set({ sara_today_events: 0, sara_today_date: new Date().toDateString() });
});

/**
 * Service worker startup — fires when Chrome reactivates the SW.
 * Reads persisted session from chrome.storage.local and broadcasts
 * auth state to all already-open tabs (their content scripts may be waiting).
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[SARA Background] Service worker startup — restoring session.');
  await broadcastAuthStateChanged();
});

// Also broadcast on first activation (covers extension install/update/reload)
// Using a small delay to let content scripts initialize first
setTimeout(async () => {
  console.log('[SARA Background] Initial auth state broadcast.');
  await broadcastAuthStateChanged();
}, 500);

/**
 * Increments the daily event counter in chrome.storage.local.
 * Resets the counter if the date has changed.
 */
async function incrementDailyEventCount(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['sara_today_events', 'sara_today_date'], (result) => {
      const today = new Date().toDateString();
      if (result.sara_today_date !== today) {
        chrome.storage.local.set({ sara_today_events: 1, sara_today_date: today }, resolve);
      } else {
        chrome.storage.local.set({ sara_today_events: (result.sara_today_events || 0) + 1 }, resolve);
      }
    });
  });
}

/**
 * Broadcasts auth status changes to all open tabs and extension views.
 */
async function broadcastAuthStateChanged(): Promise<void> {
  const authStatus = await getAuthStatus();

  // Notify extension runtime views (e.g. Popup) if open
  try {
    chrome.runtime.sendMessage({
      type: 'SARA_AUTH_STATE_CHANGED',
      payload: authStatus
    }).catch(() => {});
  } catch {
    // Suppress error if no extension view is open
  }

  // Notify all open web page tabs (content scripts / floating overlay)
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SARA_AUTH_STATE_CHANGED',
          payload: authStatus
        }).catch(() => {
          // Ignore tabs without content scripts
        });
      }
    }
  });
}

/**
 * Message listener — receives safe messages from content scripts and overlay.
 * Auth state is managed HERE in the trusted background context.
 * Content scripts never receive tokens — only safe payloads.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'SARA_INGEST_EVENT':
      handleIngestEvent(message.payload).then(sendResponse);
      return true;

    case 'SARA_GET_RECOMMENDATIONS':
      fetchRecommendations(message.domain).then(sendResponse);
      return true;

    case 'SARA_SUBMIT_FEEDBACK':
      submitFeedback(message.payload).then(sendResponse);
      return true;

    case 'SARA_SIGN_IN':
      // Initiates Google OAuth flow from background (trusted context)
      signInWithGoogle().then(async (res) => {
        if (res.success) {
          await broadcastAuthStateChanged();
        }
        sendResponse(res);
      });
      return true;

    case 'SARA_SIGN_OUT':
      signOut().then(async () => {
        await broadcastAuthStateChanged();
        sendResponse({ success: true });
      });
      return true;

    case 'SARA_GET_AUTH_STATUS':
      getAuthStatus().then(sendResponse);
      return true;

    case 'SARA_DEBUG_AUTH_STORAGE':
      getDebugAuthStorage().then(sendResponse);
      return true;

    case 'SARA_DEBUG_AUTH_FLOW_STATUS':
      sendResponse({ authFlowInProgress: isAuthFlowInProgress() });
      return true;

    case 'SARA_DEBUG_RESET_AUTH_FLOW':
      resetAuthFlowLock();
      sendResponse({ success: true, authFlowInProgress: false });
      return true;
  }
});

/**
 * Diagnostic helper — returns storage status without exposing raw tokens.
 */
async function getDebugAuthStorage(): Promise<{
  exists: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  expiresAt: number | null;
  expired: boolean;
  userEmail: string | null;
}> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['sara_auth_session'], (result) => {
      const session = result.sara_auth_session;
      if (!session) {
        resolve({
          exists: false,
          hasAccessToken: false,
          hasRefreshToken: false,
          expiresAt: null,
          expired: false,
          userEmail: null
        });
        return;
      }
      const fiveMinutes = 5 * 60 * 1000;
      const expired = session.expiresAt ? (Date.now() > session.expiresAt - fiveMinutes) : false;
      resolve({
        exists: true,
        hasAccessToken: !!session.accessToken,
        hasRefreshToken: !!session.refreshToken,
        expiresAt: session.expiresAt || null,
        expired,
        userEmail: session.saraUser?.email || null
      });
    });
  });
}

/**
 * Returns auth status — safe to send to content scripts.
 * NEVER includes the access token in this response.
 * Returns 'authenticated=true' ONLY if session exists AND is not expired.
 */
async function getAuthStatus(): Promise<{ authenticated: boolean; userDisplayName: string | null; userAvatarUrl: string | null }> {
  const session = await getStoredSession();
  // getStoredSession() already clears expired sessions internally.
  // If it returns non-null, the session is valid.
  const isAuthenticated = !!session;

  console.log('[SARA Auth Debug]', {
    sessionExists: isAuthenticated,
    userEmail: session?.saraUser?.email || null,
    authenticatedResult: isAuthenticated
  });

  if (!isAuthenticated) {
    return { authenticated: false, userDisplayName: null, userAvatarUrl: null };
  }
  return {
    authenticated: true,
    userDisplayName: session!.saraUser?.fullName || session!.saraUser?.email || 'SARA User',
    userAvatarUrl: session!.saraUser?.avatarUrl || null
  };
}

let lastIngestedUrl = '';
let lastIngestedTime = 0;

async function getStoredQueue(): Promise<any[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['sara_offline_queue'], (result) => {
      resolve(result.sara_offline_queue || []);
    });
  });
}

async function saveStoredQueue(queue: any[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ sara_offline_queue: queue.slice(-MAX_QUEUE_SIZE) }, resolve);
  });
}

/**
 * Ingests a behavior event to the backend.
 * Attaches the Bearer token from stored session.
 * If backend is unreachable, queues the event for later retry in chrome.storage.local.
 */
async function handleIngestEvent(payload: any): Promise<{ success: boolean; queued?: boolean; error?: string; data?: any; message?: string }> {
  // Simple deduplication for rapid duplicate events on the same URL (within 2 seconds)
  const now = Date.now();
  if (payload.url === lastIngestedUrl && (now - lastIngestedTime) < 2000 && !payload.pageMeta?.eventType) {
    return { success: true, message: 'Duplicate event suppressed' } as any;
  }
  lastIngestedUrl = payload.url;
  lastIngestedTime = now;

  const session = await getStoredSession();
  if (!session) {
    return { success: false, error: 'Not authenticated. Sign in to enable SARA.' };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/events/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[SARA] Event ingested: ${payload.title || payload.url} (Adapter: ${data.adapterUsed || 'OK'})`);
      await incrementDailyEventCount();
      await flushOfflineQueue(session.accessToken);
      return { success: true, data };
    } else if (response.status === 401) {
      console.warn('[SARA Background] Token rejected (401). Clearing session.');
      await signOut();
      await broadcastAuthStateChanged();
      return { success: false, error: 'Session expired. Please sign in again.' };
    } else {
      await queueOfflineEvent(payload);
      return { success: false, queued: true };
    }
  } catch (err: any) {
    console.warn('[SARA Background] Ingest unreachable, queuing event offline:', err.message);
    await queueOfflineEvent(payload);
    return { success: false, queued: true };
  }
}

async function queueOfflineEvent(payload: any) {
  const queue = await getStoredQueue();
  if (queue.length < MAX_QUEUE_SIZE) {
    queue.push(payload);
    await saveStoredQueue(queue);
    console.log(`[SARA] Queued event offline (${queue.length}/${MAX_QUEUE_SIZE})`);
  }
}

/**
 * Fetches current-site recommendations from the backend.
 */
async function fetchRecommendations(domain?: string): Promise<{ success: boolean; recommendations: any[]; authenticated: boolean }> {
  const session = await getStoredSession();
  if (!session) {
    return { success: false, recommendations: [], authenticated: false };
  }

  try {
    const url = new URL(`${BACKEND_URL}/api/recommendations`);
    url.searchParams.append('context', 'current_site');
    if (domain) url.searchParams.append('domain', domain);

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${session.accessToken}` }
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, recommendations: data.recommendations || [], authenticated: true };
    } else if (response.status === 401) {
      await signOut();
      await broadcastAuthStateChanged();
      return { success: false, recommendations: [], authenticated: false };
    }

    return { success: false, recommendations: [], authenticated: true };
  } catch {
    return { success: false, recommendations: [], authenticated: true };
  }
}

/**
 * Submits explicit feedback (like/dislike/skip) for a recommendation item.
 */
async function submitFeedback(payload: { recommendationId: string; feedbackType: string }): Promise<{ success: boolean; error?: string }> {
  const session = await getStoredSession();
  if (!session) {
    return { success: false, error: 'Not authenticated.' };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return { success: true };
    }
    return { success: false, error: 'Failed to submit feedback' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Flushes queued offline events to the backend once connectivity is restored.
 */
async function flushOfflineQueue(accessToken: string): Promise<void> {
  const queue = await getStoredQueue();
  if (queue.length === 0) return;
  console.log(`[SARA Background] Flushing ${queue.length} queued offline events.`);

  const remaining: any[] = [];
  for (const payload of queue) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/events/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) remaining.push(payload);
    } catch {
      remaining.push(payload);
    }
  }

  await saveStoredQueue(remaining);
  if (remaining.length === 0) {
    console.log('[SARA Background] Offline queue successfully flushed.');
  }
}
