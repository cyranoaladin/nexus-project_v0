'use client';

import React from 'react';
import { Medal } from 'lucide-react';
import { resolveUiIcon } from '@/lib/ui-icons';

interface BadgesPreviewProps {
  store: {
    badges: string[];
  };
  badgeDefinitions: Record<string, any>;
}

export const BadgesPreview: React.FC<BadgesPreviewProps> = ({ store, badgeDefinitions }) => (
  <div className="rounded-3xl border border-slate-700/30 bg-slate-800/30 p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="rounded-lg bg-amber-500/10 p-2">
        <Medal className="h-4 w-4 text-amber-300" />
      </div>
      <h3 className="font-bold text-white">Badges</h3>
      <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        {store.badges.length}/{badgeDefinitions.length}
      </span>
    </div>
    <div className="flex flex-wrap gap-2.5">
      {badgeDefinitions.slice(0, 10).map((b: any) => {
        const BadgeIcon = resolveUiIcon(b.icon);
        const isEarned = store.badges.includes(b.id);
        return (
          <div
            key={b.id}
            title={`${b.nom}: ${b.description}`}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
              isEarned
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/5'
                : 'bg-slate-900/50 border border-slate-800 text-slate-700 grayscale'
            }`}
          >
            <BadgeIcon className="h-5 w-5" />
          </div>
        );
      })}
      {badgeDefinitions.length > 10 && (
        <div className="h-11 w-11 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600">
          +{badgeDefinitions.length - 10}
        </div>
      )}
    </div>
  </div>
);
