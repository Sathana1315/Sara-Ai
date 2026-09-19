import React from 'react';
import { BrainCircuit, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface LearningEntry {
  id: string;
  topics_updated: string[];
  score_delta: number;
  created_at: string;
}

interface LearningFeedProps {
  entries: LearningEntry[];
}

function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const LearningFeed: React.FC<LearningFeedProps> = ({ entries }) => {
  if (entries.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-purple-900/30 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BrainCircuit className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold text-white">Recent Learning Activity</h2>
        </div>
        <div className="py-10 text-center rounded-xl bg-purple-950/20 border border-purple-900/20">
          <BrainCircuit className="w-8 h-8 text-purple-400/40 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">No learning events yet</p>
          <p className="text-xs text-slate-500 mt-1">Browse websites with the SARA extension to begin learning.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-2xl border border-purple-900/30 mb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold text-white">Recent Learning Activity</h2>
        </div>
        <span className="text-[10px] font-bold text-purple-400 px-2 py-1 rounded-full bg-purple-900/30 border border-purple-700/30">
          Last 20 Updates
        </span>
      </div>

      <div className="space-y-2.5">
        {entries.map((entry, idx) => {
          const isPositive = entry.score_delta >= 0;
          return (
            <div
              key={entry.id || idx}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-purple-500/10 hover:border-purple-500/25 transition-all"
            >
              {/* Delta indicator */}
              <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${isPositive ? 'bg-emerald-900/30 border border-emerald-700/30' : 'bg-red-900/30 border border-red-700/30'}`}>
                {isPositive
                  ? <TrendingUp className="w-3 h-3 text-emerald-400" />
                  : <TrendingDown className="w-3 h-3 text-red-400" />
                }
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {entry.topics_updated.slice(0, 6).map((topic) => (
                    <span
                      key={topic}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/30"
                    >
                      {topic}
                    </span>
                  ))}
                  {entry.topics_updated.length > 6 && (
                    <span className="text-[10px] text-slate-500">+{entry.topics_updated.length - 6} more</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {timeAgo(entry.created_at)}
                  <span className="ml-1 text-slate-600">·</span>
                  <span className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? '+' : ''}{entry.score_delta.toFixed(3)} Δ score
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
