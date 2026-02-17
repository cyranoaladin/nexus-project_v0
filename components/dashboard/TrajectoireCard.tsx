'use client';

import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { TrajectoireTimeline } from './TrajectoireTimeline';
import type { TimelineTrajectory } from './TrajectoireTimeline';
import type { DashboardRole } from './DashboardPilotage';

/**
 * TrajectoireCard — Votre trajectoire.
 *
 * Micro-copy: "Objectif défini et jalons intermédiaires."
 * Connected to /api/student/trajectory.
 * Renders TrajectoireTimeline when data is present, placeholder otherwise.
 */

interface TrajectoireCardProps {
  /** Student ID for scoped fetch */
  studentId?: string | null;
  /** Role for conditional CTAs in timeline */
  role?: DashboardRole;
}

export function TrajectoireCard({ studentId, role = 'ELEVE' }: TrajectoireCardProps) {
  const [trajectory, setTrajectory] = useState<TimelineTrajectory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchTrajectory() {
      try {
        const params = studentId ? `?studentId=${studentId}` : '';
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
  }, [studentId]);

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

        {loading ? (
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
