import type { GradeLevel } from '@prisma/client';
import type { EleveTrackItem } from './types';

type AriaSubjectLink = {
  value: string;
  label: string;
  color: string;
};

const DEFAULT_EDS_ARIA_SUBJECT_LINKS: AriaSubjectLink[] = [
  { value: 'MATHEMATIQUES', label: 'Maths', color: 'text-sky-300' },
  { value: 'NSI', label: 'NSI', color: 'text-blue-300' },
  { value: 'FRANCAIS', label: 'Français', color: 'text-blue-200' },
  { value: 'PHYSIQUE_CHIMIE', label: 'Physique-Chimie', color: 'text-emerald-300' },
  { value: 'PHILOSOPHIE', label: 'Philosophie', color: 'text-rose-300' },
  { value: 'HISTOIRE_GEO', label: 'Histoire-Géo', color: 'text-slate-200' },
];

const STMG_ARIA_COLORS: Record<string, string> = {
  MATHS_STMG: 'text-orange-300',
  SGN: 'text-emerald-300',
  MANAGEMENT: 'text-amber-300',
  DROIT_ECO: 'text-sky-300',
};

export function shouldShowStmgLivret(input: {
  isStmgTrack: boolean;
  isSurvivalMode: boolean;
  grade?: string | null;
  gradeLevel?: GradeLevel | string | null;
}): boolean {
  return (
    input.isStmgTrack &&
    !input.isSurvivalMode &&
    (input.gradeLevel === 'PREMIERE' || input.grade === 'PREMIERE')
  );
}

export function shouldShowEdsParcours(input: {
  isStmgTrack: boolean;
  grade?: string | null;
  gradeLevel?: GradeLevel | string | null;
}): boolean {
  const level = input.gradeLevel ?? input.grade;
  return !input.isStmgTrack && (level === 'PREMIERE' || level === 'TERMINALE');
}

export function buildAriaSubjectLinks(input: {
  isStmgTrack: boolean;
  specialties: EleveTrackItem[];
  stmgModules: EleveTrackItem[];
}): AriaSubjectLink[] {
  if (input.isStmgTrack) {
    return input.stmgModules
      .map((item) => {
        const value = item.module ?? String(item.subject ?? item.skillGraphRef);
        const label = item.label ?? value.replaceAll('_', ' ');
        return {
          value,
          label,
          color: STMG_ARIA_COLORS[value] ?? 'text-sky-300',
        };
      })
      .filter((item) => item.value.length > 0);
  }

  if (input.specialties.length > 0) {
    return input.specialties
      .filter((item) => Boolean(item.subject))
      .map((item) => {
        const value = String(item.subject);
        return { value, label: value.replaceAll('_', ' '), color: 'text-sky-300' };
      });
  }

  return DEFAULT_EDS_ARIA_SUBJECT_LINKS;
}
