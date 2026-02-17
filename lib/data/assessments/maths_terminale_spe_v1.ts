/**
 * Dataset Manifest: maths_terminale_spe_v1
 *
 * Versioned question bank for Maths Terminale Spécialité.
 * 50 questions across 5 domains, aligned with the French Terminale Spé Maths programme.
 *
 * Version: v1 (2026-02-17)
 * Total: 50 questions
 * Distribution:
 *   - Analyse (12Q): dérivation, intégrales, convexité, TVI, suites, limites
 *   - Combinatoire (6Q): coefficient binomial, Pascal, dénombrement, permutations
 *   - Géométrie (10Q): vecteurs, produit scalaire, plans, droites, distances
 *   - Logarithme & Exponentielle (10Q): propriétés ln/exp, équations, croissances comparées
 *   - Probabilités (12Q): loi binomiale, loi normale, Bayes, intervalles de confiance
 *
 * Weight distribution:
 *   - Weight 1 (Restituer): ~16 questions
 *   - Weight 2 (Appliquer): ~20 questions
 *   - Weight 3 (Raisonner): ~14 questions
 *
 * Usage:
 *   This manifest is referenced by the QuestionBank loader when
 *   assessmentVersion === 'maths_terminale_spe_v1'.
 *   It re-exports the same modules used by the default MATHS:TERMINALE loader.
 *
 * @module data/assessments/maths_terminale_spe_v1
 */

/** Version identifier — stored in Assessment.assessmentVersion */
export const ASSESSMENT_VERSION = 'maths_terminale_spe_v1';

/** Engine version — stored in Assessment.engineVersion */
export const ENGINE_VERSION = 'scoring_v2';

/** Expected total question count for integrity checks */
export const EXPECTED_QUESTION_COUNT = 50;

/** Domain distribution for this version */
export const DOMAIN_DISTRIBUTION = {
  analyse: 12,
  combinatoire: 6,
  geometrie: 10,
  logExp: 10,
  probabilites: 12,
} as const;

/** Module IDs that compose this dataset (same order as loader) */
export const MODULE_IDS = [
  'combinatoire',
  'geometrie',
  'analyse',
  'log-exp',
  'probabilites',
] as const;

/**
 * Load all question modules for this versioned dataset.
 *
 * @returns Array of QuestionModule for maths_terminale_spe_v1
 */
export async function loadModules() {
  const [combinatoire, geometrie, analyse, logExp, probabilites] = await Promise.all([
    import('@/lib/assessments/questions/maths/terminale/combinatoire').then((m) => m.default),
    import('@/lib/assessments/questions/maths/terminale/geometrie').then((m) => m.default),
    import('@/lib/assessments/questions/maths/terminale/analyse').then((m) => m.default),
    import('@/lib/assessments/questions/maths/terminale/log-exp').then((m) => m.default),
    import('@/lib/assessments/questions/maths/terminale/probabilites').then((m) => m.default),
  ]);

  return [combinatoire, geometrie, analyse, logExp, probabilites];
}

/**
 * Validate that the loaded dataset matches the expected count.
 *
 * @param modules - Loaded question modules
 * @returns true if count matches, throws otherwise
 */
export function validateDataset(modules: { questions: unknown[] }[]): boolean {
  const total = modules.reduce((sum, m) => sum + m.questions.length, 0);
  if (total !== EXPECTED_QUESTION_COUNT) {
    throw new Error(
      `[maths_terminale_spe_v1] Dataset integrity error: expected ${EXPECTED_QUESTION_COUNT} questions, got ${total}`
    );
  }
  return true;
}
