'use client';

import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { TrajectoireTimeline } from './TrajectoireTimeline';
import type { TimelineTrajectory } from './TrajectoireTimeline';
import type { DashboardRole } from './DashboardPilotage';

/**
 * TrajectoireCard — Votre trajectoire.
 *
 * Dual API:
 * - data mode: receives pre-fetched trajectory (from dashboard payload — preferred for ELEVE)
 * - fetch mode: fetches /api/student/trajectory on mount (for coach/parent views)
 *
 * Micro-copy: "Objectif défini et jalons intermédiaires."
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape of pre-fetched trajectory from the dashboard payload */
export type TrajectoireDataProp = {
  id: string | null;
  title: string | null;
  progress: number;
  daysRemaining: number;
  milestones: Array<{
    id: string;
    title: string;
    targetDate: string;
    completed: boolean;
    completedAt: string | null;
  }>;
};

type TrajectoireCardPropsWithData = {
  /** Pre-fetched trajectory — skips internal fetch */
  data: TrajectoireDataProp;
  studentId?: never;
  role?: DashboardRole;
};

type TrajectoireCardPropsWithFetch = {
  data?: never;
  /** Student ID for scoped fetch */
  studentId?: string | null;
  /** Role for conditional CTAs in timeline */
  role?: DashboardRole;
};

type TrajectoireCardProps = TrajectoireCardPropsWithData | TrajectoireCardPropsWithFetch;

// ─── Helper ───────────────────────────────────────────────────────────────────

function dataPropToTimeline(data: TrajectoireDataProp): TimelineTrajectory | null {
  if (!data.id || !data.title) return null;
  return {
    id: data.id,
    title: data.title,
    progress: data.progress,
    daysRemaining: data.daysRemaining,
    milestones: data.milestones,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrajectoireCard(props: TrajectoireCardProps) {
  const role = props.role ?? 'ELEVE';
  const isDataMode = 'data' in props && props.data !== undefined;
  const dataProp = isDataMode ? (props as TrajectoireCardPropsWithData).data : undefined;

  const [trajectory, setTrajectory] = useState<TimelineTrajectory | null>(null);
  const [loading, setLoading] = useState(!isDataMode);

  useEffect(() => {
    // Data mode — derive from dataProp on every change, no stale state risk
    if (isDataMode) {
      setTrajectory(dataPropToTimeline(dataProp!));
      return;
    }

    let cancelled = false;

    async function fetchTrajectory() {
      try {
        const params = props.studentId ? `?studentId=${props.studentId}` : '';
        const res = await fetch(`/api/student/trajectory${params}`);
        if (!res.ok) {
          if (!cancelled) setTrajectory(null);
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        if (data.trajectory) {
          setTrajectory({
            id: data.trajectory.id,
            title: data.trajectory.title,
            progress: data.trajectory.progress,
            daysRemaining: data.trajectory.daysRemaining,
            milestones: data.trajectory.milestones ?? [],
          });
        } else {
          setTrajectory(null);
        }
      } catch {
        if (!cancelled) setTrajectory(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTrajectory();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataMode, props.studentId, dataProp]);

  // In data mode, loading is false from the start
  const isLoading = isDataMode ? false : loading;

  return (
    <div className="rounded-xl border border-neutral-800 bg-surface-card p-6 relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-neutral-200">Votre trajectoire</h3>
        </div>
        <p className="text-[11px] text-neutral-500 mb-3">
          Objectif défini et jalons intermédiaires.
        </p>

        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-1 rounded bg-neutral-800" />
            <div className="h-3 w-32 rounded bg-neutral-800" />
            <div className="h-3 w-48 rounded bg-neutral-800" />
          </div>
        ) : (
          <TrajectoireTimeline trajectory={trajectory} role={role} />
        )}
      </div>
    </div>
  );
}
