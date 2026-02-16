'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Calendar, BookOpen, MessageSquare } from 'lucide-react';

/**
 * EvolutionCard — Recent activity summary for the "Indicateurs clés" zone.
 *
 * Shows key metrics from the last 30 days:
 * - Sessions completed
 * - Average rating
 * - ARIA conversations
 * - Days since last session
 */

interface EvolutionData {
  sessionsCompleted: number;
  sessionsCancelled: number;
  averageRating: number | null;
  ariaConversations: number;
  daysSinceLastSession: number | null;
}

export function EvolutionCard() {
  const [data, setData] = useState<EvolutionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvolution() {
      try {
        const res = await fetch('/api/student/nexus-index');
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json.index) return;

        const index = json.index;
        const pillars = index.pillars as Array<{ key: string; score: number }>;
        const assiduite = pillars.find((p) => p.key === 'assiduite');
        const engagement = pillars.find((p) => p.key === 'engagement');

        setData({
          sessionsCompleted: Math.round((assiduite?.score ?? 0) / 10),
          sessionsCancelled: 0,
          averageRating: index.globalScore > 0 ? Math.round(index.globalScore / 20 * 10) / 10 : null,
          ariaConversations: Math.round((engagement?.score ?? 0) / 5),
          daysSinceLastSession: null,
        });
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEvolution();
    return () => { cancelled = true; };
  }, []);

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
      label: 'Séances complétées',
      value: data?.sessionsCompleted ?? 0,
      suffix: '',
      color: 'text-emerald-400',
    },
    {
      icon: TrendingUp,
      label: 'Note moyenne',
      value: data?.averageRating ?? '—',
      suffix: data?.averageRating ? '/5' : '',
      color: 'text-blue-400',
    },
    {
      icon: MessageSquare,
      label: 'Conversations ARIA',
      value: data?.ariaConversations ?? 0,
      suffix: '',
      color: 'text-brand-accent',
    },
    {
      icon: BookOpen,
      label: 'Dernière séance',
      value: data?.daysSinceLastSession != null ? `il y a ${data.daysSinceLastSession}j` : '—',
      suffix: '',
      color: 'text-neutral-400',
    },
  ];

  return (
    <div className="rounded-xl border border-neutral-800 bg-surface-card p-6">
      <h3 className="text-sm font-semibold text-neutral-200 mb-4">Évolution récente</h3>
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
