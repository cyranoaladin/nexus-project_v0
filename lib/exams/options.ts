/**
 * Exclusion rules for terminale options are structural, not session-
 * dependent — they live in code, not in the versioned JSON. The option
 * codes themselves (MATHS_EXPERTES, DGEMC, ...) are the only cross-
 * reference with lib/exams data; this module owns no coefficient.
 */

const ALIASES: Record<string, string> = { DGMEC: 'DGEMC' };

export function normalizeOptionCode(input: string): string {
  const upper = input.trim().toUpperCase();
  return ALIASES[upper] ?? upper;
}

export type OptionsValidationError = { code: string; message: string };
export type OptionsValidationResult = { valide: boolean; erreurs: OptionsValidationError[] };

const TERMINALE_ONLY_OPTIONS = new Set(['MATHS_EXPERTES', 'MATHS_COMPLEMENTAIRES', 'DGEMC']);
const LCA_OPTIONS = new Set(['LCA_LATIN', 'LCA_GREC']);

/** Union of every recognized option code (post-normalization) — reused by lib/exams/normalize.ts. */
export const KNOWN_OPTION_CODES = new Set([...TERMINALE_ONLY_OPTIONS, ...LCA_OPTIONS]);

/** Langues et cultures de l'Antiquité — hors plafond des 2 options terminale (cf. validateOptionsSelection). */
export function isLcaOption(code: string): boolean {
  return LCA_OPTIONS.has(normalizeOptionCode(code));
}

export function validateOptionsSelection(input: {
  optionsTerminale: string[];
  specialitesTerminale: string[];
}): OptionsValidationResult {
  const options = input.optionsTerminale.map(normalizeOptionCode);
  const erreurs: OptionsValidationError[] = [];

  if (options.includes('MATHS_EXPERTES') && options.includes('MATHS_COMPLEMENTAIRES')) {
    erreurs.push({
      code: 'OPTIONS_EXCLUSIVES',
      message: "Maths expertes et Maths complémentaires sont mutuellement exclusives.",
    });
  }
  if (options.includes('MATHS_EXPERTES') && !input.specialitesTerminale.includes('MATHEMATIQUES')) {
    erreurs.push({
      code: 'EXPERTES_REQUIERT_SPE_MATHS',
      message: "Maths expertes exige que la spécialité mathématiques soit conservée en terminale.",
    });
  }
  if (options.includes('MATHS_COMPLEMENTAIRES') && input.specialitesTerminale.includes('MATHEMATIQUES')) {
    erreurs.push({
      code: 'COMPLEMENTAIRES_REQUIERT_ABANDON_MATHS',
      message: "Maths complémentaires exige que la spécialité mathématiques ait été abandonnée en fin de première.",
    });
  }

  const nonLcaCount = options.filter((o) => TERMINALE_ONLY_OPTIONS.has(o)).length;
  if (nonLcaCount > 2) {
    erreurs.push({
      code: 'NB_OPTIONS_TERMINALE',
      message: "Au maximum 2 options en terminale, hors Langues et cultures de l'Antiquité.",
    });
  }

  return { valide: erreurs.length === 0, erreurs };
}
