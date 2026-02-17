/**
 * SSNCard — Displays the Score Standardisé Nexus with classification badge.
 *
 * Shows the normalized SSN (0-100), classification level, and optional
 * cohort percentile position.
 */

'use client';

import { classifySSN, getSSNLabel, SSN_THRESHOLDS } from '@/lib/core/statistics/normalize';

interface SSNCardProps {
  /** SSN value (0-100), null if not yet computed */
  ssn: number | null;
  /** Raw global score (0-100) */
  globalScore: number;
  /** Cohort percentile (0-100), optional */
  percentile?: number | null;
}

/** Color mapping for SSN levels */
const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  excellence:  { bg: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  tres_solide: { bg: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
  stable:      { bg: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' },
  fragile:     { bg: 'from-orange-500/20 to-orange-500/5', border: 'border-orange-500/30', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300' },
  prioritaire: { bg: 'from-red-500/20 to-red-500/5', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300' },
};

export default function SSNCard({ ssn, globalScore, percentile }: SSNCardProps) {
  if (ssn === null) {
    return (
      <div className="p-6 bg-gradient-to-br from-slate-700/20 to-slate-700/5 rounded-xl border border-slate-700">
        <div className="text-sm text-slate-400 mb-1">Score Standardisé Nexus</div>
        <div className="text-2xl font-bold text-slate-500">En cours de calcul...</div>
        <div className="text-sm text-slate-500 mt-2">
          Score brut : {globalScore}/100
        </div>
      </div>
    );
  }

  const level = classifySSN(ssn);
  const label = getSSNLabel(ssn);
  const colors = LEVEL_COLORS[level] || LEVEL_COLORS.stable;
  const threshold = SSN_THRESHOLDS[level];

  return (
    <div className={`p-6 bg-gradient-to-br ${colors.bg} rounded-xl border ${colors.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-400 mb-1">Score Standardisé Nexus</div>
          <div className={`text-5xl font-bold ${colors.text}`}>
            {Math.round(ssn)}
            <span className="text-lg font-normal text-slate-400">/100</span>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors.badge}`}>
          {label}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {/* SSN bar */}
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${colors.text.replace('text-', 'bg-')}`}
            style={{ width: `${Math.min(100, ssn)}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-slate-500">
          <span>0</span>
          <span>Plage : {threshold.min}–{threshold.max}</span>
          <span>100</span>
        </div>
      </div>

      {percentile !== null && percentile !== undefined && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="text-sm text-slate-400">
            Position cohorte : <span className={`font-semibold ${colors.text}`}>{percentile}e percentile</span>
          </div>
        </div>
      )}

      <div className="mt-2 text-xs text-slate-500">
        Score brut : {globalScore}/100
      </div>
    </div>
  );
}
