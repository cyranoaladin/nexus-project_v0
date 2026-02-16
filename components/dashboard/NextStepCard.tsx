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
} from 'lucide-react';
import type { NextStep, StepPriority } from '@/lib/next-step-engine';

/**
 * NextStepCard — Premium "next action" recommendation card.
 *
 * Role-agnostic: accepts a structured NextStep object.
 * Positioned at the top of the dashboard ("Prochaine action" zone).
 *
 * Props:
 * - title: Card heading (optional override)
 * - description: Subtitle (optional override)
 * - ctaPrimary: Primary CTA label (optional override)
 * - ctaSecondary: Secondary CTA (optional)
 * - type: Step type for tracking
 */

interface NextStepCardProps {
  /** Override the card title */
  title?: string;
  /** Override the card description */
  description?: string;
  /** Override primary CTA label */
  ctaPrimary?: string;
  /** Secondary CTA (optional) */
  ctaSecondary?: { label: string; href: string };
  /** Override step type for tracking */
  type?: string;
}

const PRIORITY_STYLES: Record<StepPriority, { border: string; accent: string; icon: LucideIcon }> = {
  critical: { border: 'border-red-500/40', accent: 'text-red-400', icon: AlertTriangle },
  high: { border: 'border-amber-500/30', accent: 'text-amber-400', icon: Zap },
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
};

export function NextStepCard(props: NextStepCardProps) {
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

  const title = props.title || getTitle(step);
  const description = props.description || step.message;
  const ctaLabel = props.ctaPrimary || getCTALabel(step);

  return (
    <div className={`rounded-xl border ${style.border} bg-surface-card p-5 transition-colors`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-surface-elevated ${style.accent}`}>
          <StepIcon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-100">{title}</p>
          <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{description}</p>
        </div>

        {/* CTAs */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {props.ctaSecondary && (
            <Link
              href={props.ctaSecondary.href}
              className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors hidden sm:block"
            >
              {props.ctaSecondary.label}
            </Link>
          )}
          {step.link && (
            <Link
              href={step.link}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
            >
              {ctaLabel}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** Map step types to human-readable titles */
function getTitle(step: NextStep): string {
  const titles: Record<string, string> = {
    ADD_CHILD: 'Ajoutez votre enfant',
    SUBSCRIBE: 'Choisissez un abonnement',
    BUY_CREDITS: 'Rechargez vos crédits',
    BOOK_SESSION: 'Réservez une séance',
    ACTIVATE_ACCOUNT: 'Activez votre compte',
    COMPLETE_PROFILE: 'Complétez votre profil',
    SUBMIT_REPORT: 'Rédigez un compte-rendu',
    TODAY_SESSIONS: 'Séances du jour',
    SET_AVAILABILITY: 'Définissez vos disponibilités',
    REVIEW_REQUESTS: 'Demandes en attente',
    PENDING_PAYMENTS: 'Paiements à valider',
    UNASSIGNED_SESSIONS: 'Sessions à assigner',
    PLATFORM_OVERVIEW: 'Vue d\'ensemble',
  };
  return titles[step.type] || 'Prochaine étape';
}

/** Map step types to CTA labels */
function getCTALabel(step: NextStep): string {
  const labels: Record<string, string> = {
    ADD_CHILD: 'Ajouter',
    SUBSCRIBE: 'Voir les offres',
    BUY_CREDITS: 'Recharger',
    BOOK_SESSION: 'Réserver',
    ACTIVATE_ACCOUNT: 'Activer',
    COMPLETE_PROFILE: 'Compléter',
    SUBMIT_REPORT: 'Rédiger',
    TODAY_SESSIONS: 'Voir',
    SET_AVAILABILITY: 'Configurer',
    REVIEW_REQUESTS: 'Traiter',
    PENDING_PAYMENTS: 'Valider',
    UNASSIGNED_SESSIONS: 'Assigner',
    PLATFORM_OVERVIEW: 'Consulter',
  };
  return labels[step.type] || 'Continuer';
}
