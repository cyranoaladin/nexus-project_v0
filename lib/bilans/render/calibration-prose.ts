import type { ReportAudience } from './profile-copy';

/**
 * Phrase de calibration — la seule prose de l'ancien « catalogue » qui soit
 * réellement branchée sur le rendu (cf. report.ts).
 *
 * Le reste du catalogue (ouvertures, plans de travail, variantes par thème)
 * était une implémentation parallèle jamais rebranchée : le rendu vivant
 * produit ses propres formulations, variées par profil, dans report.ts. Ce
 * doublon a été retiré le 2026-08-12 ; son contenu reste récupérable dans
 * l'historique (commit c9819b95a) si l'on décide un jour de l'exploiter.
 *
 * Déterministe : même indice, même audience → même phrase.
 */

/** Indice de calibration en deçà duquel un travail métacognitif est signalé. */
export const CALIBRATION_THRESHOLD = 60;

export function buildCalibrationSentence(
  calibrationIndex: number | null,
  audience: ReportAudience,
): string {
  if (calibrationIndex === null) {
    return audience === 'ELEVE'
      ? 'Trop de questions sans réponse cette fois pour évaluer ton auto-perception — on le regardera en séance.'
      : audience === 'PARENTS'
        ? 'Trop de questions sont restées sans réponse pour évaluer l’auto-perception ; ce point sera regardé en séance.'
        : 'calibrationIndex null — aucun item traité, auto-évaluation non mesurable.';
  }
  if (calibrationIndex < CALIBRATION_THRESHOLD) {
    return audience === 'ELEVE'
      ? 'Un levier en plus des notions : ton ressenti et tes résultats ne coïncident pas toujours. Apprendre à repérer quand tu es sûr à raison — et quand tu ne l’es pas — vaut autant que le contenu lui-même.'
      : audience === 'PARENTS'
        ? 'Un levier en plus des notions : le ressenti et les résultats ne coïncident pas toujours. Apprendre à repérer quand la confiance est justifiée vaut autant que le contenu lui-même.'
        : `calibrationIndex ${calibrationIndex} < ${CALIBRATION_THRESHOLD} — travail métacognitif à programmer.`;
  }
  return audience === 'ELEVE'
    ? 'Point fort : ton auto-évaluation est fiable — tu sais globalement ce que tu sais. C’est un vrai atout pour réviser juste, sans perdre de temps.'
    : audience === 'PARENTS'
      ? 'Point fort : l’auto-évaluation est fiable — un atout pour des révisions efficaces.'
      : `calibrationIndex ${calibrationIndex} ≥ ${CALIBRATION_THRESHOLD} — auto-évaluation fiable.`;
}
