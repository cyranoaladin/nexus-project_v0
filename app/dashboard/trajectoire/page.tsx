'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  TrendingUp,
  Flag,
} from 'lucide-react';

/**
 * /dashboard/trajectoire
 *
 * Full-page trajectory view for students.
 * Fetches from /api/student/trajectory and displays milestones,
 * progress, and timeline in an expanded layout.
 */

interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate: string;
  completed: boolean;
  completedAt?: string;
}

interface Trajectory {
  id: string;
  title: string;
  description?: string;
  status: string;
  horizon?: string;
  startDate: string;
  endDate: string;
  progress: number;
  daysRemaining: number;
  milestones: Milestone[];
  nextMilestoneDate?: string | null;
  nextMilestoneTitle?: string | null;
}

export default function TrajectoirePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/dashboard/trajectoire');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;

    async function fetchTrajectory() {
      try {
        const res = await fetch('/api/student/trajectory');
        if (!res.ok) {
          if (!cancelled) setError('Impossible de charger la trajectoire');
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setTrajectory(data.trajectory ?? null);
        }
      } catch {
        if (!cancelled) setError('Erreur de connexion');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTrajectory();
    return () => { cancelled = true; };
  }, [status]);

  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const backLink = userRole === 'PARENT' ? '/dashboard/parent' : '/dashboard/eleve';

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-surface-dark p-6 md:p-10">
        <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
          <div className="h-8 w-64 rounded bg-neutral-800" />
          <div className="h-4 w-96 rounded bg-neutral-800" />
          <div className="h-2 rounded-full bg-neutral-800" />
          <div className="space-y-4 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-neutral-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-dark p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <Link href={backLink} className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 mb-6">
            <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
          </Link>
          <div className="rounded-xl border border-red-500/30 bg-surface-card p-8 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!trajectory) {
    return (
      <div className="min-h-screen bg-surface-dark p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <Link href={backLink} className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 mb-6">
            <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
          </Link>
          <div className="rounded-xl border border-neutral-800 bg-surface-card p-10 text-center">
            <Target className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-neutral-200 mb-2">Aucune trajectoire définie</h2>
            <p className="text-sm text-neutral-400 max-w-md mx-auto">
              Votre trajectoire sera créée par votre coach après votre première séance.
              Elle définira vos objectifs et jalons intermédiaires pour suivre votre progression.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = trajectory.milestones.filter((m) => m.completed).length;
  const totalCount = trajectory.milestones.length;
  const sortedMilestones = [...trajectory.milestones].sort(
    (a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
  );

  return (
    <div className="min-h-screen bg-surface-dark p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <Link href={backLink} className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 mb-6">
          <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
        </Link>

        {/* Header */}
        <div className="rounded-xl border border-neutral-800 bg-surface-card p-6 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-primary/10">
                <Target className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-100">{trajectory.title}</h1>
                {trajectory.description && (
                  <p className="text-sm text-neutral-400 mt-0.5">{trajectory.description}</p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Progression
                </span>
                <span className="font-medium text-neutral-200">{Math.round(trajectory.progress)}%</span>
              </div>
              <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-500"
                  style={{ width: `${Math.min(trajectory.progress, 100)}%` }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 mt-4 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                {completedCount}/{totalCount} jalons
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {trajectory.daysRemaining > 0
                  ? `${trajectory.daysRemaining} jours restants`
                  : 'Échéance dépassée'}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(trajectory.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {' → '}
                {new Date(trajectory.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Milestones timeline */}
        <div className="space-y-0">
          <h2 className="text-sm font-semibold text-neutral-300 mb-4 flex items-center gap-2">
            <Flag className="h-4 w-4 text-brand-primary" />
            Jalons ({totalCount})
          </h2>

          {sortedMilestones.length === 0 ? (
            <div className="rounded-xl border border-neutral-800 bg-surface-card p-6 text-center">
              <p className="text-sm text-neutral-500">Aucun jalon défini pour cette trajectoire.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-neutral-800" />

              {sortedMilestones.map((milestone, index) => {
                const isLast = index === sortedMilestones.length - 1;
                const isPast = new Date(milestone.targetDate) < new Date();

                return (
                  <div key={milestone.id} className={`relative flex gap-4 ${isLast ? '' : 'pb-6'}`}>
                    {/* Dot */}
                    <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 h-10">
                      {milestone.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                      ) : isPast ? (
                        <Clock className="h-5 w-5 text-amber-400" />
                      ) : (
                        <Circle className="h-5 w-5 text-neutral-600" />
                      )}
                    </div>

                    {/* Content */}
                    <div
                      className={`flex-1 rounded-xl border p-4 transition-colors ${
                        milestone.completed
                          ? 'border-green-500/20 bg-green-500/5'
                          : isPast
                            ? 'border-amber-500/20 bg-amber-500/5'
                            : 'border-neutral-800 bg-surface-card'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-sm font-medium ${milestone.completed ? 'text-green-300' : 'text-neutral-200'}`}>
                          {milestone.title}
                        </p>
                        <span className="text-[11px] text-neutral-500">
                          {new Date(milestone.targetDate).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      {milestone.description && (
                        <p className="text-xs text-neutral-400 mt-1">{milestone.description}</p>
                      )}
                      {milestone.completed && milestone.completedAt && (
                        <p className="text-[11px] text-green-500/70 mt-1.5">
                          ✓ Validé le {new Date(milestone.completedAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
