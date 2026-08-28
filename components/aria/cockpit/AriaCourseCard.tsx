'use client';

/**
 * Carte d'un cours dans la carte scolaire.
 *
 * Affiche les quatre dimensions d'accès SANS jamais les confondre :
 * suivi en classe / supporté par ARIA / ouvert commercialement / retenu.
 */

import { Lock, GraduationCap, Check } from 'lucide-react';
import type { AriaCourseView } from '@/lib/aria/contracts';
import { SUPPORT_LABELS, SUPPORT_TONE } from './support-labels';

interface AriaCourseCardProps {
  view: AriaCourseView;
  selectable?: boolean;
  onToggle?: (courseKey: string) => void;
  onOpen?: (courseKey: string) => void;
}

export function AriaCourseCard({ view, selectable = false, onToggle, onOpen }: AriaCourseCardProps) {
  const { course, access } = view;
  const locked = access.productSupported && !access.commerciallyEntitled;
  const unsupported = !access.productSupported;

  const interactive = selectable ? !locked && !unsupported : !unsupported;

  function handleActivate() {
    if (!interactive) return;
    if (selectable) onToggle?.(course.key);
    else onOpen?.(course.key);
  }

  return (
    <div
      className={`rounded-card border p-4 transition-colors ${
        access.selectedForAria
          ? 'border-brand-accent/50 bg-brand-accent/5'
          : 'border-white/10 bg-white/5'
      } ${interactive ? 'hover:border-brand-accent/40' : 'opacity-70'}`}
      data-testid={`aria-course-card-${course.key}`}
      data-support={course.support}
      data-locked={locked ? 'true' : 'false'}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-neutral-100">{course.shortLabel}</p>
          <p className="mt-0.5 text-xs text-neutral-400">{course.label}</p>
        </div>
        {access.selectedForAria && (
          <Check className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
        )}
        {locked && <Lock className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-micro px-2 py-0.5 text-[11px] font-medium ${SUPPORT_TONE[course.support]}`}
        >
          {SUPPORT_LABELS[course.support]}
        </span>
        {course.hasSkillGraph && (
          <span className="inline-flex items-center gap-1 rounded-micro bg-white/5 px-2 py-0.5 text-[11px] text-neutral-300">
            <GraduationCap className="h-3 w-3" aria-hidden="true" />
            Compétences
          </span>
        )}
        {locked && (
          <span className="rounded-micro bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
            Non inclus dans l’abonnement
          </span>
        )}
      </div>

      {course.supportNote && (
        <p className="mt-2 text-[11px] leading-snug text-neutral-400">{course.supportNote}</p>
      )}

      {interactive && (
        <button
          type="button"
          onClick={handleActivate}
          className="mt-3 w-full rounded-micro border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-brand-accent/40 hover:text-brand-accent"
        >
          {selectable
            ? access.selectedForAria
              ? 'Retirer de mon cockpit'
              : 'Ajouter à mon cockpit'
            : 'Ouvrir'}
        </button>
      )}
    </div>
  );
}
