'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Zap,
  AlertTriangle,
  Info,
  ChevronRight,
  type LucideIcon,
  UserPlus,
  CreditCard,
  Coins,
  CalendarPlus,
  BookOpen,
  ClipboardCheck,
  Clock,
  Calendar,
  Users,
  FileText,
  Shield,
  BarChart3,
  TrendingUp,
  CheckCircle,
  ShieldAlert,
  UserCog,
  CalendarCheck,
  Inbox,
} from 'lucide-react';
import type { NextStep, StepPriority } from '@/lib/next-step-engine';

/**
 * NextStepCard — Action prioritaire.
 *
 * Micro-copy pack: premium lite, verbes d'action, trajectoire vocabulary.
 * Role-agnostic: fetches from /api/me/next-step.
 */

const PRIORITY_STYLES: Record<StepPriority, { border: string; accent: string; icon: LucideIcon }> = {
  critical: { border: 'border-slate-500/40', accent: 'text-slate-300', icon: AlertTriangle },
  high: { border: 'border-blue-500/30', accent: 'text-blue-300', icon: Zap },
  medium: { border: 'border-brand-primary/30', accent: 'text-brand-primary', icon: Info },
  low: { border: 'border-neutral-700', accent: 'text-neutral-400', icon: ChevronRight },
};

const ICON_MAP: Record<string, LucideIcon> = {
  UserPlus,
  CreditCard,
  Coins,
  CalendarPlus,
  BookOpen,
  ClipboardCheck,
  Clock,
  Calendar,
  Users,
  FileText,
  Shield,
  BarChart3,
  Zap,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  ShieldAlert,
  UserCog,
  CalendarCheck,
  Inbox,
};

// ─── Micro-copy: titles per step type ────────────────────────────────────────

const STEP_TITLES: Record<string, string> = {
  // Parent
  ADD_CHILD: 'Ajoutez votre enfant',
  SUBSCRIBE: 'Choisissez une formule',
  BUY_CREDITS: 'Rechargez vos crédits',
  BOOK_SESSION: 'Réservez une séance',
  UPCOMING_SESSION: 'Séance à venir',
  VIEW_PROGRESS: 'Consultez la progression',
  // Élève
  ACTIVATE_ACCOUNT: 'Activez votre compte',
  WAIT_PARENT: 'Inscription en cours',
  VIEW_SESSION: 'Prochaine séance',
  EXPLORE_RESOURCES: 'Ressources disponibles',
  // Coach
  COMPLETE_PROFILE: 'Complétez votre profil',
  SUBMIT_REPORT: 'Finalisez un compte-rendu',
  TODAY_SESSIONS: 'Séances du jour',
  SET_AVAILABILITY: 'Planifiez vos créneaux',
  ALL_GOOD: 'Tout est à jour',
  // Assistante
  PROCESS_SUBSCRIPTIONS: 'Demandes en attente',
  PROCESS_PAYMENTS: 'Paiements à valider',
  ALL_CLEAR: 'Aucune action urgente',
  // Admin
  REVIEW_FAILED_PAYMENTS: 'Paiements à examiner',
  VIEW_METRICS: 'Vue d\'ensemble',
};

// ─── Micro-copy: CTA labels per step type ────────────────────────────────────

const CTA_LABELS: Record<string, string> = {
  // Parent
  ADD_CHILD: 'Ajouter',
  SUBSCRIBE: 'Voir les offres',
  BUY_CREDITS: 'Recharger',
  BOOK_SESSION: 'Réserver',
  UPCOMING_SESSION: 'Voir',
  VIEW_PROGRESS: 'Consulter',
  // Élève
  ACTIVATE_ACCOUNT: 'Activer',
  VIEW_SESSION: 'Accéder',
  EXPLORE_RESOURCES: 'Découvrir',
  // Coach
  COMPLETE_PROFILE: 'Compléter',
  SUBMIT_REPORT: 'Finaliser',
  TODAY_SESSIONS: 'Voir',
  SET_AVAILABILITY: 'Configurer',
  ALL_GOOD: 'Consulter',
  // Assistante
  PROCESS_SUBSCRIPTIONS: 'Traiter',
  PROCESS_PAYMENTS: 'Valider',
  ALL_CLEAR: 'Consulter',
  // Admin
  REVIEW_FAILED_PAYMENTS: 'Examiner',
  VIEW_METRICS: 'Consulter',
};

export function NextStepCard() {
  const [step, setStep] = useState<NextStep | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStep() {
      try {
        const res = await fetch('/api/me/next-step');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.step) {
          setStep(data.step);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStep();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-surface-card p-5 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-neutral-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-neutral-800" />
            <div className="h-3 w-64 rounded bg-neutral-800" />
          </div>
          <div className="h-8 w-24 rounded-lg bg-neutral-800" />
        </div>
      </div>
    );
  }

  if (!step) return null;

  const priority = step.priority as StepPriority;
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
  const StepIcon = (step.icon && ICON_MAP[step.icon]) || style.icon;

  const title = STEP_TITLES[step.type] || 'Action prioritaire';
  const description = step.message;
  const ctaLabel = CTA_LABELS[step.type] || 'Continuer';

  const isHighPriority = priority === 'critical' || priority === 'high';

  /** Fire lightweight analytics event (non-blocking) */
  function trackClick() {
    if (!step) return;
    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'next_step_click',
          stepType: step.type,
          priority,
        }),
      }).catch(() => { /* analytics is best-effort */ });
    } catch {
      // Never block UX for analytics
    }
  }

  return (
    <div
      className={`rounded-xl border ${style.border} bg-surface-card px-6 py-6 transition-colors ${isHighPriority ? 'ring-1 ring-brand-primary/20' : ''}`}
      role="region"
      aria-label={`Action prioritaire : ${title}`}
    >
      <div className="flex items-center gap-5">
        {/* Icon — larger for dominance */}
        <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-surface-elevated ${style.accent}`}>
          <StepIcon className="h-6 w-6" aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Action prioritaire</p>
            {isHighPriority && (
              <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded ${priority === 'critical' ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-300'}`}>
                Priorité
              </span>
            )}
          </div>
          <p className="text-base font-semibold text-neutral-100">{title}</p>
          <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{description}</p>
        </div>

        {/* CTA — large primary button */}
        <div className="flex-shrink-0">
          {step.link && (
            <Link
              href={step.link}
              onClick={trackClick}
              aria-label={`${ctaLabel} — ${title}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 shadow-sm transition-all"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
