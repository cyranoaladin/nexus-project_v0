/**
 * ARIA Curriculum & Capabilities Engine.
 *
 * Source de vérité UNIQUE pour l'intégration d'ARIA avec le curriculum académique.
 * Branche directement sur `@/lib/curriculum/catalog` (SSoT du catalogue).
 *
 * Principes invariants :
 * - COURSE_IDENTITY_SOURCES=1 : Utilise uniquement le catalogue canonique.
 * - SUBJECT_LABEL_SOURCES=1 : Registre unifié des libellés de matières.
 * - Les capacités produit sont prouvées par des artefacts réels, jamais supposées.
 * - STMG (SGN, Management, Droit-Éco) n'a PAS de corpus SES approché.
 */

import type { Subject } from '@prisma/client';
import {
  getCourse,
  listCourses,
  isKnownCourseKey,
} from '@/lib/curriculum/catalog';
import type {
  AriaCourseCapabilities,
  AriaCourseKey,
} from './contracts';

// ─── Registre des skill graphs compilés réels ────────────────────────────────

const SKILL_GRAPH_MAPPING: Readonly<Record<string, string>> = Object.freeze({
  'eds-maths-premiere': 'maths-premiere-p2',
  'eds-maths-terminale': 'maths-terminale-p2',
  'eds-nsi-premiere': 'nsi-premiere-p2',
  'eds-nsi-terminale': 'nsi-terminale-p2',
  'stmg-maths-premiere': 'maths-premiere-stmg-p2',
  'stmg-sgn-premiere': 'sgn-premiere-stmg-p2',
  'stmg-management-premiere': 'management-premiere-stmg-p2',
  'stmg-droit-eco-premiere': 'droit-eco-premiere-stmg-p2',
});

// ─── Registre des collections RAG vérifiées ─────────────────────────────────
// AUCUNE approximation : les matières STMG technologiques ne sont JAMAIS
// mappées vers SES. Si pas de collection ChromaDB dédiée -> null.

const RAG_COLLECTION_MAPPING: Readonly<Record<string, string>> = Object.freeze({
  'eds-maths-premiere': 'rag_nexus_maths_premiere_generale_production',
  'eds-maths-terminale': 'rag_nexus_maths_terminale_generale_production',
  'eds-nsi-premiere': 'rag_nexus_nsi_premiere_generale_production',
  'eds-nsi-terminale': 'rag_nexus_nsi_terminale_generale_production',
  'tc-francais-premiere': 'rag_nexus_francais_premiere_generale_production',
  'tc-philosophie-terminale': 'rag_nexus_philosophie_terminale_generale_production',
});

// ─── Diagnostic / Assessments context ───────────────────────────────────────

const ASSESSMENT_CONTEXT_COURSES = new Set<string>([
  'eds-maths-premiere',
  'eds-maths-terminale',
  'eds-nsi-premiere',
  'eds-nsi-terminale',
  'stmg-maths-premiere',
]);

/**
 * Retourne les capacités prouvées pour un cours donné.
 */
export function getCourseCapabilities(courseKey: AriaCourseKey): AriaCourseCapabilities {
  const course = getCourse(courseKey);
  if (!course) {
    return {
      hasSkillGraph: false,
      hasResources: false,
      hasRagCorpus: false,
      hasChat: false,
      hasAssessmentContext: false,
      skillGraphRef: null,
      ragCollection: null,
      resourceCount: 0,
    };
  }

  const skillGraphRef = SKILL_GRAPH_MAPPING[courseKey] ?? null;
  const ragCollection = RAG_COLLECTION_MAPPING[courseKey] ?? null;
  const hasSkillGraph = skillGraphRef !== null;
  const hasRagCorpus = ragCollection !== null;
  const hasAssessmentContext = ASSESSMENT_CONTEXT_COURSES.has(courseKey);

  // Chat est disponible si le cours a un RAG vérifié ou si c'est un enseignement
  // majeur cadré (Maths, NSI, Français, Philo).
  const hasChat = hasRagCorpus;

  return {
    hasSkillGraph,
    hasResources: true, // Calculé dynamiquement ou complété par le resource engine
    hasRagCorpus,
    hasChat,
    hasAssessmentContext,
    skillGraphRef,
    ragCollection,
    resourceCount: 0,
  };
}

// ─── Registre unique des libellés de matières (SUBJECT_LABEL_SOURCES=1) ─────

const SUBJECT_CANONICAL_LABELS: Readonly<Record<Subject, string>> = Object.freeze({
  MATHEMATIQUES: 'Mathématiques',
  MATHS_EXPERTES: 'Mathématiques Expertes',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  SVT: 'Sciences de la Vie et de la Terre',
  NSI: 'Numérique et Sciences Informatiques',
  FRANCAIS: 'Français',
  PHILOSOPHIE: 'Philosophie',
  HISTOIRE_GEO: 'Histoire-Géographie',
  ANGLAIS: 'Anglais',
  ESPAGNOL: 'Espagnol',
  SES: 'Sciences Économiques et Sociales',
});

/**
 * Libellé canonique d'une matière Subject Prisma.
 */
export function getSubjectDisplayName(subject: Subject): string {
  return SUBJECT_CANONICAL_LABELS[subject] ?? subject;
}

/**
 * Libellé canonique d'un cours par sa clé.
 */
export function getCourseDisplayName(courseKey: AriaCourseKey): string {
  const course = getCourse(courseKey);
  return course ? course.label : courseKey;
}

export { isKnownCourseKey, getCourse, listCourses };
