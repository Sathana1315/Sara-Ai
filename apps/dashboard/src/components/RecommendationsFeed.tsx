import React, { useState } from 'react';
import { Compass, ExternalLink, Lightbulb, Inbox, ThumbsUp, ThumbsDown, SkipForward, Zap } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  domain: string;
  score: number;
  explanation?: {
    primaryReason: string;
    matchPercentage: number;
    supportingSignals?: string[];
    topMatchedTopics?: string[];
  };
}

interface RecommendationsFeedProps {
  recommendations: Recommendation[];
  accessToken?: string | null;
}

type FeedbackType = 'like' | 'dislike' | 'skip';

export const RecommendationsFeed: React.FC<RecommendationsFeedProps> = ({ recommendations, accessToken }) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [feedbackSent, setFeedbackSent] = useState<Record<string, FeedbackType>>({});
  const [pendingFeedback, setPendingFeedback] = useState<Set<string>>(new Set());
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const visibleRecs = recommendations.filter((r) => !dismissed.has(r.id));

  const handleFeedback = async (rec: Recommendation, feedbackType: FeedbackType) => {
    if (pendingFeedback.has(rec.id) || feedbackSent[rec.id]) return;

    setPendingFeedback((prev) => new Set([...prev, rec.id]));

    try {
      if (accessToken && rec.id && !rec.id.startsWith('rec_')) {
        // Only post feedback if we have a real persisted recommendation UUID
        await fetch(`${BACKEND_URL}/api/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ recommendationId: rec.id, feedbackType })
        });
      }

      setFeedbackSent((prev) => ({ ...prev, [rec.id]: feedbackType }));

      const messages: Record<FeedbackType, string> = {
        like: '👍 SARA learned you like this — profile updated!',
        dislike: '👎 Got it — SARA will deprioritize this topic.',
        skip: '⏭️ Skipped — this won\'t count against your profile.'
      };
      setFlashMessage(messages[feedbackType]);
      setTimeout(() => {
        setFlashMessage(null);
        setDismissed((prev) => new Set([...prev, rec.id]));
      }, 1800);
    } catch {
      // Silently fail feedback — don't break the UI
    } finally {
      setPendingFeedback((prev) => {
        const next = new Set(prev);
        next.delete(rec.id);
        return next;
      });
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-purple-900/30">
      {/* Flash message */}
      {flashMessage && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-purple-900/30 border border-purple-500/30 text-sm text-purple-200 text-center animate-pulse">
          {flashMessage}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-400" />
            Cross-Site Recommendations Feed
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Scored &amp; contextually weighted recommendation candidates across all supported sites.
          </p>
        </div>
        {visibleRecs.length > 0 && (
          <span className="text-[10px] font-bold text-indigo-400 px-2 py-1 rounded-full bg-indigo-900/30 border border-indigo-700/30">
            {visibleRecs.length} Candidates
          </span>
        )}
      </div>

      {visibleRecs.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-xl bg-purple-950/20 border border-purple-900/20">
          <Inbox className="w-10 h-10 text-indigo-400/50 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300 mb-1">
            {recommendations.length === 0 ? 'No Recommendations Available' : 'All caught up!'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {recommendations.length === 0
              ? 'Keep exploring — SARA needs more signals to personalize your recommendations.'
              : 'You\'ve given feedback on all recommendations. SARA will generate new ones as you continue browsing.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleRecs.map((rec) => {
            const matchPct = rec.explanation?.matchPercentage || Math.round(rec.score * 100);
            const sentFeedback = feedbackSent[rec.id];
            const isPending = pendingFeedback.has(rec.id);

            return (
              <div
                key={rec.id}
                className={`p-5 rounded-xl border flex flex-col justify-between transition-all duration-200 ${
                  sentFeedback
                    ? 'bg-purple-900/10 border-purple-500/30 opacity-70'
                    : 'bg-white/[0.02] border-purple-500/20 hover:border-purple-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider px-2 py-0.5 rounded bg-purple-900/40 border border-purple-700/30">
                      {rec.category} • {rec.domain}
                    </span>
                    <span className="text-xs font-bold text-indigo-300">
                      {matchPct}% Match
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm text-slate-100 mb-1 line-clamp-1">
                    {rec.title}
                  </h4>
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                    {rec.description}
                  </p>
                </div>

                <div>
                  <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-900/30 text-xs text-purple-200 mb-2 flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{rec.explanation?.primaryReason || 'Contextual match derived from interest profile.'}</span>
                  </div>

                  {/* Supporting signals topic pills */}
                  {rec.explanation?.supportingSignals && rec.explanation.supportingSignals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {rec.explanation.supportingSignals.slice(0, 3).map((signal, idx) => {
                        // Extract topic name from signal string like 'Observed interest in "machine learning" (82% confidence)'
                        const topicMatch = signal.match(/"([^"]+)"/);
                        const label = topicMatch ? topicMatch[1] : signal.substring(0, 20);
                        const confMatch = signal.match(/(\d+)%/);
                        const conf = confMatch ? confMatch[1] : null;
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-900/30 border border-indigo-700/30 text-indigo-300"
                            title={signal}
                          >
                            <Zap className="w-2.5 h-2.5 text-indigo-400" />
                            {label}{conf && <span className="opacity-60 ml-0.5">{conf}%</span>}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <a
                      href={rec.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Visit <ExternalLink className="w-3 h-3" />
                    </a>

                    {/* Feedback buttons */}
                    {!sentFeedback ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleFeedback(rec, 'like')}
                          disabled={isPending}
                          title="Relevant — I like this"
                          className="p-1.5 rounded-lg bg-emerald-900/20 border border-emerald-700/30 text-emerald-400 hover:bg-emerald-900/40 transition-all disabled:opacity-40"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleFeedback(rec, 'dislike')}
                          disabled={isPending}
                          title="Not relevant — not for me"
                          className="p-1.5 rounded-lg bg-red-900/20 border border-red-700/30 text-red-400 hover:bg-red-900/40 transition-all disabled:opacity-40"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleFeedback(rec, 'skip')}
                          disabled={isPending}
                          title="Skip — hide without learning"
                          className="p-1.5 rounded-lg bg-slate-800/50 border border-slate-700/30 text-slate-400 hover:bg-slate-700/50 transition-all disabled:opacity-40"
                        >
                          <SkipForward className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        sentFeedback === 'like' ? 'text-emerald-400 border-emerald-700/30 bg-emerald-900/20' :
                        sentFeedback === 'dislike' ? 'text-red-400 border-red-700/30 bg-red-900/20' :
                        'text-slate-400 border-slate-700/30 bg-slate-800/40'
                      }`}>
                        {sentFeedback === 'like' ? '👍 Liked' : sentFeedback === 'dislike' ? '👎 Disliked' : '⏭️ Skipped'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
