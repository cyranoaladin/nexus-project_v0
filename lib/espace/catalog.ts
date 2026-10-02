/**
 * Catalogue des activités de l'espace pédagogique.
 *
 * Le contenu pédagogique reste dans le code (JSON versionné) ; la base ne
 * porte qu'un miroir (`EspaceActivity`) pour les clés étrangères, alimenté par
 * le provisioning. Un module = une matière + un slug de module.
 */
import type { Subject } from '@prisma/client';

import pooContentJson from '@/content/espace/nsi-poo/content.json';

export interface PooQuestion {
  id: string;
  text: string;
  choices: string[];
  correct: number;
  feedback: string;
}

export interface PooField {
  id: string;
  label: string;
  placeholder?: string;
}

export interface PooStep {
  id: string;
  short: string;
  title: string;
  minutes: number;
  level: string;
  concepts: string[];
  intro: string;
  lesson: string;
  task: string;
  /** Code de départ ; `null` pour les étapes sans éditeur (ex. bilan). */
  starter: string | null;
  questions: PooQuestion[];
  fields: PooField[];
  hints: string[];
  takeaway: string;
  tests: string[];
}

export interface PooContent {
  version: string;
  title: string;
  session: string;
  duration: number;
  steps: PooStep[];
}

/** L'étape facultative, hors des 120 minutes. */
const OPTIONAL_STEP_IDS = new Set(['bonus']);

export const POO_ACTIVITY_SLUG = 'nsi-poo-objets-qui-agissent';
export const POO_CONTENT_VERSION = pooContentJson.version;

export function getPooContent(): PooContent {
  return pooContentJson as PooContent;
}

export function getPooRequiredSteps(): PooStep[] {
  return getPooContent().steps.filter((s) => !OPTIONAL_STEP_IDS.has(s.id));
}

export type ActivityKind = 'PYTHON_TP' | 'RESOURCE_PACK' | 'UPLOAD_EXERCISE';

export interface ResourceDef {
  /** Clé stable dans l'URL ; jamais un chemin de fichier. */
  key: string;
  label: string;
  /** Qui peut lire la ressource. Les corrigés sont TEACHER. */
  audience: 'STUDENT' | 'TEACHER';
  /** Nom de fichier relatif au dossier privé du module. */
  file: string;
  mimeType: 'application/pdf';
}

export interface ActivityDef {
  slug: string;
  subject: Subject;
  moduleSlug: string;
  moduleTitle: string;
  title: string;
  kind: ActivityKind;
  stepsTotal: number;
  contentVersion: string;
  /** Ressources privées éventuelles (RESOURCE_PACK / UPLOAD_EXERCISE). */
  resources: ResourceDef[];
}

export const MATHS_SUITES_ACTIVITY_SLUG = 'maths-suites-synthese';

export const ACTIVITIES: readonly ActivityDef[] = [
  {
    slug: POO_ACTIVITY_SLUG,
    subject: 'NSI',
    moduleSlug: 'poo',
    moduleTitle: 'Programmation orientée objet',
    title: pooContentJson.title,
    kind: 'PYTHON_TP',
    stepsTotal: getPooRequiredSteps().length,
    contentVersion: pooContentJson.version,
    resources: [],
  },
  {
    slug: MATHS_SUITES_ACTIVITY_SLUG,
    subject: 'MATHEMATIQUES',
    moduleSlug: 'suites',
    moduleTitle: 'Suites numériques — récurrence — convergence',
    title: 'Sujet de synthèse',
    kind: 'UPLOAD_EXERCISE',
    stepsTotal: 0,
    contentVersion: '1',
    resources: [
      { key: 'subject', label: 'Sujet de synthèse', audience: 'STUDENT', file: 'subject.pdf', mimeType: 'application/pdf' },
      { key: 'correction', label: 'Corrigé détaillé', audience: 'TEACHER', file: 'correction.pdf', mimeType: 'application/pdf' },
      { key: 'teacher-guide', label: 'Guide de correction', audience: 'TEACHER', file: 'teacher-guide.pdf', mimeType: 'application/pdf' },
    ],
  },
] as const;

export function getActivityDef(slug: string): ActivityDef | undefined {
  return ACTIVITIES.find((a) => a.slug === slug);
}
