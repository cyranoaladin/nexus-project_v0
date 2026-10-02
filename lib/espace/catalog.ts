/**
 * Catalogue des activités de l'espace pédagogique.
 *
 * Le contenu pédagogique reste dans le code (JSON versionné) ; la base ne
 * porte qu'un miroir (`EspaceActivity`) pour les clés étrangères, alimenté par
 * le provisioning. Un module = une matière + un slug de module.
 */
import type { Subject } from '@prisma/client';

import pooContentJson from '@/content/espace/nsi-poo/content.json';
import maths2ContentJson from '@/content/espace/maths-fonctions-limites/content.json';
import poo2ContentJson from '@/content/espace/nsi-structures-lineaires/content.json';

import type { LessonContent, LessonField, LessonQuestion, LessonStep } from './lesson-types';
import {
  MATHS_LIMITES_ACTIVITY_SLUG,
  MATHS_SUITES_ACTIVITY_SLUG,
  POO2_ACTIVITY_SLUG,
  POO_ACTIVITY_SLUG,
} from './lesson-routes';

export { MATHS_LIMITES_ACTIVITY_SLUG, MATHS_SUITES_ACTIVITY_SLUG, POO2_ACTIVITY_SLUG, POO_ACTIVITY_SLUG };

// Noms historiques conservés (TP 1) : ce sont désormais des alias du contrat commun.
export type PooQuestion = LessonQuestion;
export type PooField = LessonField;
export type PooStep = LessonStep;
export type PooContent = LessonContent;

/** L'étape facultative, hors de la durée annoncée. */
const OPTIONAL_STEP_IDS = new Set(['bonus']);

export const POO_CONTENT_VERSION = pooContentJson.version;

export function getPooContent(): PooContent {
  return pooContentJson as unknown as PooContent;
}

export function getPooRequiredSteps(): PooStep[] {
  return getPooContent().steps.filter((s) => !OPTIONAL_STEP_IDS.has(s.id));
}

/** Registre des leçons guidées : contenu + harnais Python éventuel (fichier lu côté serveur). */
export interface LessonDef {
  content: LessonContent;
  /** Chemin relatif au dépôt du harnais de contrôles Python, ou `null` (leçon sans éditeur). */
  runnerPath: string | null;
}

const LESSONS: Record<string, LessonDef> = {
  [POO_ACTIVITY_SLUG]: { content: getPooContent(), runnerPath: 'content/espace/nsi-poo/runner.py' },
  [POO2_ACTIVITY_SLUG]: { content: poo2ContentJson as unknown as LessonContent, runnerPath: 'content/espace/nsi-structures-lineaires/runner.py' },
  [MATHS_LIMITES_ACTIVITY_SLUG]: { content: maths2ContentJson as unknown as LessonContent, runnerPath: null },
};

export function getLesson(slug: string): LessonDef | undefined {
  return LESSONS[slug];
}

export function getLessonSteps(slug: string): LessonStep[] {
  return LESSONS[slug]?.content.steps ?? [];
}

export function getLessonRequiredSteps(slug: string): LessonStep[] {
  return getLessonSteps(slug).filter((s) => !OPTIONAL_STEP_IDS.has(s.id));
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


export const ACTIVITIES: readonly ActivityDef[] = [
  {
    slug: POO_ACTIVITY_SLUG,
    subject: 'NSI',
    moduleSlug: 'poo',
    moduleTitle: 'Programmation orientée objet',
    // Libellé d'affichage seulement : le contenu du TP 1 (content.json) n'est pas modifié.
    title: 'TP POO 1 — Des objets qui agissent',
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
  {
    slug: POO2_ACTIVITY_SLUG,
    subject: 'NSI',
    moduleSlug: 'poo-structures',
    moduleTitle: 'Programmation orientée objet',
    title: 'TP POO 2 — Listes, piles et files',
    kind: 'PYTHON_TP',
    stepsTotal: getLessonRequiredSteps(POO2_ACTIVITY_SLUG).length,
    contentVersion: poo2ContentJson.version,
    resources: [{ key: 'corrige', label: 'Corrigé enseignant', audience: 'TEACHER', file: 'corrige.pdf', mimeType: 'application/pdf' }],
  },
  {
    slug: MATHS_LIMITES_ACTIVITY_SLUG,
    subject: 'MATHEMATIQUES',
    moduleSlug: 'fonctions-limites',
    moduleTitle: 'Fonctions et limites',
    title: 'Fonctions, limites et lecture graphique',
    // Parcours guidé par étapes ; la valeur d'énumération existante évite toute migration.
    kind: 'RESOURCE_PACK',
    stepsTotal: getLessonRequiredSteps(MATHS_LIMITES_ACTIVITY_SLUG).length,
    contentVersion: maths2ContentJson.version,
    resources: [{ key: 'corrige', label: 'Corrigé enseignant', audience: 'TEACHER', file: 'corrige.pdf', mimeType: 'application/pdf' }],
  },
] as const;

export function getActivityDef(slug: string): ActivityDef | undefined {
  return ACTIVITIES.find((a) => a.slug === slug);
}
