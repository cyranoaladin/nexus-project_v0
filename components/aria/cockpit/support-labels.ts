/**
 * Libellés et tonalités du niveau de support ARIA.
 *
 * Centralisé ici pour qu'aucun composant ne réinvente son propre vocabulaire.
 * Les libellés décrivent ce qui est RÉELLEMENT disponible — jamais une promesse.
 */

import type { AriaCourseSupport } from '@/lib/aria/contracts';

export const SUPPORT_LABELS: Record<AriaCourseSupport, string> = {
  FULL: 'Support complet',
  PARTIAL: 'Support partiel',
  RESOURCES_ONLY: 'Ressources seules',
  RAG_ONLY: 'Base documentaire',
  EXTERNAL: 'Plateforme dédiée',
  COMING_SOON: 'Pas encore outillé',
};

export const SUPPORT_TONE: Record<AriaCourseSupport, string> = {
  FULL: 'bg-emerald-500/10 text-emerald-200',
  PARTIAL: 'bg-sky-500/10 text-sky-200',
  RESOURCES_ONLY: 'bg-sky-500/10 text-sky-200',
  RAG_ONLY: 'bg-sky-500/10 text-sky-200',
  EXTERNAL: 'bg-violet-500/10 text-violet-200',
  COMING_SOON: 'bg-white/5 text-neutral-400',
};

export const LEARNING_GOAL_LABELS: Record<string, string> = {
  COMPRENDRE_LE_COURS: 'Comprendre le cours',
  PREPARER_BAC: 'Préparer le bac',
  CONSOLIDER_LACUNES: 'Consolider mes lacunes',
  ENTRAINEMENT_REGULIER: "M'entraîner régulièrement",
  PREPARER_EVALUATION: 'Préparer une évaluation',
};

export const ROLE_LABELS: Record<string, string> = {
  CORE: 'Tronc commun',
  SPECIALTY: 'Spécialité',
  TRACK_MODULE: 'Module de la voie',
  OPTION: 'Option',
};
