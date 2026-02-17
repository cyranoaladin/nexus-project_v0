'use client';

import { useEffect, useState } from 'react';
import { Calendar, Users, FileText, Clock } from 'lucide-react';

/**
 * CoachOverviewCard — Replaces NexusIndexCard for coach role.
 *
 * Shows coach-centric metrics: sessions this week, students followed,
 * reports pending, next availability.
 */

interface CoachMetrics {
  weekSessions: number;
  completedSessions: number;
  studentsCount: number;
  pendingReports: number;
}

export function CoachOverviewCard() {
  const [data, setData] = useState<CoachMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      try {
        const res = await fetch('/api/coach/dashboard');
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;

        setData({
          weekSessions: json.weekStats?.totalSessions ?? 0,
          completedSessions: json.weekStats?.completedSessions ?? 0,
          studentsCount: json.uniqueStudentsCount ?? 0,
          pendingReports: json.todaySessions?.filter(
            (s: { status: string }) => s.status === 'CONFIRMED' || s.status === 'IN_PROGRESS'
          ).length ?? 0,
        });
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMetrics();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-surface-card p-6 animate-pulse">
        <div className="h-4 w-36 rounded bg-neutral-800 mb-4" />
        <div className="grid grid-cols-2 gap-3">
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
      label: 'Séances cette semaine',
      value: data?.weekSessions ?? 0,
      color: 'text-brand-accent',
    },
    {
      icon: Users,
      label: 'Élèves suivis',
      value: data?.studentsCount ?? 0,
      color: 'text-emerald-400',
    },
    {
      icon: FileText,
      label: 'Comptes-rendus à finaliser',
      value: data?.pendingReports ?? 0,
      color: data?.pendingReports ? 'text-amber-400' : 'text-neutral-400',
    },
    {
      icon: Clock,
      label: 'Séances réalisées',
      value: data?.completedSessions ?? 0,
      color: 'text-blue-400',
    },
  ];

  return (
    <div className="rounded-xl border border-neutral-800 bg-surface-card p-6">
      <h3 className="text-sm font-semibold text-neutral-200 mb-1">Indice de suivi</h3>
      <p className="text-[11px] text-neutral-500 mb-4">Vue opérationnelle de votre activité.</p>
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
              </p>
              <p className="text-[10px] text-neutral-500 mt-0.5">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
