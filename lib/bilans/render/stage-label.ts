import {
  bilanPackSubjectLabel,
  type BilanPackSubject,
} from '../catalog/subjects';

export const STAGE_LABEL_POLICY_VERSION = 'stage-label.v1' as const;

export const BILAN_PACK_LEVELS = [
  'QUATRIEME',
  'TROISIEME',
  'SECONDE',
  'PREMIERE',
  'TERMINALE',
] as const;

export type BilanPackLevel = (typeof BILAN_PACK_LEVELS)[number];

export const BILAN_PACK_LEVEL_LABELS: Readonly<Record<BilanPackLevel, string>> = Object.freeze({
  QUATRIEME: '4e',
  TROISIEME: '3e',
  SECONDE: '2de',
  PREMIERE: '1re',
  TERMINALE: 'Terminale',
});

export function bilanPackLevelLabel(level: string): string {
  if (!BILAN_PACK_LEVELS.includes(level as BilanPackLevel)) {
    throw new Error(`BILAN_PACK_LEVEL_UNKNOWN:${level}`);
  }
  return BILAN_PACK_LEVEL_LABELS[level as BilanPackLevel];
}

export function buildPreRentreeStageLabel(level: string, subject: BilanPackSubject): string {
  return `Stage de pré-rentrée — Entrée en ${bilanPackLevelLabel(level)}, ${bilanPackSubjectLabel(subject)}`;
}
