/**
 * Libellés d'affichage FR pour les enums du catalogue curriculum.
 * Purement cosmétique : ne redéfinit aucune règle métier.
 */

const GRADE_LEVEL_LABELS: Readonly<Record<string, string>> = Object.freeze({
  QUATRIEME: '4e',
  TROISIEME: '3e',
  SECONDE: '2nde',
  PREMIERE: '1re',
  TERMINALE: 'Terminale',
  POSTBAC: 'Post-bac',
  AUTRE: 'Autre',
});

const TRACK_LABELS: Readonly<Record<string, string>> = Object.freeze({
  COLLEGE: 'Collège',
  EDS_GENERALE: 'Générale (enseignements de spécialité)',
  STMG: 'STMG',
  STMG_NON_LYCEEN: 'STMG (hors lycée Nexus)',
  STI2D: 'STI2D',
  ST2S: 'ST2S',
  STL: 'STL',
  STD2A: 'STD2A',
});

const COURSE_KIND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  CORE: 'Tronc commun',
  SPECIALTY: 'Spécialités',
  OPTION: 'Options',
  TRACK_MODULE: 'Modules / transversaux',
});

export function gradeLevelLabel(gradeLevel: string): string {
  return GRADE_LEVEL_LABELS[gradeLevel] ?? gradeLevel;
}

export function trackLabel(track: string): string {
  return TRACK_LABELS[track] ?? track;
}

export function courseKindLabel(kind: string): string {
  return COURSE_KIND_LABELS[kind] ?? kind;
}

/** Ordre d'affichage canonique des groupes d'enseignements. */
export const COURSE_KIND_DISPLAY_ORDER = ['CORE', 'SPECIALTY', 'OPTION', 'TRACK_MODULE'] as const;
