/**
 * Assessment Platform Configuration
 * 
 * Central configuration for subjects, grades, and assessment parameters.
 * This file defines the supported combinations and their characteristics.
 */

import { Subject, Grade, AssessmentType, AssessmentConfig } from './types';

// ─── Supported Combinations ──────────────────────────────────────────────────

/**
 * Matrix of supported (Subject, Grade) combinations
 */
export const SUPPORTED_COMBINATIONS: Array<{ subject: Subject; grade: Grade }> = [
  { subject: Subject.MATHS, grade: Grade.PREMIERE },
  { subject: Subject.MATHS, grade: Grade.TERMINALE },
  { subject: Subject.NSI, grade: Grade.PREMIERE },
  { subject: Subject.NSI, grade: Grade.TERMINALE },
];

/**
 * Check if a (subject, grade) combination is supported
 */
export function isSupportedCombination(subject: Subject, grade: Grade): boolean {
  return SUPPORTED_COMBINATIONS.some(
    (combo) => combo.subject === subject && combo.grade === grade
  );
}

// ─── Assessment Configurations ───────────────────────────────────────────────

/**
 * Predefined assessment configurations by type
 */
export const ASSESSMENT_CONFIGS: Record<AssessmentType, Partial<AssessmentConfig>> = {
  [AssessmentType.DIAGNOSTIC_RAPIDE]: {
    type: AssessmentType.DIAGNOSTIC_RAPIDE,
    totalQuestions: 50,
    timeLimit: 25, // minutes
    allowNSP: true,
  },
  [AssessmentType.BILAN_COMPLET]: {
    type: AssessmentType.BILAN_COMPLET,
    totalQuestions: 100,
    timeLimit: 60, // minutes
    allowNSP: true,
  },
};

/**
 * Get assessment configuration for a specific combination
 */
export function getAssessmentConfig(
  subject: Subject,
  grade: Grade,
  type: AssessmentType
): AssessmentConfig {
  if (!isSupportedCombination(subject, grade)) {
    throw new Error(`Unsupported combination: ${subject} / ${grade}`);
  }

  const baseConfig = ASSESSMENT_CONFIGS[type];

  return {
    subject,
    grade,
    type,
    totalQuestions: baseConfig.totalQuestions!,
    timeLimit: baseConfig.timeLimit,
    allowNSP: baseConfig.allowNSP!,
  };
}

// ─── Subject Labels (i18n-ready) ─────────────────────────────────────────────

/**
 * Human-readable labels for subjects
 */
export const SUBJECT_LABELS: Record<Subject, string> = {
  [Subject.MATHS]: 'Mathématiques',
  [Subject.NSI]: 'NSI (Numérique et Sciences Informatiques)',
};

/**
 * Human-readable labels for grades
 */
export const GRADE_LABELS: Record<Grade, string> = {
  [Grade.PREMIERE]: 'Première',
  [Grade.TERMINALE]: 'Terminale',
};

/**
 * Human-readable labels for assessment types
 */
export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  [AssessmentType.DIAGNOSTIC_RAPIDE]: 'Diagnostic Rapide',
  [AssessmentType.BILAN_COMPLET]: 'Bilan Complet',
};

// ─── Category Labels by Subject ──────────────────────────────────────────────

/**
 * Maths categories (domains)
 */
export const MATHS_CATEGORIES = {
  ALGEBRE: 'Algèbre',
  ANALYSE: 'Analyse',
  GEOMETRIE: 'Géométrie dans l\'espace',
  COMBINATOIRE: 'Combinatoire et dénombrement',
  LOG_EXP: 'Logarithme et Exponentielle',
  PROBABILITES: 'Probabilités et Statistiques',
} as const;

/**
 * NSI categories (domains)
 */
export const NSI_CATEGORIES = {
  PYTHON: 'Python - Bases',
  POO: 'Programmation Orientée Objet',
  STRUCTURES: 'Structures de données',
  ALGORITHMIQUE: 'Algorithmique',
  SQL: 'Bases de données et SQL',
  ARCHITECTURE: 'Architecture et Réseaux',
} as const;

/**
 * Get category labels for a subject
 */
export function getCategoryLabels(subject: Subject): Record<string, string> {
  switch (subject) {
    case Subject.MATHS:
      return MATHS_CATEGORIES;
    case Subject.NSI:
      return NSI_CATEGORIES;
    default:
      throw new Error(`Unknown subject: ${subject}`);
  }
}

// ─── Competency Labels ───────────────────────────────────────────────────────

/**
 * Maths competencies
 */
export const MATHS_COMPETENCIES = {
  RAISONNEMENT: 'Raisonnement logique',
  CALCUL: 'Calcul et manipulation algébrique',
  ABSTRACTION: 'Pensée abstraite',
  MODELISATION: 'Modélisation',
  DEMONSTRATION: 'Démonstration',
} as const;

/**
 * NSI competencies
 */
export const NSI_COMPETENCIES = {
  LOGIQUE: 'Logique algorithmique',
  SYNTAXE: 'Maîtrise de la syntaxe',
  OPTIMISATION: 'Optimisation et complexité',
  DEBUGGAGE: 'Débogage et tests',
  CONCEPTION: 'Conception et architecture',
} as const;

/**
 * Get competency labels for a subject
 */
export function getCompetencyLabels(subject: Subject): Record<string, string> {
  switch (subject) {
    case Subject.MATHS:
      return MATHS_COMPETENCIES;
    case Subject.NSI:
      return NSI_COMPETENCIES;
    default:
      throw new Error(`Unknown subject: ${subject}`);
  }
}
