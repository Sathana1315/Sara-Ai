import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { KPICards } from './components/KPICards';
import { InterestCloud } from './components/InterestCloud';
import { RecommendationsFeed } from './components/RecommendationsFeed';
import { LearningFeed } from './components/LearningFeed';
import { BehaviorFeed } from './components/BehaviorFeed';
import { SignInPage } from './pages/SignInPage';
import { useAuth } from './context/AuthContext';
import { Sparkles, RefreshCw, ShieldCheck } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const REFRESH_INTERVAL_MS = 30_000; // Auto-refresh every 30 seconds

/**
 * The main authenticated dashboard view.
 * Only rendered when auth status is 'authenticated'.
 * Uses the verified accessToken for backend API calls — never a hardcoded userId.
 */
const AuthenticatedDashboard: React.FC = () => {
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [userProfileData, setUserProfileData] = useState<any>({
    totalEventsObserved: 0,
    interestsLearnedCount: 0,
    totalRecommendationsGenerated: 0,
    totalFeedbackGiven: 0,
    interests: []
  });
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [learningHistory, setLearningHistory] = useState<any[]>([]);
  const [behaviorEvents, setBehaviorEvents] = useState<any[]>([]);

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboardData = useCallback(async (token: string, isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (!loading) setRefreshing(true);

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    try {
      const [profileRes, recsRes, historyRes, behaviorRes] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/user/profile`, { headers: authHeaders }),
        fetch(`${BACKEND_URL}/api/recommendations?context=global_dashboard`, { headers: authHeaders }),
        fetch(`${BACKEND_URL}/api/user/history`, { headers: authHeaders }),
        fetch(`${BACKEND_URL}/api/user/behavior`, { headers: authHeaders })
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        const pData = await profileRes.value.json();
        setUserProfileData(pData);
      } else if (profileRes.status === 'fulfilled' && profileRes.value.status === 401) {
        console.warn('Dashboard: Session expired or invalid.');
      }

      if (recsRes.status === 'fulfilled' && recsRes.value.ok) {
        const rData = await recsRes.value.json();
        setRecommendations(rData.recommendations || []);
      }

      if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
        const hData = await historyRes.value.json();
        setLearningHistory(hData.history || []);
      }

      if (behaviorRes.status === 'fulfilled' && behaviorRes.value.ok) {
        const bData = await behaviorRes.value.json();
        setBehaviorEvents(bData.events || []);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.log('Dashboard: Backend offline or starting up.', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading]);

  useEffect(() => {
    if (accessToken) {
      fetchDashboardData(accessToken);
    }
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!accessToken) return;

    refreshIntervalRef.current = setInterval(() => {
      fetchDashboardData(accessToken);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [accessToken, fetchDashboardData]);

  const handleManualRefresh = () => {
    if (accessToken) fetchDashboardData(accessToken, true);
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return null;
    return lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Tab content rendering
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="py-20 text-center text-purple-400">
          <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <div className="text-sm font-semibold">Loading your personalized profile...</div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <>
            <KPICards
              eventsCount={userProfileData.totalEventsObserved || 0}
              interestsCount={userProfileData.interestsLearnedCount || 0}
              recommendationsCount={userProfileData.totalRecommendationsGenerated || 0}
              feedbackCount={userProfileData.totalFeedbackGiven || 0}
            />
            <InterestCloud interests={userProfileData.interests || []} />
            <RecommendationsFeed
              recommendations={recommendations}
              accessToken={accessToken}
            />
          </>
        );

      case 'interests':
        return (
          <>
            <KPICards
              eventsCount={userProfileData.totalEventsObserved || 0}
              interestsCount={userProfileData.interestsLearnedCount || 0}
              recommendationsCount={userProfileData.totalRecommendationsGenerated || 0}
              feedbackCount={userProfileData.totalFeedbackGiven || 0}
            />
            <InterestCloud interests={userProfileData.interests || []} />
            <LearningFeed entries={learningHistory} />
          </>
        );

      case 'recommendations':
        return (
          <>
            <RecommendationsFeed
              recommendations={recommendations}
              accessToken={accessToken}
            />
          </>
        );

      case 'analytics':
        return (
          <>
            <KPICards
              eventsCount={userProfileData.totalEventsObserved || 0}
              interestsCount={userProfileData.interestsLearnedCount || 0}
              recommendationsCount={userProfileData.totalRecommendationsGenerated || 0}
              feedbackCount={userProfileData.totalFeedbackGiven || 0}
            />
            <BehaviorFeed events={behaviorEvents} />
            <LearningFeed entries={learningHistory} />
          </>
        );

      case 'privacy':
        return (
          <div className="glass-panel p-8 rounded-2xl border border-purple-900/30">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              Privacy &amp; Data Policy
            </h2>
            <div className="space-y-4 text-sm text-slate-300">
              <div className="p-4 rounded-xl bg-emerald-900/10 border border-emerald-700/20">
                <h3 className="font-bold text-emerald-400 mb-2">✓ What SARA Observes</h3>
                <ul className="space-y-1 text-xs text-slate-400">
                  <li>• Page titles and URLs on supported websites</li>
                  <li>• Search queries (public search terms only)</li>
                  <li>• Scroll depth and dwell time (engagement signals)</li>
                  <li>• Video play/complete events on YouTube</li>
                  <li>• Product category and brand on shopping sites</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-red-900/10 border border-red-700/20">
                <h3 className="font-bold text-red-400 mb-2">✗ What SARA Never Collects</h3>
                <ul className="space-y-1 text-xs text-slate-400">
                  <li>• Passwords or authentication credentials</li>
                  <li>• Payment information or financial data</li>
                  <li>• Private messages or emails</li>
                  <li>• Form submissions or personal input</li>
                  <li>• Data from any non-supported website</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-purple-900/10 border border-purple-700/20">
                <h3 className="font-bold text-purple-400 mb-2">🔒 Security</h3>
                <p className="text-xs text-slate-400">All data is encrypted in transit and at rest via Supabase. Authentication is handled exclusively via Google OAuth through Supabase Auth. Your recommendation profile is private and only accessible with your verified Google identity.</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#07070A] text-slate-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col min-w-0">
        <Header />
        <div className="p-8 flex-1 max-w-7xl w-full mx-auto">
          {/* Refresh bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs text-slate-500">
              {lastUpdated && (
                <span>
                  Last updated at <span className="text-slate-400 font-medium">{formatLastUpdated()}</span>
                  {' '}· Auto-refreshes every 30s
                </span>
              )}
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg bg-purple-900/20 border border-purple-700/30 hover:bg-purple-900/30 transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
          </div>

          {renderTabContent()}
        </div>
      </main>
    </div>
  );
};

/**
 * App root — authentication router.
 * Routes between: loading → sign-in → authenticated dashboard.
 * Never shows another user's data (auth derives userId from verified session).
 */
export const App: React.FC = () => {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-2xl shadow-purple-500/40">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500">Resolving authentication state...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <SignInPage />;
  }

  return <AuthenticatedDashboard />;
};
