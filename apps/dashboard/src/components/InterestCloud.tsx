import React, { useState } from 'react';
import { Sparkles, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Interest {
  topic: string;
  category: string;
  weight: number;
  confidence: number;
  decayFactor?: number;
  interactionCount?: number;
  lastObserved?: string;
}

interface InterestCloudProps {
  interests: Interest[];
}

const CATEGORY_PALETTE: Record<string, { bg: string; border: string; bar: string; text: string }> = {
  video: { bg: 'bg-red-900/20', border: 'border-red-500/30', bar: 'bg-red-400', text: 'text-red-300' },
  shopping: { bg: 'bg-amber-900/20', border: 'border-amber-500/30', bar: 'bg-amber-400', text: 'text-amber-300' },
  content: { bg: 'bg-green-900/20', border: 'border-green-500/30', bar: 'bg-green-400', text: 'text-green-300' },
  music: { bg: 'bg-pink-900/20', border: 'border-pink-500/30', bar: 'bg-pink-400', text: 'text-pink-300' },
  general: { bg: 'bg-purple-900/20', border: 'border-purple-500/30', bar: 'bg-purple-400', text: 'text-purple-300' },
};

function getStyle(category: string) {
  return CATEGORY_PALETTE[category] || CATEGORY_PALETTE.general;
}

function timeAgo(isoDate?: string): string {
  if (!isoDate) return 'unknown';
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const InterestCloud: React.FC<InterestCloudProps> = ({ interests }) => {
  const [showAll, setShowAll] = useState(false);
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);

  // Sort by weight descending (backend already sorts, but enforce on frontend)
  const sorted = [...interests].sort((a, b) => b.weight - a.weight);
  const displayLimit = 30;
  const displayed = showAll ? sorted : sorted.slice(0, displayLimit);
  const hasMore = sorted.length > displayLimit;

  return (
    <div className="glass-panel p-6 rounded-2xl border border-purple-900/30 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Unified User Interest Profile
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Continuously updated interest topics synthesized across web domains.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {interests.length > 0 && (
            <span className="text-xs font-bold text-white">
              {interests.length} topics
            </span>
          )}
          <div className="text-xs text-purple-400 font-semibold px-3 py-1 rounded-full bg-purple-900/30 border border-purple-700/30">
            Adaptive ML Model
          </div>
        </div>
      </div>

      {interests.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-xl bg-purple-950/20 border border-purple-900/20">
          <HelpCircle className="w-10 h-10 text-purple-400/50 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300 mb-1">
            No Learned Interests Recorded Yet
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            SARA has not observed any browsing signals for this account yet. Install and browse supported websites using the SARA Chrome Extension to begin building your personalized profile.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            {displayed.map((item, idx) => {
              const weightPct = Math.round(item.weight * 100);
              const confidencePct = Math.round((item.confidence || 0.5) * 100);
              const style = getStyle(item.category);
              const isHovered = hoveredTopic === item.topic;

              return (
                <div
                  key={idx}
                  className={`relative px-4 py-3 rounded-xl border flex flex-col gap-1.5 transition-all duration-200 cursor-default hover:scale-105 hover:shadow-lg min-w-[110px] ${style.bg} ${style.border}`}
                  onMouseEnter={() => setHoveredTopic(item.topic)}
                  onMouseLeave={() => setHoveredTopic(null)}
                >
                  {/* Topic name + category */}
                  <div>
                    <span className={`font-semibold text-sm ${style.text}`}>{item.topic}</span>
                    <span className={`text-[9px] block uppercase tracking-wider mt-0.5 text-slate-400`}>
                      {item.category}
                    </span>
                  </div>

                  {/* Weight bar */}
                  <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                      style={{ width: `${weightPct}%` }}
                    />
                  </div>

                  {/* Weight percentage */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold ${style.text}`}>{weightPct}%</span>
                    <span className="text-[9px] text-slate-500">{confidencePct}% conf</span>
                  </div>

                  {/* Hover tooltip */}
                  {isHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 p-2.5 rounded-xl bg-[#0F0F1F] border border-purple-500/30 shadow-2xl text-[10px] text-slate-300 pointer-events-none">
                      <div className="font-bold text-white mb-1">{item.topic}</div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between"><span className="text-slate-400">Weight</span><span>{weightPct}%</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Confidence</span><span>{confidencePct}%</span></div>
                        {item.interactionCount !== undefined && (
                          <div className="flex justify-between"><span className="text-slate-400">Observed</span><span>{item.interactionCount}×</span></div>
                        )}
                        {item.lastObserved && (
                          <div className="flex justify-between"><span className="text-slate-400">Last seen</span><span>{timeAgo(item.lastObserved)}</span></div>
                        )}
                      </div>
                      {/* Tooltip arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-purple-500/30" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              {showAll
                ? <><ChevronUp className="w-3.5 h-3.5" /> Show fewer</>
                : <><ChevronDown className="w-3.5 h-3.5" /> Show all {sorted.length} topics</>
              }
            </button>
          )}
        </>
      )}
    </div>
  );
};
