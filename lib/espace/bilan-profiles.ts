/** Identité des bilans, utilisable côté client sans charger les questionnaires. */
export const BILAN_LEVELS = ['3e', '2nde', 'tle-maths', 'tle-nsi'] as const;
export type BilanLevel = typeof BILAN_LEVELS[number];
interface BilanProfile {
  id: BilanLevel; slug: string; subject: 'MATHEMATIQUES' | 'NSI';
  subjectLabel: string; levelLabel: string; label: string; contentVersion: string;
}
export const BILAN_PROFILES: Record<BilanLevel, BilanProfile> = {
  '3e': { id:'3e', slug:'maths-bilan-septembre-2026-3e', subject:'MATHEMATIQUES', subjectLabel:'Mathématiques', levelLabel:'Troisième', label:'Troisième', contentVersion:'2026-09.2' },
  '2nde': { id:'2nde', slug:'maths-bilan-septembre-2026-2nde', subject:'MATHEMATIQUES', subjectLabel:'Mathématiques', levelLabel:'Seconde', label:'Seconde', contentVersion:'2026-09.2' },
  'tle-maths': { id:'tle-maths', slug:'maths-bilan-septembre-2026-terminale', subject:'MATHEMATIQUES', subjectLabel:'Mathématiques', levelLabel:'Terminale', label:'Terminale — Mathématiques', contentVersion:'2026-09.2' },
  'tle-nsi': { id:'tle-nsi', slug:'nsi-bilan-septembre-2026-terminale', subject:'NSI', subjectLabel:'NSI', levelLabel:'Terminale', label:'Terminale — NSI', contentVersion:'2026-09.2' },
};
export function isBilanLevel(value: string): value is BilanLevel {
  return Object.hasOwn(BILAN_PROFILES, value);
}
export function getBilanProfile(level: BilanLevel): BilanProfile { return BILAN_PROFILES[level]; }
export function getBilanLevel(slug: string): BilanLevel | null {
  return BILAN_LEVELS.find(level => BILAN_PROFILES[level].slug === slug) ?? null;
}
