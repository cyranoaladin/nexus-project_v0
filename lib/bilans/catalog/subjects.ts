export const BILAN_PACK_SUBJECTS = [
  'MATHS',
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
