/**
 * Logique pure de l'établi du TP (sans React) : navigation entre étapes,
 * contrôle de la lecture seule, avertissement avant remise, regroupement des
 * retours de l'enseignant. Isolée pour être testée sans navigateur.
 */
import type { AnnotationDto } from '@/lib/espace/annotations';
import { isStudentEditable, type WorkStatus } from '@/lib/espace/work-state';
import { computeProgress, type StepContent, type WorkContent } from '@/lib/espace/work-content';
import type { PooStep } from '@/lib/espace/catalog';
import type { SaveState, Steps } from '@/lib/espace/client/sync-engine';

export const OPTIONAL_STEP_ID = 'bonus';

export function clampStep(index: number, total: number): number {
  if (!Number.isFinite(index) || total <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), total - 1);
}

export function stepLabel(step: Pick<PooStep, 'id' | 'short'>): string {
  return step.id === OPTIONAL_STEP_ID ? `${step.short} (facultatif)` : step.short;
}

/** L'élève peut-il modifier ? Statut serveur ET état de synchronisation (remis ailleurs = verrouillé). */
export function isEditable(status: WorkStatus, syncState: SaveState): boolean {
  return isStudentEditable(status) && syncState !== 'locked';
}

export type Banner = { tone: 'info' | 'warn'; text: string } | null;

export function bannerFor(status: WorkStatus, editable: boolean): Banner {
  if (status === 'REOPENED' && editable) return { tone: 'warn', text: 'Ton enseignant te demande de reprendre ce travail.' };
  if (editable) return null;
  if (status === 'CORRECTED' || status === 'DONE') return { tone: 'info', text: 'Travail corrigé : lecture seule.' };
  return { tone: 'info', text: 'Travail remis : lecture seule. Ton enseignant le corrigera.' };
}

export function missingSteps(defs: readonly PooStep[], steps: Steps): number {
  const { completedSteps, requiredSteps } = computeProgress(defs, { v: 1, steps: steps as WorkContent['steps'] });
  return requiredSteps - completedSteps;
}

export function submitWarning(missing: number): string {
  if (missing <= 0) return 'Une fois remis, ton travail passe en lecture seule jusqu’à la correction.';
  const plural = missing > 1;
  return `Il reste ${missing} étape${plural ? 's' : ''} non renseignée${plural ? 's' : ''}. Une fois remis, ton travail passe en lecture seule : seul ton enseignant pourra le rouvrir.`;
}

export function submitBlockedMessage(reason: SaveState): string {
  switch (reason) {
    case 'conflict':
      return 'Résous d’abord le conflit de version avant de remettre.';
    case 'locked':
      return 'Ce travail a déjà été remis.';
    default:
      return 'Ton travail n’est pas encore enregistré sur le serveur. Vérifie ta connexion puis réessaie.';
  }
}

export interface AnnotationGroups {
  general: AnnotationDto[];
  byStep: Record<string, AnnotationDto[]>;
}

export function groupAnnotations(annotations: readonly AnnotationDto[]): AnnotationGroups {
  const groups: AnnotationGroups = { general: [], byStep: {} };
  for (const a of annotations) {
    if (!a.stepId) groups.general.push(a);
    else (groups.byStep[a.stepId] ??= []).push(a);
  }
  return groups;
}

export function annotationTarget(a: AnnotationDto, step?: PooStep): string {
  if (a.kind === 'CODE') {
    if (a.lineStart && a.lineEnd && a.lineEnd !== a.lineStart) return `Code, lignes ${a.lineStart} à ${a.lineEnd}`;
    return `Code, ligne ${a.lineStart ?? '?'}`;
  }
  if (a.kind === 'QUESTION' && step) {
    const label = step.questions.find((q) => q.id === a.questionId)?.text ?? step.fields.find((f) => f.id === a.questionId)?.label;
    return label ? `Question : « ${label} »` : 'Question';
  }
  if (a.kind === 'STEP') return 'Cette étape';
  return 'Commentaire général';
}

export function currentCode(step: PooStep, content: StepContent | undefined): string {
  return content?.code ?? step.starter ?? '';
}

/** Insère 4 espaces à la sélection ; renvoie le nouveau texte et la position du curseur. */
export function insertIndent(value: string, start: number, end: number): { value: string; cursor: number } {
  return { value: `${value.slice(0, start)}    ${value.slice(end)}`, cursor: start + 4 };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

// ─── Leçons : intercalation d'éléments dans le cours ────────────────────────

export type LessonSegment =
  | { kind: 'html'; html: string }
  | { kind: 'q' | 'f' | 'fig'; id: string }
  | { kind: 'code' };

const TOKEN = /\{\{(?:(q|f|fig):([A-Za-z0-9_.-]+)|(code))\}\}/g;

/** Découpe le HTML d'une leçon aux jetons `{{q:ID}}`, `{{f:ID}}`, `{{fig:ID}}`, `{{code}}`. */
export function parseLesson(lesson: string): LessonSegment[] {
  const out: LessonSegment[] = [];
  let last = 0;
  for (const m of lesson.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ kind: 'html', html: lesson.slice(last, index) });
    out.push(m[3] ? { kind: 'code' } : { kind: m[1] as 'q' | 'f' | 'fig', id: m[2]! });
    last = index + m[0].length;
  }
  if (last < lesson.length) out.push({ kind: 'html', html: lesson.slice(last) });
  return out;
}

/** Éléments de l'étape qu'aucun jeton ne place : affichés après le cours (figures, questions, éditeur, champs). */
export function unplaced<Q extends { id: string }, F extends { id: string }, G extends { id: string }>(
  step: { questions: Q[]; fields: F[]; figures?: G[]; starter: string | null },
  segments: readonly LessonSegment[],
) {
  const has = (kind: string, id?: string) => segments.some((s) => s.kind === kind && (id === undefined || (s as { id?: string }).id === id));
  return {
    figures: (step.figures ?? []).filter((f) => !has('fig', f.id)),
    questions: step.questions.filter((q) => !has('q', q.id)),
    code: step.starter !== null && !has('code'),
    fields: step.fields.filter((f) => !has('f', f.id)),
  };
}
