import { REFLEXES } from './reflex-data';
import { PHRASES_MAGIQUES } from './phrases';
import { computeNotePotentielle } from './score-simulator';
import type { SurvivalProgressSnapshot, SurvivalState } from './types';

export const DEFAULT_EXAM_DATE = '2026-06-08T08:00:00.000Z';

export type StoredSurvivalProgress = {
  reflexesState?: unknown;
  phrasesState?: unknown;
  qcmAttempts?: number | null;
  qcmCorrect?: number | null;
  rituals?: unknown;
  examDate?: Date | string | null;
};

export function createDefaultSurvivalSnapshot(): SurvivalProgressSnapshot {
  return {
    reflexesState: Object.fromEntries(REFLEXES.map((reflex) => [reflex.id, 'PAS_VU' satisfies SurvivalState])),
    phrasesState: Object.fromEntries(PHRASES_MAGIQUES.map((phrase) => [phrase.id, 0])),
    qcmAttempts: 0,
    qcmCorrect: 0,
    rituals: [],
  };
}

export function normalizeSurvivalSnapshot(input?: Partial<SurvivalProgressSnapshot> | null): SurvivalProgressSnapshot {
  const defaults = createDefaultSurvivalSnapshot();
  return {
    reflexesState: { ...defaults.reflexesState, ...(input?.reflexesState ?? {}) },
    phrasesState: { ...defaults.phrasesState, ...(input?.phrasesState ?? {}) },
    qcmAttempts: Number(input?.qcmAttempts ?? 0),
    qcmCorrect: Number(input?.qcmCorrect ?? 0),
    rituals: Array.isArray(input?.rituals) ? input.rituals : [],
  };
}

export function snapshotFromStoredProgress(input?: StoredSurvivalProgress | null): SurvivalProgressSnapshot {
  const reflexesState = typeof input?.reflexesState === 'object' && input.reflexesState !== null
    ? input.reflexesState as Record<string, SurvivalState>
    : undefined;
  const phrasesState = typeof input?.phrasesState === 'object' && input.phrasesState !== null
    ? input.phrasesState as Record<string, number>
    : undefined;
  const rituals = Array.isArray(input?.rituals)
    ? input.rituals as SurvivalProgressSnapshot['rituals']
    : undefined;

  return normalizeSurvivalSnapshot({
    reflexesState,
    phrasesState,
    qcmAttempts: input?.qcmAttempts ?? 0,
    qcmCorrect: input?.qcmCorrect ?? 0,
    rituals,
  });
}

export function toPrismaSurvivalData(snapshot: SurvivalProgressSnapshot) {
  return {
    reflexesState: snapshot.reflexesState,
    phrasesState: snapshot.phrasesState,
    qcmAttempts: snapshot.qcmAttempts,
    qcmCorrect: snapshot.qcmCorrect,
    rituals: snapshot.rituals,
    notePotentielle: computeNotePotentielle(snapshot),
  };
}
