import React from 'react';
import { LayoutDashboard, Sparkles, Sliders, ShieldCheck, Compass } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'interests', label: 'Learned Interests', icon: Sparkles },
    { id: 'recommendations', label: 'Recommendations', icon: Compass },
    { id: 'analytics', label: 'Behavior Signals', icon: Sliders },
    { id: 'privacy', label: 'Privacy & Data', icon: ShieldCheck }
  ];

  return (
    <aside className="w-64 glass-panel border-r border-purple-900/20 p-6 flex flex-col justify-between h-screen sticky top-0">
      <div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-white tracking-tight">SARA</h1>
            <p className="text-xs text-purple-400 font-medium">Personal AI Assistant</p>
          </div>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-purple-600/20 text-purple-200 border border-purple-500/30 shadow-md shadow-purple-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/20 text-xs text-slate-400">
        <div className="flex items-center gap-2 mb-1 text-purple-300 font-semibold">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          Adaptive Engine Online
        </div>
        <div>Continuous cross-site learning active.</div>
      </div>
    </aside>
  );
};
