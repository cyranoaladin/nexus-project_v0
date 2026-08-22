export const BILAN_PACK_SUBJECTS = [
  'MATHS',
  'MATHS_COMPLEMENTAIRES',
  'MATHS_EXPERTES',
  'NSI',
  'FRANCAIS',
  'PHYSIQUE_CHIMIE',
  'SVT',
  'SES',
  'PHILOSOPHIE',
  'HISTOIRE_GEOGRAPHIE',
  'GRAND_ORAL',
] as const;

export type BilanPackSubject = (typeof BILAN_PACK_SUBJECTS)[number];

export const BILAN_PACK_SUBJECT_LABELS: Readonly<Record<BilanPackSubject, string>> = Object.freeze({
  MATHS: 'Mathématiques',
  MATHS_COMPLEMENTAIRES: 'Mathématiques complémentaires',
  MATHS_EXPERTES: 'Mathématiques expertes',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  PHYSIQUE_CHIMIE: 'Physique-chimie',
  SVT: 'SVT',
  SES: 'Sciences économiques et sociales',
  PHILOSOPHIE: 'Philosophie',
  HISTOIRE_GEOGRAPHIE: 'Histoire-géographie',
  GRAND_ORAL: 'Grand oral',
});

export function bilanPackSubjectLabel(subject: string): string {
  if (!BILAN_PACK_SUBJECTS.includes(subject as BilanPackSubject)) {
    throw new Error(`BILAN_PACK_SUBJECT_UNKNOWN:${subject}`);
  }
  return BILAN_PACK_SUBJECT_LABELS[subject as BilanPackSubject];
}
