import React from 'react';
import { Activity, Search, ShoppingBag, Play, Eye, Clock, Scroll, MousePointer } from 'lucide-react';

interface BehaviorEvent {
  id: string;
  event_type: string;
  site_category: string;
  domain: string;
  url: string;
  title: string;
  search_query?: string;
  keywords: string[];
  duration_ms?: number;
  created_at: string;
}

interface BehaviorFeedProps {
  events: BehaviorEvent[];
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

const EVENT_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  search: { icon: Search, label: 'Search', color: 'text-blue-400' },
  video_view: { icon: Play, label: 'Video', color: 'text-red-400' },
  product_view: { icon: ShoppingBag, label: 'Product', color: 'text-amber-400' },
  content_view: { icon: Eye, label: 'Article', color: 'text-green-400' },
  dwell_time: { icon: Clock, label: 'Dwell', color: 'text-purple-400' },
  scroll_milestone: { icon: Scroll, label: 'Scroll', color: 'text-indigo-400' },
  media_play: { icon: Play, label: 'Play', color: 'text-pink-400' },
  media_complete: { icon: Play, label: 'Watched', color: 'text-emerald-400' },
  click: { icon: MousePointer, label: 'Click', color: 'text-cyan-400' },
  page_view: { icon: Eye, label: 'Page', color: 'text-slate-400' },
};

const CATEGORY_COLORS: Record<string, string> = {
  video: 'bg-red-900/30 text-red-300 border-red-700/30',
  shopping: 'bg-amber-900/30 text-amber-300 border-amber-700/30',
  content: 'bg-green-900/30 text-green-300 border-green-700/30',
  music: 'bg-pink-900/30 text-pink-300 border-pink-700/30',
  general: 'bg-slate-800/50 text-slate-400 border-slate-700/30',
};

export const BehaviorFeed: React.FC<BehaviorFeedProps> = ({ events }) => {
  if (events.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-purple-900/30 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Observed Behavior Signals</h2>
        </div>
        <div className="py-10 text-center rounded-xl bg-purple-950/20 border border-purple-900/20">
          <Activity className="w-8 h-8 text-indigo-400/40 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">No signals captured yet</p>
          <p className="text-xs text-slate-500 mt-1">Install the SARA extension and browse to begin observation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-2xl border border-purple-900/30 mb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Observed Behavior Signals</h2>
        </div>
        <span className="text-[10px] font-bold text-indigo-400 px-2 py-1 rounded-full bg-indigo-900/30 border border-indigo-700/30">
          Latest {events.length} Signals
        </span>
      </div>

      <div className="space-y-2.5">
        {events.map((event, idx) => {
          const meta = EVENT_META[event.event_type] || { icon: Activity, label: event.event_type, color: 'text-slate-400' };
          const Icon = meta.icon;
          const catClass = CATEGORY_COLORS[event.site_category] || CATEGORY_COLORS.general;

          return (
            <div
              key={event.id || idx}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-indigo-500/10 hover:border-indigo-500/25 transition-all"
            >
              {/* Event type icon */}
              <div className="mt-0.5 p-1.5 rounded-lg shrink-0 bg-white/5 border border-white/10">
                <Icon className={`w-3 h-3 ${meta.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${catClass}`}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 truncate">{event.domain}</span>
                </div>
                <div className="text-xs text-slate-200 font-medium truncate leading-tight mb-1">
                  {event.search_query
                    ? `Searched: "${event.search_query}"`
                    : event.title || event.url}
                </div>
                {event.keywords && event.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {event.keywords.slice(0, 4).map((kw) => (
                      <span key={kw} className="text-[9px] px-1 py-0.5 rounded bg-purple-950/50 text-purple-400 border border-purple-800/30">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-slate-500">
                  {timeAgo(event.created_at)}
                  {event.duration_ms && event.duration_ms > 0 && (
                    <span className="ml-1 text-slate-600">· {Math.round(event.duration_ms / 1000)}s dwell</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
