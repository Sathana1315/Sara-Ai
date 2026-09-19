import React from 'react';
import { Eye, BrainCircuit, Sparkles, ThumbsUp } from 'lucide-react';

interface KPICardsProps {
  eventsCount: number;
  interestsCount: number;
  recommendationsCount: number;
  feedbackCount: number;
}

export const KPICards: React.FC<KPICardsProps> = ({
  eventsCount,
  interestsCount,
  recommendationsCount,
  feedbackCount
}) => {
  const cards = [
    {
      title: 'Behavior Signals Observed',
      value: eventsCount,
      label: 'Real cross-site signals',
      icon: Eye,
      color: 'from-blue-500/20 to-purple-500/20',
      borderColor: 'border-blue-500/30'
    },
    {
      title: 'Interests Learned',
      value: interestsCount,
      label: 'Dynamic profile topics',
      icon: BrainCircuit,
      color: 'from-purple-500/20 to-pink-500/20',
      borderColor: 'border-purple-500/30'
    },
    {
      title: 'Recommendations Generated',
      value: recommendationsCount,
      label: 'Scored candidates',
      icon: Sparkles,
      color: 'from-indigo-500/20 to-violet-500/20',
      borderColor: 'border-indigo-500/30'
    },
    {
      title: 'Feedback Signals',
      value: feedbackCount,
      label: 'Explicit user tuning',
      icon: ThumbsUp,
      color: 'from-emerald-500/20 to-teal-500/20',
      borderColor: 'border-emerald-500/30'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-5 rounded-2xl bg-gradient-to-br ${card.color} border ${card.borderColor} backdrop-blur-md shadow-lg transition-transform hover:-translate-y-1 duration-200`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {card.title}
              </span>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-purple-300">
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white mb-1 tracking-tight">
              {card.value}
            </div>
            <div className="text-xs text-slate-400 font-medium">{card.label}</div>
          </div>
        );
      })}
    </div>
  );
};
