'use client';

import Link from 'next/link';
import { Check, Circle, ChevronRight, ArrowRight, Plus } from 'lucide-react';
import type { DashboardRole } from './DashboardPilotage';

/**
 * TrajectoireTimeline — Visual vertical timeline (Past / Now / Next).
 *
 * Premium lite: sober, structured, strategic.
 * Shows immediately: where we are, what's validated, next milestone, and the cap.
 *
 * Inputs:
 * - milestones[] from trajectory engine (parsed via parseMilestones)
 * - trajectory metadata (title, progress, daysRemaining)
 * - role for conditional CTAs
 *
 * Sections:
 * 1. Validé (Past) — max 2 items + "Voir tout"
 * 2. En cours (Now) — 1 dominant item
 * 3. Prochain jalon (Next) — 1 item with CTA
 *
 * Empty states:
 * - No trajectory → placeholder + "Définir ma trajectoire"
 * - Trajectory but no milestones → "Ajouter un premier jalon" (coach/admin)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TimelineMilestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
  completedAt: string | null;
}

export interface TimelineTrajectory {
  id: string;
  title: string;
  progress: number;
  daysRemaining: number;
  milestones: TimelineMilestone[];
}

interface TrajectoireTimelineProps {
  /** Trajectory data (null = no trajectory defined) */
  trajectory: TimelineTrajectory | null;
  /** User role for conditional CTAs */
  role: DashboardRole;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

