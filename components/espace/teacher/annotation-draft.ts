/** Validation du brouillon d'annotation côté client (miroir de lib/espace/annotations.ts, qui reste l'autorité). */
import { fromStatusesFor, type WorkAction, type WorkStatus } from '@/lib/espace/work-state';

export type AnnotationKind = 'GENERAL' | 'STEP' | 'QUESTION' | 'CODE';

export interface AnnotationDraft {
  kind: AnnotationKind;
  body: string;
  stepId: string;
  questionId: string;
  lineStart: string;
  lineEnd: string;
}

export const MAX_BODY = 4000;
const MAX_LINE = 10_000;

export const EMPTY_DRAFT: AnnotationDraft = { kind: 'GENERAL', body: '', stepId: '', questionId: '', lineStart: '', lineEnd: '' };

export type PayloadResult = { ok: true; payload: Record<string, unknown> } | { ok: false; error: string };

function parseLine(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_LINE ? n : null;
}

export function buildAnnotationPayload(draft: AnnotationDraft): PayloadResult {
  const body = draft.body.trim();
  if (!body) return { ok: false, error: 'Écrivez un commentaire avant d’enregistrer.' };
  if (body.length > MAX_BODY) return { ok: false, error: `Commentaire trop long (${MAX_BODY} caractères maximum).` };

  switch (draft.kind) {
    case 'GENERAL':
      return { ok: true, payload: { kind: 'GENERAL', body } };
    case 'STEP':
      if (!draft.stepId) return { ok: false, error: 'Choisissez l’étape concernée.' };
      return { ok: true, payload: { kind: 'STEP', body, stepId: draft.stepId } };
    case 'QUESTION':
      if (!draft.stepId || !draft.questionId) return { ok: false, error: 'Choisissez l’étape et la question concernées.' };
      return { ok: true, payload: { kind: 'QUESTION', body, stepId: draft.stepId, questionId: draft.questionId } };
    case 'CODE': {
      if (!draft.stepId) return { ok: false, error: 'Choisissez l’étape du code.' };
      const start = parseLine(draft.lineStart);
      if (start === null) return { ok: false, error: 'Indiquez un numéro de ligne valide (entier à partir de 1).' };
      if (draft.lineEnd.trim() === '') return { ok: true, payload: { kind: 'CODE', body, stepId: draft.stepId, lineStart: start } };
      const end = parseLine(draft.lineEnd);
      if (end === null || end < start) return { ok: false, error: 'La dernière ligne doit être supérieure ou égale à la première.' };
      return { ok: true, payload: { kind: 'CODE', body, stepId: draft.stepId, lineStart: start, lineEnd: end } };
    }
  }
}

export function describeTarget(a: { kind: string; stepId: string | null; questionId: string | null; lineStart: number | null; lineEnd: number | null }): string {
  switch (a.kind) {
    case 'STEP':
      return `Étape ${a.stepId}`;
    case 'QUESTION':
      return `Étape ${a.stepId} · question ${a.questionId}`;
    case 'CODE':
      return a.lineEnd && a.lineStart && a.lineEnd > a.lineStart
        ? `Code · étape ${a.stepId} · lignes ${a.lineStart}–${a.lineEnd}`
        : `Code · étape ${a.stepId} · ligne ${a.lineStart}`;
    default:
      return 'Commentaire général';
  }
}

export type ReviewAction = Extract<WorkAction, 'MARK_CORRECTED' | 'REOPEN' | 'MARK_DONE'>;

export function canApplyReview(status: WorkStatus, action: ReviewAction): boolean {
  return fromStatusesFor(action).includes(status);
}
