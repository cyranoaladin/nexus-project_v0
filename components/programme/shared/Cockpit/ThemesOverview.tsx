'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { resolveUiIcon } from '@/lib/ui-icons';

type ActiveTab = 'cockpit' | 'cours' | 'examen' | 'enseignant' | 'bilan';

interface ThemesOverviewProps {
  onNavigate: (tab: ActiveTab) => void;
  store: {
    completedChapters: string[];
  };
  programmeData: Record<string, any>;
}

export const ThemesOverview: React.FC<ThemesOverviewProps> = ({ onNavigate, store, programmeData }) => {
  return (
    <section aria-labelledby="themes-title">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-slate-800" />
        <h2 id="themes-title" className="text-sm font-bold uppercase tracking-widest text-slate-400">Avancement par thème</h2>
        <div className="h-px flex-1 bg-slate-800" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(programmeData).map(([key, cat]: [string, any]) => {
          const ThemeIcon = resolveUiIcon(cat.icon);
          const completedCount = cat.chapitres.filter((c: any) =>
            store.completedChapters.includes(c.id)
          ).length;
          const progress = cat.chapitres.length > 0 ? (completedCount / cat.chapitres.length) * 100 : 0;

          return (
            <motion.button
              key={key}
              whileHover={{ scale: 1.03, y: -2 }}
              onClick={() => onNavigate('cours')}
              className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-4 text-left hover:border-slate-600/40 transition-all group"
            >
              <div className="mb-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    cat.couleur === 'cyan' ? 'bg-cyan-500/10 text-cyan-400' :
                    cat.couleur === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                    cat.couleur === 'purple' ? 'bg-purple-500/10 text-purple-400' :
                    cat.couleur === 'amber' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-green-500/10 text-green-400'
                  }`}
                >
                  <ThemeIcon className="h-5 w-5" />
                </div>
              </div>
              <div className="font-bold text-white text-xs mb-0.5 group-hover:text-cyan-300 transition-colors truncate">
                {cat.titre}
              </div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                {completedCount}/{cat.chapitres.length}
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    cat.couleur === 'cyan' ? 'bg-cyan-500' :
                    cat.couleur === 'blue' ? 'bg-blue-500' :
                    cat.couleur === 'purple' ? 'bg-purple-500' :
                    cat.couleur === 'amber' ? 'bg-amber-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};
