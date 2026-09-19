import React, { useState, useEffect } from 'react';

const DASHBOARD_URL = 'http://localhost:3000';

interface AuthStatus {
  authenticated: boolean;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
}

export const Popup: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    userDisplayName: null,
    userAvatarUrl: null
  });
  const [todayEvents, setTodayEvents] = useState<number>(0);
  const [signingIn, setSigningIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Get auth status from background
    chrome.runtime.sendMessage({ type: 'SARA_GET_AUTH_STATUS' }, (response) => {
      if (response) {
        console.log('[SARA Popup Auth]', {
          authenticated: response.authenticated,
          userDisplayName: response.userDisplayName
        });
        setAuthStatus(response);
      }
      setLoading(false);
    });

    // Get today's event count from chrome.storage
    chrome.storage.local.get(['sara_today_events'], (result) => {
      setTodayEvents(result.sara_today_events || 0);
    });

    const listener = (message: any) => {
      if (message?.type === 'SARA_AUTH_STATE_CHANGED' && message.payload) {
        setAuthStatus(message.payload);
        setLoading(false);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const handleSignIn = () => {
    setSigningIn(true);
    setAuthError(null);
    chrome.runtime.sendMessage({ type: 'SARA_SIGN_IN' }, (response) => {
      setSigningIn(false);
      if (response?.success) {
        chrome.runtime.sendMessage({ type: 'SARA_GET_AUTH_STATUS' }, (res) => {
          if (res) setAuthStatus(res);
        });
      } else {
        setAuthError(response?.error || 'Sign-in failed. Please try again.');
      }
    });
  };

  const handleSignOut = () => {
    chrome.runtime.sendMessage({ type: 'SARA_SIGN_OUT' }, () => {
      setAuthStatus({ authenticated: false, userDisplayName: null, userAvatarUrl: null });
    });
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: DASHBOARD_URL });
  };

  const initials = authStatus.userDisplayName
    ? authStatus.userDisplayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div style={{
      width: '320px',
      minHeight: '260px',
      background: '#0A0A12',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#E2E8F0',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        background: 'linear-gradient(180deg, rgba(124,58,237,0.12) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(139,92,246,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', boxShadow: '0 4px 12px rgba(124,58,237,0.4)'
          }}>✦</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: '#F3E8FF', letterSpacing: '-0.3px' }}>SARA</div>
            <div style={{ fontSize: '10px', color: '#A78BFA', marginTop: '1px' }}>Personal AI Assistant</div>
          </div>
          {/* Live indicator */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: authStatus.authenticated ? '#34D399' : '#F59E0B',
              boxShadow: authStatus.authenticated ? '0 0 6px #34D399' : '0 0 6px #F59E0B',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ fontSize: '10px', color: authStatus.authenticated ? '#34D399' : '#F59E0B', fontWeight: 600 }}>
              {loading ? '...' : authStatus.authenticated ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '13px' }}>
            Checking status...
          </div>
        ) : authStatus.authenticated ? (
          /* Authenticated view */
          <>
            {/* User */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '10px',
              background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.2)',
              marginBottom: '12px'
            }}>
              {authStatus.userAvatarUrl ? (
                <img src={authStatus.userAvatarUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid rgba(139,92,246,0.4)' }} />
              ) : (
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, color: 'white'
                }}>{initials}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {authStatus.userDisplayName || 'SARA User'}
                </div>
                <div style={{ fontSize: '10px', color: '#A78BFA' }}>Authenticated via Google</div>
              </div>
            </div>

            {/* Stats */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '8px', marginBottom: '12px'
            }}>
              <div style={{
                padding: '10px', borderRadius: '8px',
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#818CF8' }}>{todayEvents}</div>
                <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Signals Today
                </div>
              </div>
              <div style={{
                padding: '10px', borderRadius: '8px',
                background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
                textAlign: 'center', cursor: 'pointer'
              }} onClick={openDashboard}>
                <div style={{ fontSize: '18px', marginBottom: '2px' }}>↗</div>
                <div style={{ fontSize: '9px', color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                  Open Dashboard
                </div>
              </div>
            </div>

            {/* Info */}
            <div style={{
              padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '10px', color: '#64748B', marginBottom: '12px', lineHeight: 1.5
            }}>
              ✦ SARA is actively observing and learning from your browsing. Open the dashboard to see your adaptive interest profile.
            </div>

            {/* Open dashboard + sign out */}
            <button onClick={openDashboard} style={{
              width: '100%', padding: '10px', borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.8) 0%, rgba(99,102,241,0.8) 100%)',
              border: '1px solid rgba(168,85,247,0.4)',
              color: 'white', fontWeight: 600, fontSize: '12px',
              cursor: 'pointer', marginBottom: '8px'
            }}>
              View My Profile Dashboard
            </button>
            <button onClick={handleSignOut} style={{
              width: '100%', padding: '8px', borderRadius: '8px',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748B', fontSize: '11px', cursor: 'pointer'
            }}>
              Sign Out
            </button>
          </>
        ) : (
          /* Unauthenticated view */
          <>
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✦</div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#CBD5E1', marginBottom: '6px' }}>
                Sign in to activate SARA
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.5, marginBottom: '16px' }}>
                SARA learns your interests as you browse and delivers personalized recommendations across websites.
              </div>
            </div>

            {authError && (
              <div style={{
                padding: '8px 10px', borderRadius: '8px', marginBottom: '10px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#FCA5A5', fontSize: '11px', textAlign: 'center'
              }}>{authError}</div>
            )}

            <button onClick={handleSignIn} disabled={signingIn} style={{
              width: '100%', padding: '12px', borderRadius: '10px',
              background: signingIn ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
              border: '1px solid rgba(168,85,247,0.4)',
              color: 'white', fontWeight: 600, fontSize: '13px',
              cursor: signingIn ? 'wait' : 'pointer',
              opacity: signingIn ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}>
              {signingIn ? 'Connecting to Google...' : 'Continue with Google'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
