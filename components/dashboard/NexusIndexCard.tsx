'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import type { NexusIndexResult } from '@/lib/nexus-index';

/**
 * NexusIndexCard — Displays the Nexus Index™ score with pillar breakdown.
 *
 * Premium lite design: sober, clear, no gamification.
 * Positioned in the "Vision globale" zone of the dashboard.
 */

const LEVEL_CONFIG = {
  excellent: { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' },
  bon: { label: 'Bon', color: 'text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30' },
  en_progression: { label: 'En progression', color: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/30' },
  a_renforcer: { label: 'À renforcer', color: 'text-orange-400', bg: 'bg-orange-500/10', ring: 'ring-orange-500/30' },
  debutant: { label: 'Débutant', color: 'text-neutral-400', bg: 'bg-neutral-500/10', ring: 'ring-neutral-500/30' },
} as const;

const TREND_CONFIG = {
  up: { icon: TrendingUp, label: 'En hausse', color: 'text-emerald-400' },
  down: { icon: TrendingDown, label: 'En baisse', color: 'text-red-400' },
  stable: { icon: Minus, label: 'Stable', color: 'text-neutral-400' },
} as const;

function PillarBar({ label, score, maxScore = 100 }: { label: string; score: number; maxScore?: number }) {
  const pct = Math.round((score / maxScore) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400">{label}</span>
        <span className="font-medium text-neutral-200">{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-brand-primary transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function NexusIndexCard() {
  const [index, setIndex] = useState<NexusIndexResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchIndex() {
      try {
        const res = await fetch('/api/student/nexus-index');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.index) {
          setIndex(data.index);
        }
      } catch {
        // Silently fail — card simply won't render
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchIndex();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-surface-card p-6 animate-pulse">
        <div className="h-4 w-32 rounded bg-neutral-800 mb-4" />
        <div className="h-16 w-16 rounded-full bg-neutral-800 mx-auto mb-4" />
        <div className="space-y-2">
          <div className="h-2 rounded bg-neutral-800" />
          <div className="h-2 rounded bg-neutral-800" />
          <div className="h-2 rounded bg-neutral-800" />
          <div className="h-2 rounded bg-neutral-800" />
        </div>
      </div>
    );
  }

  if (!index) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-surface-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-neutral-200">Nexus Index</h3>
        </div>
        <p className="text-xs text-neutral-500">
          Pas encore assez de données pour calculer votre indice.
          Complétez quelques séances pour débloquer votre Nexus Index.
        </p>
      </div>
    );
  }

  const levelCfg = LEVEL_CONFIG[index.level];
  const trendCfg = TREND_CONFIG[index.trend];
  const TrendIcon = trendCfg.icon;

  return (
    <div className={`rounded-xl border border-neutral-800 bg-surface-card p-6 ring-1 ${levelCfg.ring}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-neutral-200">Nexus Index</h3>
        </div>
        <div className={`flex items-center gap-1 text-xs ${trendCfg.color}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span>{trendCfg.label}</span>
        </div>
      </div>

      {/* Score central */}
      <div className="flex items-center justify-center mb-5">
        <div className={`relative flex items-center justify-center w-20 h-20 rounded-full ${levelCfg.bg}`}>
          <span className="text-2xl font-bold text-neutral-100">{index.globalScore}</span>
          <span className="absolute -bottom-5 text-[10px] font-medium uppercase tracking-wider ${levelCfg.color}">
            {levelCfg.label}
          </span>
        </div>
      </div>

      {/* Pillar breakdown */}
      <div className="space-y-3 mt-8">
        {index.pillars.map((pillar) => (
          <PillarBar key={pillar.key} label={pillar.label} score={pillar.score} />
        ))}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-neutral-600 mt-4 text-center">
        Basé sur {index.dataPoints} points de données
      </p>
    </div>
  );
}
