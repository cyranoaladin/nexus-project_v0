'use client';

import { Target, Lock } from 'lucide-react';

/**
 * TrajectoireCard — Placeholder for the future Trajectory Engine.
 *
 * Displays a teaser for the trajectory feature (coming soon).
 * Will be connected to the Trajectory model once the backend is ready.
 */

export function TrajectoireCard() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-surface-card p-6 relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-neutral-200">Trajectoire</h3>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-brand-primary/10 text-brand-primary">
            <Lock className="h-2.5 w-2.5" />
            Bientôt
          </span>
        </div>

        <p className="text-xs text-neutral-500 leading-relaxed">
          Votre trajectoire personnalisée sera disponible après quelques séances.
          Elle définira vos objectifs, jalons et horizon de progression.
        </p>

        {/* Visual placeholder — 3 milestone dots */}
        <div className="flex items-center gap-0 mt-4">
          <div className="w-3 h-3 rounded-full bg-brand-primary/30 border-2 border-brand-primary/50" />
          <div className="flex-1 h-px bg-neutral-700" />
          <div className="w-3 h-3 rounded-full bg-neutral-700 border-2 border-neutral-600" />
          <div className="flex-1 h-px bg-neutral-800" />
          <div className="w-3 h-3 rounded-full bg-neutral-800 border-2 border-neutral-700" />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-neutral-600">Aujourd&apos;hui</span>
          <span className="text-[9px] text-neutral-700">3 mois</span>
          <span className="text-[9px] text-neutral-700">6 mois</span>
        </div>
      </div>
    </div>
  );
}
