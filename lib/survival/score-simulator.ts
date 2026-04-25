import { REFLEXES } from './reflex-data';
import { PHRASES_MAGIQUES } from './phrases';
import type { SurvivalProgressSnapshot } from './types';

export function computeNotePotentielle(progress: SurvivalProgressSnapshot): number {
  let qcmPoints = 0;

  for (const reflex of REFLEXES) {
    const state = progress.reflexesState[reflex.id];
    if (state === 'ACQUIS') {
      qcmPoints += reflex.qcmPointsCovered;
    } else if (state === 'REVOIR') {
      qcmPoints += reflex.qcmPointsCovered * 0.5;
    }
  }

  qcmPoints += 0.75;
  const accuracy = progress.qcmAttempts > 0 ? progress.qcmCorrect / progress.qcmAttempts : 0;
  if (accuracy >= 0.7 && progress.qcmAttempts >= 10) {
    qcmPoints += 0.5;
  }
  qcmPoints = Math.min(qcmPoints, 6);

  let exoPoints = 0;
  if (progress.reflexesState.reflex_2 === 'ACQUIS') exoPoints += 1;
  if (progress.reflexesState.reflex_4 === 'ACQUIS') exoPoints += 1;
  if (progress.reflexesState.reflex_7 === 'ACQUIS') exoPoints += 1.5;

  const VALID_PHRASE_IDS = new Set<string>(PHRASES_MAGIQUES.map((p) => p.id));
  const phrasesAcquired = Object.entries(progress.phrasesState)
    .filter(([id, count]) => VALID_PHRASE_IDS.has(id) && count >= 3)
    .length;
  exoPoints += phrasesAcquired * 0.25;
  exoPoints = Math.min(exoPoints, 14);

  const rawScore = qcmPoints + exoPoints;
  if (rawScore === 0.75) {
    return 0.75;
  }

  return Math.round(rawScore * 2) / 2;
}

export function computeScoreProjection(progress: SurvivalProgressSnapshot, daysUntilExam: number) {
  const today = computeNotePotentielle(progress);
  const weeksLeft = Math.max(0, Math.floor(daysUntilExam / 7));
  const unseenReflexes = REFLEXES.filter((reflex) => progress.reflexesState[reflex.id] !== 'ACQUIS').length;
  const acquirableReflexes = Math.min(unseenReflexes, weeksLeft);
  const projectedReflexBonus = acquirableReflexes * 0.5;

  return {
    today,
    realistic: Math.min(20, Math.round((today + projectedReflexBonus) * 2) / 2),
    possible: Math.min(20, Math.max(today + unseenReflexes * 0.5, today)),
  };
}