/** Classify milestones into past/now/next buckets */
export function classifyMilestones(milestones: TimelineMilestone[]) {
  const sorted = [...milestones].sort(
    (a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
  );

  const completed = sorted.filter((m) => m.completed);
  const remaining = sorted.filter((m) => !m.completed);

  const current = remaining[0] ?? null;
  const next = remaining[1] ?? null;

  return { completed, current, next };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TimelineNode({
  status,
}: {
  status: 'completed' | 'current' | 'upcoming';
}) {
  if (status === 'completed') {
    return (
      <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50">
        <Check className="h-3 w-3 text-emerald-400" />
      </div>
    );
  }
  if (status === 'current') {
    return (
      <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary/20 border-2 border-brand-primary ring-2 ring-brand-primary/20">
        <Circle className="h-2.5 w-2.5 text-brand-primary fill-brand-primary" />
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-neutral-800 border-2 border-neutral-700">
      <Circle className="h-2.5 w-2.5 text-neutral-600" />
    </div>
  );
}

function TimelineItem({
  milestone,
  status,
  isLast,
}: {
  milestone: TimelineMilestone;
  status: 'completed' | 'current' | 'upcoming';
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      {/* Vertical line + node */}
      <div className="flex flex-col items-center">
        <TimelineNode status={status} />
        {!isLast && (
          <div
            className={`w-px flex-1 min-h-[20px] ${
              status === 'completed' ? 'bg-emerald-500/30' : 'bg-neutral-800'
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div className={`pb-4 min-w-0 ${isLast ? '' : ''}`}>
        <p
          className={`text-xs font-medium leading-tight ${
            status === 'completed'
              ? 'text-neutral-500 line-through'
              : status === 'current'
                ? 'text-neutral-100'
                : 'text-neutral-400'
          }`}
        >
          {milestone.title}
        </p>
        <p className="text-[10px] text-neutral-600 mt-0.5">
          {status === 'completed' && milestone.completedAt
            ? `Validé le ${formatDate(milestone.completedAt)}`
            : formatDate(milestone.targetDate)}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TrajectoireTimeline({ trajectory, role }: TrajectoireTimelineProps) {
  const canManage = role === 'COACH' || role === 'ADMIN';
  const isStudent = role === 'ELEVE' || role === 'PARENT';

  // ─── Empty state: no trajectory ─────────────────────────────────────────
  if (!trajectory) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-neutral-500 leading-relaxed">
          Définissez un cap clair pour structurer votre progression.
        </p>
        <div className="flex items-center gap-0">
          <div className="w-3 h-3 rounded-full bg-brand-primary/30 border-2 border-brand-primary/50" />
          <div className="flex-1 h-px bg-neutral-700" />
          <div className="w-3 h-3 rounded-full bg-neutral-700 border-2 border-neutral-600" />
          <div className="flex-1 h-px bg-neutral-800" />
          <div className="w-3 h-3 rounded-full bg-neutral-800 border-2 border-neutral-700" />
        </div>
        <div className="flex justify-between">
          <span className="text-[9px] text-neutral-600">Aujourd&apos;hui</span>
          <span className="text-[9px] text-neutral-700">3 mois</span>
          <span className="text-[9px] text-neutral-700">6 mois</span>
        </div>
        {isStudent && (
          <Link
            href="/dashboard/trajectoire"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors mt-1"
          >
            Définir ma trajectoire
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    );
  }

  const { milestones } = trajectory;

  // ─── Empty milestones ───────────────────────────────────────────────────
  if (milestones.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-400">Cap : {trajectory.title}</p>
          <span className="text-[10px] text-neutral-600">{trajectory.daysRemaining}j restants</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-brand-primary/60 transition-all duration-700"
            style={{ width: `${trajectory.progress}%` }}
          />
        </div>
        <p className="text-xs text-neutral-500">Aucun jalon défini.</p>
        {canManage && (
          <Link
            href={`/dashboard/trajectoire/${trajectory.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-700 text-neutral-300 hover:text-neutral-100 hover:border-neutral-600 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Ajouter un premier jalon
          </Link>
        )}
        {isStudent && (
          <Link
            href="/dashboard/trajectoire"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Ajuster mon cap
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    );
  }

  // ─── Classify milestones ────────────────────────────────────────────────
  const { completed, current, next } = classifyMilestones(milestones);
  const hiddenCount = Math.max(0, completed.length - 2);
  const visibleCompleted = completed.slice(-2);
  const totalMilestones = milestones.length;

  return (
    <div className="space-y-3">
      {/* Header: cap title — progress is secondary/textual, not visual center */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-300 truncate font-medium">Cap : {trajectory.title}</p>
        <span className="text-[10px] text-neutral-600 flex-shrink-0">{trajectory.daysRemaining}j restants</span>
      </div>

      {/* Discreet progress — thin, secondary */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-0.5 rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-brand-primary/40 transition-all duration-700"
            style={{ width: `${trajectory.progress}%` }}
          />
        </div>
        <span className="text-[9px] text-neutral-600">{trajectory.progress}%</span>
      </div>

      {/* Timeline — strict: max 2 past + 1 now + 1 next */}
      <div className="pt-1">
        {/* Collapsed past overflow */}
        {hiddenCount > 0 && (
          <div className="flex items-center gap-3 pb-2">
            <div className="flex flex-col items-center">
              <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10">
                <span className="text-[9px] font-medium text-emerald-500">{hiddenCount}+</span>
              </div>
              <div className="w-px flex-1 min-h-[8px] bg-emerald-500/30" />
            </div>
            <p className="text-[10px] text-neutral-600 pb-2">
              {hiddenCount} jalon{hiddenCount > 1 ? 's' : ''} validé{hiddenCount > 1 ? 's' : ''}
            </p>
          </div>
        )}

        {visibleCompleted.map((m) => (
          <TimelineItem key={m.id} milestone={m} status="completed" isLast={false} />
        ))}

        {/* Now: current milestone — visual priority */}
        {current && (
          <TimelineItem
            milestone={current}
            status="current"
            isLast={!next}
          />
        )}

        {/* Next: upcoming milestone */}
        {next && (
          <TimelineItem milestone={next} status="upcoming" isLast={true} />
        )}
      </div>

      {/* CTAs — premium, role-appropriate */}
      <div className="flex items-center gap-2 pt-1">
        {/* Coach/Admin only: manage milestone */}
        {canManage && current && (
          <Link
            href={`/dashboard/trajectoire/${trajectory.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-neutral-700 text-neutral-300 hover:text-neutral-100 hover:border-neutral-600 transition-colors"
          >
            Marquer comme validé
          </Link>
        )}
        {/* Student/Parent: view + adjust */}
        {isStudent && (
          <>
            <Link
              href="/dashboard/trajectoire"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Ajuster mon cap
              <ChevronRight className="h-3 w-3" />
            </Link>
            {totalMilestones > 4 && (
              <Link
                href="/dashboard/trajectoire"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Voir tous les jalons
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
