import React from 'react';
import { Sparkles, LogOut, Plus, BookOpen, ShieldCheck, User, Activity } from 'lucide-react';
import type { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  onNewEntry: () => void;
  onSignOut: () => void;
  onToggleSidebar?: () => void;
  onOpenPatternDetector?: () => void;
  entryCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onNewEntry,
  onSignOut,
  onOpenPatternDetector,
  entryCount,
}) => {
  return (
    <header
      id="main-header"
      className="sticky top-0 z-40 bg-stone-900/90 backdrop-blur-md border-b border-stone-800 text-stone-100 px-4 sm:px-6 py-3.5 flex items-center justify-between"
    >
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center shadow-inner">
          <Sparkles className="w-5 h-5 text-stone-950" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-serif font-semibold text-lg tracking-tight text-amber-100">
              Gemini Reflection
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Isolated Firestore
            </span>
          </div>
          <p className="text-xs text-stone-400 font-sans hidden sm:block">
            Private AI-Powered Multi-Turn Journal
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {user ? (
          <>
            {onOpenPatternDetector && (
              <button
                id="navbar-pattern-detector-btn"
                onClick={onOpenPatternDetector}
                title="Cross-Entry Pattern Detector"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 font-medium text-xs sm:text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Detect Patterns</span>
              </button>
            )}

            <button
              id="new-entry-btn"
              onClick={onNewEntry}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Reflection</span>
            </button>

            <div className="h-5 w-px bg-stone-800 hidden sm:block mx-1" />

            <div className="flex items-center space-x-2 bg-stone-800/80 px-2.5 py-1 rounded-lg border border-stone-700/60">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full border border-stone-600 object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-stone-300">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
              <span className="text-xs text-stone-300 font-medium max-w-[120px] truncate hidden md:inline">
                {user.displayName || user.email?.split('@')[0] || 'User'}
              </span>
            </div>

            <button
              id="sign-out-btn"
              onClick={onSignOut}
              title="Sign Out"
              className="p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-600"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
};
