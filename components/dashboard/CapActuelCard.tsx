'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, ArrowRight } from 'lucide-react';

/**
 * CapActuelCard — Bandeau stratégique "Votre cap actuel".
 *
 * Donne une direction avant les chiffres.
 * Sobre, structurant, premium.
 *
 * - Si trajectoire active : affiche objectif + prochaine échéance
 * - Si aucune trajectoire : message d'invitation + CTA
 */

interface TrajectoryInfo {
  id: string;
  title: string;
  nextMilestoneDate: string | null;
  nextMilestoneTitle: string | null;
  status: string;
  progress: number;
  daysRemaining: number;
}

interface CapActuelCardProps {
  /** Student ID for scoped fetch */
  studentId?: string | null;
}

export function CapActuelCard({ studentId }: CapActuelCardProps) {
  const [trajectory, setTrajectory] = useState<TrajectoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchTrajectory() {
      try {
        const params = studentId ? `?studentId=${studentId}` : '';
        const res = await fetch(`/api/student/trajectory${params}`);
        if (!res.ok) {
          if (!cancelled) setHasData(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        if (data.trajectory) {
          setTrajectory(data.trajectory);
          setHasData(true);
        } else {
          setHasData(false);
        }
      } catch {
        if (!cancelled) setHasData(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTrajectory();
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800/60 bg-gradient-to-r from-surface-card to-surface-elevated p-5 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded bg-neutral-800" />
          <div className="h-4 w-40 rounded bg-neutral-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800/60 bg-gradient-to-r from-surface-card to-surface-elevated px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Compass className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1">Votre cap actuel</p>
            {hasData && trajectory ? (
              <>
                <p className="text-sm font-semibold text-neutral-100 truncate">
                  Cap défini : {trajectory.title}
                </p>
                {trajectory.nextMilestoneDate && (
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Prochaine échéance : {new Date(trajectory.nextMilestoneDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-neutral-400">
                Aucun cap formalisé pour le moment.
              </p>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          {hasData && trajectory ? (
            <Link
              href="/dashboard/trajectoire"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-300 hover:text-neutral-100 border border-neutral-700 hover:border-neutral-600 transition-colors"
            >
              Ajuster mon cap
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : (
            <Link
              href="/dashboard/trajectoire"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
            >
              Définir ma trajectoire
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
