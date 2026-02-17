'use client';

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle, Activity, BarChart3 } from 'lucide-react';

/**
 * EvolutionCard — Synthèse des 30 derniers jours.
 *
 * Micro-copy pack: "Évolution récente", trajectoire vocabulary.
 * Accepts optional studentId for parent multi-children scope.
 */

interface EvolutionCardProps {
  /** Student ID for scoped fetch (parent multi-children) */
  studentId?: string | null;
}

interface EvolutionData {
  sessionsCompleted: number;
  globalScore: number;
  engagement: number;
  regularite: number;
}

export function EvolutionCard({ studentId }: EvolutionCardProps) {
  const [data, setData] = useState<EvolutionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvolution() {
      try {
        const params = studentId ? `?studentId=${studentId}` : '';
        const res = await fetch(`/api/student/nexus-index${params}`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json.index) return;

        const index = json.index;
        const pillars = index.pillars as Array<{ key: string; score: number }>;
        const assiduite = pillars.find((p) => p.key === 'assiduite');
        const engagement = pillars.find((p) => p.key === 'engagement');
        const regularite = pillars.find((p) => p.key === 'regularite');

        setData({
          sessionsCompleted: Math.round((assiduite?.score ?? 0) / 10),
          globalScore: index.globalScore,
          engagement: engagement?.score ?? 0,
          regularite: regularite?.score ?? 0,
        });
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEvolution();
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-surface-card p-6 animate-pulse">
        <div className="h-4 w-40 rounded bg-neutral-800 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-neutral-800" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = [
    {
      icon: Calendar,
      label: 'Séances réalisées',
      value: data?.sessionsCompleted ?? 0,
      suffix: '',
      color: 'text-emerald-400',
    },
    {
      icon: CheckCircle,
      label: 'Travail validé',
      value: data?.globalScore ?? 0,
      suffix: '/100',
      color: 'text-blue-400',
    },
    {
      icon: Activity,
      label: 'Engagement',
      value: data?.engagement ?? 0,
      suffix: '/100',
      color: 'text-brand-accent',
    },
    {
      icon: BarChart3,
      label: 'Stabilité',
      value: data?.regularite ?? 0,
      suffix: '/100',
      color: 'text-neutral-300',
    },
  ];

  return (
    <div className="rounded-xl border border-neutral-800 bg-surface-card p-6">
      <h3 className="text-sm font-semibold text-neutral-200 mb-1">Évolution récente</h3>
      <p className="text-[11px] text-neutral-500 mb-4">Synthèse des 30 derniers jours.</p>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex items-start gap-3 rounded-lg bg-surface-elevated p-3"
          >
            <metric.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${metric.color}`} />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-100 leading-tight">
                {metric.value}
                {metric.suffix && (
                  <span className="text-xs text-neutral-500 ml-0.5">{metric.suffix}</span>
                )}
              </p>
              <p className="text-[10px] text-neutral-500 mt-0.5">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
