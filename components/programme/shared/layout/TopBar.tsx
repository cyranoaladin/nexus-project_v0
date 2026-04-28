'use client';

import React from 'react';
import { 
  Zap, 
  Target, 
  Bell, 
  HelpCircle,
  Command
} from 'lucide-react';

interface TopBarProps {
  activeTab: string;
  streak: number;
  totalXP: number;
  onToggleFocus: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  streak,
  totalXP,
  onToggleFocus
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{activeTab}</span>
          <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 text-[8px] font-bold text-slate-500 border border-slate-700">V2.0-KATEX</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 border-l border-slate-800 pl-6">
          <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-bold text-white">{streak}j</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-bold text-white">{totalXP} XP</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-slate-700 transition-all">
          <Bell className="h-4 w-4" />
        </button>
        <button className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-slate-700 transition-all">
          <HelpCircle className="h-4 w-4" />
        </button>
        <button 
          onClick={onToggleFocus}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-600 hover:text-slate-300 transition-colors"
        >
          <Command className="h-3 w-3" /> F
          <span className="ml-1 opacity-60">Focus Mode</span>
        </button>
      </div>
    </div>
  );
};
