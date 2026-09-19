import React from 'react';
import { Bell, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Header: React.FC = () => {
  const { saraUser, signOut, status } = useAuth();
  const [showMenu, setShowMenu] = React.useState(false);

  const initials = saraUser?.fullName
    ? saraUser.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : saraUser?.email?.[0]?.toUpperCase() || '?';

  return (
    <header className="h-20 border-b border-purple-900/20 px-8 flex items-center justify-between sticky top-0 bg-[#07070A]/80 backdrop-blur-md z-40">
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight">
          Adaptive Personalization Control Center
        </h2>
        <p className="text-xs text-slate-400">
          Real-time observation, dynamic profile weighting & explainable scoring.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          id="sara-header-notifications"
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors"
        >
          <Bell className="w-4 h-4" />
        </button>

        <div className="relative flex items-center gap-3 pl-4 border-l border-white/10">
          {saraUser?.avatarUrl ? (
            <img
              src={saraUser.avatarUrl}
              alt={saraUser.fullName}
              className="w-9 h-9 rounded-full border-2 border-purple-500/30 shadow-md"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {status === 'loading' ? '...' : initials}
            </div>
          )}

          <button
            id="sara-user-menu-btn"
            className="flex flex-col items-start hover:opacity-80 transition-opacity"
            onClick={() => setShowMenu(!showMenu)}
          >
            <div className="flex items-center gap-1">
              <div className="text-xs font-bold text-slate-200">
                {saraUser?.fullName || saraUser?.email || 'SARA User'}
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-[10px] text-purple-400 font-medium">
              {saraUser ? 'Authenticated via Google' : 'Resolving session...'}
            </div>
          </button>

          {showMenu && (
            <div
              id="sara-user-menu"
              className="absolute top-12 right-0 w-52 rounded-xl overflow-hidden z-50 shadow-2xl"
              style={{
                background: 'rgba(15, 15, 23, 0.95)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                backdropFilter: 'blur(16px)'
              }}
            >
              {saraUser && (
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="text-xs font-semibold text-slate-300 truncate">{saraUser.email}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">SARA ID: {saraUser.id.slice(0, 8)}...</div>
                </div>
              )}
              <button
                id="sara-signout-btn"
                onClick={() => { signOut(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-xs text-slate-300 hover:text-red-300 hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
