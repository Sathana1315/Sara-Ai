import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * SARA Floating Overlay UI (injected into web pages via Shadow DOM)
 *
 * Authentication flow in this component:
 * - Queries background service worker for auth status (NEVER holds tokens)
 * - Shows sign-in prompt only if background explicitly confirms unauthenticated
 * - Shows spinner while auth state is 'unknown' (initial startup)
 * - Auth state: 'unknown' | 'authenticated' | 'unauthenticated'
 */
export const SaraOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 'unknown' means we haven't received a response from background yet.
  // We NEVER show the sign-in prompt while state is 'unknown'.
  const [authState, setAuthState] = useState<'unknown' | 'authenticated' | 'unauthenticated'>('unknown');
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const domain = window.location.hostname;
  const isChromeExt = typeof chrome !== 'undefined' && !!chrome.runtime?.sendMessage;

  /**
   * Sends SARA_GET_AUTH_STATUS to background with retry on undefined response.
   * Undefined response means the service worker is still waking up.
   * Retries up to 6 times with 600ms spacing.
   */
  const checkAuthStatus = useCallback(() => {
    if (!isChromeExt) {
      setAuthState('unauthenticated');
      return;
    }

    function attempt() {
      // Clear any last error before sending
      try {
        chrome.runtime.sendMessage({ type: 'SARA_GET_AUTH_STATUS' }, (response) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) {
            // Service worker is likely still starting up
            console.warn('[SARA Overlay] GET_AUTH_STATUS error:', lastErr.message, '— retrying…');
          }

          if (response && typeof response.authenticated === 'boolean') {
            // Got a definitive answer from background
            retryCountRef.current = 0;
            console.log('[SARA Overlay] Auth confirmed:', response.authenticated, response.userDisplayName);
            if (response.authenticated) {
              setAuthState('authenticated');
              setUserDisplayName(response.userDisplayName ?? null);
              setUserAvatarUrl(response.userAvatarUrl ?? null);
            } else {
              setAuthState('unauthenticated');
            }
          } else {
            // No response — service worker starting up. Retry with backoff.
            retryCountRef.current += 1;
            if (retryCountRef.current <= 6) {
              const delay = retryCountRef.current * 600;
              console.log(`[SARA Overlay] No response from background, retry ${retryCountRef.current} in ${delay}ms…`);
              retryTimerRef.current = setTimeout(attempt, delay);
            } else {
              // After 6 retries (~2.5s total), give up and show unauthenticated
              console.warn('[SARA Overlay] Background unresponsive after retries — showing sign-in.');
              setAuthState('unauthenticated');
            }
          }
        });
      } catch (err) {
        console.warn('[SARA Overlay] sendMessage threw:', err);
        setAuthState('unauthenticated');
      }
    }

    attempt();
  }, [isChromeExt]);

  useEffect(() => {
    // Kick off auth check on mount
    checkAuthStatus();

    if (!isChromeExt) return;

    const listener = (message: any) => {
      if (message?.type === 'SARA_AUTH_STATE_CHANGED' && message.payload) {
        console.log('[SARA Overlay] Auth state broadcast received:', message.payload?.authenticated);
        // Cancel any pending retries — background just told us the state
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        retryCountRef.current = 0;

        const payload = message.payload;
        if (payload.authenticated) {
          setAuthState('authenticated');
          setUserDisplayName(payload.userDisplayName ?? null);
          setUserAvatarUrl(payload.userAvatarUrl ?? null);
        } else {
          setAuthState('unauthenticated');
          setUserDisplayName(null);
          setUserAvatarUrl(null);
          setRecommendations([]);
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [checkAuthStatus, isChromeExt]);

  const loadRecommendations = useCallback(() => {
    if (authState !== 'authenticated' || !isChromeExt) return;
    setLoading(true);
    chrome.runtime.sendMessage(
      { type: 'SARA_GET_RECOMMENDATIONS', domain },
      (response) => {
        setLoading(false);
        if (response?.success) {
          setRecommendations(response.recommendations || []);
        }
        // NOTE: recommendation failure does NOT change auth state
      }
    );
  }, [authState, domain, isChromeExt]);

  useEffect(() => {
    if (isOpen || authState === 'authenticated') {
      loadRecommendations();
    }
  }, [isOpen, authState, loadRecommendations]);

  const handleSignIn = () => {
    if (!isChromeExt) return;
    setSigningIn(true);
    setAuthError(null);
    chrome.runtime.sendMessage({ type: 'SARA_SIGN_IN' }, (response) => {
      setSigningIn(false);
      if (response?.success) {
        checkAuthStatus();
      } else {
        setAuthError(response?.error || 'Sign-in failed. Please try again.');
      }
    });
  };

  const handleSignOut = () => {
    if (!isChromeExt) return;
    chrome.runtime.sendMessage({ type: 'SARA_SIGN_OUT' }, () => {
      setAuthState('unauthenticated');
      setUserDisplayName(null);
      setUserAvatarUrl(null);
      setRecommendations([]);
      setIsOpen(false);
    });
  };

  const handleFeedback = (recommendationId: string, feedbackType: 'like' | 'dislike' | 'skip') => {
    if (!isChromeExt) return;
    chrome.runtime.sendMessage(
      { type: 'SARA_SUBMIT_FEEDBACK', payload: { recommendationId, feedbackType } },
      () => {
        // Remove item from view after feedback
        setRecommendations((prev) => prev.filter((r) => r.id !== recommendationId));
      }
    );
  };

  return (
    <>
      {/* Floating SARA Button */}
      <div
        className="sara-floating-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={authState === 'authenticated' ? `SARA AI Assistant (${userDisplayName || 'Active'})` : 'SARA AI Assistant (Sign in to activate)'}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 999999,
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C3AED 0%, #C084FC 100%)',
          boxShadow: authState === 'authenticated'
            ? '0 8px 24px rgba(124, 58, 237, 0.6), 0 0 16px rgba(192, 132, 252, 0.4)'
            : '0 8px 24px rgba(124, 58, 237, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white',
          border: '2px solid rgba(255,255,255,0.2)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
        {authState === 'authenticated' && recommendations.length > 0 && (
          <div style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#EF4444', color: 'white', fontSize: '11px', fontWeight: 'bold',
            width: '20px', height: '20px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #0F0F17'
          }}>
            {recommendations.length > 9 ? '9+' : recommendations.length}
          </div>
        )}
        {authState === 'unauthenticated' && (
          <div style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#F59E0B', color: 'white', fontSize: '8px', fontWeight: 'bold',
            width: '16px', height: '16px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #0F0F17'
          }}>
            !
          </div>
        )}
      </div>

      {/* Popover Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '90px', right: '24px', width: '360px',
          maxHeight: '520px', background: '#0F0F17',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 24px rgba(139, 92, 246, 0.2)',
          borderRadius: '16px', zIndex: 999999, color: '#E2E8F0',
          overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}>

          {/* Header */}
          <div style={{
            padding: '16px',
            background: 'linear-gradient(180deg, rgba(124,58,237,0.15) 0%, rgba(15,15,23,0) 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#F3E8FF' }}>✦ SARA</div>
              <div style={{ fontSize: '11px', color: '#A78BFA', marginTop: '2px' }}>
                {authState === 'authenticated'
                  ? `${domain} — Adaptive Recommendations`
                  : authState === 'unknown'
                  ? 'Initializing…'
                  : 'Sign in to enable recommendations'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {authState === 'authenticated' && (
                <button onClick={handleSignOut}
                  style={{ background: 'transparent', border: 'none', color: '#64748B',
                    cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }}
                  title="Sign out">
                  Sign out
                </button>
              )}
              <button onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none',
                  color: '#94A3B8', cursor: 'pointer', fontSize: '16px' }}>
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
            {authState === 'unknown' ? (
              /* Still waiting for background service worker response */
              <div style={{ textAlign: 'center', padding: '32px 12px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: '3px solid rgba(139,92,246,0.3)',
                  borderTopColor: '#7C3AED',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px'
                }} />
                <div style={{ color: '#94A3B8', fontSize: '12px' }}>Connecting to SARA…</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            ) : authState === 'unauthenticated' ? (
              <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>✦</div>
                <div style={{ fontWeight: 600, color: '#CBD5E1', fontSize: '14px', marginBottom: '6px' }}>
                  Sign in to activate SARA
                </div>
                <div style={{ color: '#94A3B8', fontSize: '12px', marginBottom: '20px' }}>
                  SARA learns your interests across websites and provides personalized recommendations while you browse.
                </div>
                {authError && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '8px', padding: '8px 12px', marginBottom: '12px',
                    color: '#FCA5A5', fontSize: '11px' }}>
                    {authError}
                  </div>
                )}
                <button onClick={handleSignIn} disabled={signingIn}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
                    border: '1px solid rgba(168,85,247,0.4)',
                    color: 'white', fontWeight: 600, fontSize: '13px',
                    cursor: signingIn ? 'wait' : 'pointer',
                    opacity: signingIn ? 0.6 : 1, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}>
                  {signingIn ? 'Connecting...' : 'Continue with Google'}
                </button>
              </div>
            ) : loading ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '24px 12px' }}>
                Analyzing signals for {domain}...
              </div>
            ) : recommendations.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '12px', padding: '24px 12px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                <div style={{ fontWeight: 600, color: '#CBD5E1', marginBottom: '4px', fontSize: '13px' }}>
                  Learning your interests...
                </div>
                <div>Continue browsing to let SARA learn your interests on {domain}.</div>
              </div>
            ) : (
              recommendations.map((rec: any) => (
                <div key={rec.id} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: '10px', padding: '12px', marginBottom: '10px'
                }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#F1F5F9', marginBottom: '4px' }}>
                    {rec.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '6px' }}>
                    {rec.description}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    background: 'rgba(124, 58, 237, 0.2)', color: '#DDD6FE',
                    padding: '4px 8px', borderRadius: '6px', marginBottom: '6px'
                  }}>
                    💡 {rec.explanation?.primaryReason || 'Contextual match'}
                  </div>
                  {/* Supporting signal topic pills */}
                  {rec.explanation?.supportingSignals && rec.explanation.supportingSignals.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                      {rec.explanation.supportingSignals.slice(0, 3).map((signal: string, idx: number) => {
                        const topicMatch = signal.match(/"([^"]+)"/);
                        const label = topicMatch ? topicMatch[1] : signal.substring(0, 18);
                        const confMatch = signal.match(/(\d+)%/);
                        const conf = confMatch ? confMatch[1] : null;
                        return (
                          <span key={idx} title={signal} style={{
                            fontSize: '9px', fontWeight: 600,
                            padding: '2px 6px', borderRadius: '999px',
                            background: 'rgba(99, 102, 241, 0.2)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            color: '#A5B4FC',
                            display: 'inline-flex', alignItems: 'center', gap: '3px'
                          }}>
                            ⚡ {label}{conf ? ` ${conf}%` : ''}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleFeedback(rec.id, 'like')}
                      style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ADE80', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      👍 Relevant
                    </button>
                    <button
                      onClick={() => handleFeedback(rec.id, 'dislike')}
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      👎 Not for me
                    </button>
                    <button
                      onClick={() => handleFeedback(rec.id, 'skip')}
                      style={{ background: 'rgba(148,163,184,0.15)', border: '1px solid rgba(148,163,184,0.3)', color: '#CBD5E1', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      ⏭️ Skip
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};
