'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import type { NexusIndexResult } from '@/lib/nexus-index';

/**
 * NexusIndexCard — Indice de trajectoire.
 *
 * Premium lite: strategic indicator, not a school grade.
 * Accepts optional studentId for parent multi-children scope.
 */

interface NexusIndexCardProps {
  /** Student ID for scoped fetch (parent multi-children) */
  studentId?: string | null;
}

// ─── Pillar labels (micro-copy pack) ─────────────────────────────────────────

const PILLAR_LABELS: Record<string, string> = {
  assiduite: 'Maîtrise',
  progression: 'Progression',
  engagement: 'Engagement',
  regularite: 'Régularité',
};

// ─── Score interpretation messages ───────────────────────────────────────────

function getScoreMessage(score: number): string {
  if (score >= 85) return 'Trajectoire solide et structurée.';
  if (score >= 70) return 'Progression stable, cap maintenu.';
  if (score >= 50) return 'Trajectoire à consolider.';
  return 'Un ajustement stratégique est recommandé.';
}

const LEVEL_CONFIG = {
  excellent: { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' },
  bon: { label: 'Bon', color: 'text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30' },
  en_progression: { label: 'En progression', color: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/30' },
  a_renforcer: { label: 'À renforcer', color: 'text-orange-400', bg: 'bg-orange-500/10', ring: 'ring-orange-500/30' },
  debutant: { label: 'Débutant', color: 'text-neutral-400', bg: 'bg-neutral-500/10', ring: 'ring-neutral-500/30' },
} as const;

const TREND_CONFIG = {
  up: { icon: TrendingUp, label: 'En progression', color: 'text-emerald-400' },
  down: { icon: TrendingDown, label: 'À surveiller', color: 'text-red-400' },
  stable: { icon: Minus, label: 'Stable', color: 'text-neutral-400' },
} as const;

// Convention: ↗ En progression / → Stable / ↘ À surveiller
// Icon and label are always coherent — no contradictory combinations.

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

export function NexusIndexCard({ studentId }: NexusIndexCardProps) {
  const [index, setIndex] = useState<NexusIndexResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchIndex() {
      try {
        const params = studentId ? `?studentId=${studentId}` : '';
        const res = await fetch(`/api/student/nexus-index${params}`);
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
  }, [studentId]);

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
          <h3 className="text-sm font-semibold text-neutral-200">Indice de trajectoire</h3>
        </div>
        <p className="text-xs text-neutral-500">
          Aucune donnée disponible pour le moment.
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
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-neutral-200">Indice de trajectoire</h3>
        </div>
        <div className={`flex items-center gap-1 text-xs ${trendCfg.color}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span>{trendCfg.label}</span>
        </div>
      </div>
      <p className="text-[11px] text-neutral-500 mb-5">
        Indicateur synthétique sur 30 jours.
      </p>

      {/* Score central */}
      <div className="flex items-center justify-center mb-2">
        <div className={`relative flex items-center justify-center w-20 h-20 rounded-full ${levelCfg.bg}`}>
          <span className="text-2xl font-bold text-neutral-100">{index.globalScore}</span>
        </div>
      </div>
      <p className={`text-center text-xs font-medium mb-5 ${levelCfg.color}`}>
        {getScoreMessage(index.globalScore)}
      </p>

      {/* Pillar breakdown */}
      <div className="space-y-3">
        {index.pillars.map((pillar) => (
          <PillarBar
            key={pillar.key}
            label={PILLAR_LABELS[pillar.key] ?? pillar.label}
            score={pillar.score}
          />
        ))}
      </div>
    </div>
  );
}
