import { REFLEXES } from './reflexes';
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
  qcmPoints = Math.min(qcmPoints, 6);

  let exoPoints = 0;
  if (progress.reflexesState.reflex_2 === 'ACQUIS') exoPoints += 1;
  if (progress.reflexesState.reflex_4 === 'ACQUIS') exoPoints += 1;
  if (progress.reflexesState.reflex_7 === 'ACQUIS') exoPoints += 1.5;

  const phrasesAcquired = Object.values(progress.phrasesState).filter((count) => count >= 3).length;
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
  const remainingEffortBonus = daysUntilExam <= 7 ? 1 : 2;

  return {
    today,
    realistic: Math.min(20, Math.round((today + remainingEffortBonus) * 2) / 2),
    possible: Math.min(20, Math.max(today, 9)),
  };
}
