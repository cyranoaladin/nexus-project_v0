/**
 * Assessment Platform Constants
 * 
 * Scoring thresholds, weights, and other numerical constants
 * used across the assessment system.
 */

// ─── Scoring Thresholds ──────────────────────────────────────────────────────

/**
 * Global score thresholds for qualitative labels
 */
export const SCORE_THRESHOLDS = {
  /** Excellent: >= 80/100 */
  EXCELLENT: 80,
  /** Good: >= 60/100 */
  GOOD: 60,
  /** Average: >= 40/100 */
  AVERAGE: 40,
  /** Weak: < 40/100 */
  WEAK: 40,
} as const;

/**
 * Confidence index thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  /** High confidence: >= 80% */
  HIGH: 80,
  /** Medium confidence: >= 60% */
  MEDIUM: 60,
  /** Low confidence: < 60% */
  LOW: 60,
} as const;

/**
 * NSP (Je ne sais pas) rate thresholds
 */
export const NSP_THRESHOLDS = {
  /** Low NSP rate: < 15% */
  LOW: 15,
  /** Medium NSP rate: < 30% */
  MEDIUM: 30,
  /** High NSP rate: >= 30% */
  HIGH: 30,
} as const;

// ─── Question Weights ────────────────────────────────────────────────────────

/**
 * Point values by question difficulty
 */
export const QUESTION_WEIGHTS = {
  /** Easy questions: 1 point */
  EASY: 1,
  /** Medium questions: 2 points */
  MEDIUM: 2,
  /** Hard questions: 3 points */
  HARD: 3,
} as const;

/**
 * Maximum possible points for a 50-question assessment
 * (assuming balanced distribution: 15 W1 + 20 W2 + 15 W3 = 85 points)
 */
export const MAX_POINTS_50Q = 85;

// ─── Maths-Specific Constants ────────────────────────────────────────────────

/**
 * Maths competency weights (for weighted average)
 */
export const MATHS_COMPETENCY_WEIGHTS = {
  raisonnement: 0.4,  // 40% - Most important for Maths
  calcul: 0.35,       // 35% - Computational skills
  abstraction: 0.25,  // 25% - Abstract thinking
} as const;

/**
 * Maths category thresholds for "strength" classification
 */
export const MATHS_STRENGTH_THRESHOLD = 70; // >= 70% correct in category

/**
 * Maths category thresholds for "weakness" classification
 */
export const MATHS_WEAKNESS_THRESHOLD = 40; // < 40% correct in category

// ─── NSI-Specific Constants ──────────────────────────────────────────────────

/**
 * NSI competency weights (for weighted average)
 */
export const NSI_COMPETENCY_WEIGHTS = {
  logique: 0.35,      // 35% - Algorithmic thinking
  syntaxe: 0.25,      // 25% - Code correctness
  optimisation: 0.20, // 20% - Efficiency
  debuggage: 0.20,    // 20% - Error handling
} as const;

/**
 * NSI category thresholds for "strength" classification
 */
export const NSI_STRENGTH_THRESHOLD = 70; // >= 70% correct in category

/**
 * NSI category thresholds for "weakness" classification
 */
export const NSI_WEAKNESS_THRESHOLD = 40; // < 40% correct in category

/**
 * NSI error type severity weights
 */
export const NSI_ERROR_WEIGHTS = {
  SYNTAX: 1.0,        // Syntax errors: most critical
  LOGIC: 0.8,         // Logic errors: important
  RUNTIME: 0.6,       // Runtime errors: moderate
  OPTIMIZATION: 0.4,  // Optimization issues: least critical
} as const;

// ─── Confidence Index Calculation ────────────────────────────────────────────

/**
 * Confidence index formula weights
 * 
 * ConfidenceIndex = (1 - NSP_rate) * 100
 * where NSP_rate = totalNSP / totalQuestions
 */
export const CONFIDENCE_FORMULA = {
  /** Weight for NSP penalty (1.0 = full penalty) */
  NSP_PENALTY_WEIGHT: 1.0,
} as const;

// ─── Precision Index Calculation ─────────────────────────────────────────────

/**
 * Precision index formula
 * 
 * PrecisionIndex = (totalCorrect / totalAttempted) * 100
 * where totalAttempted = totalQuestions - totalNSP
 */
export const PRECISION_FORMULA = {
  /** Minimum attempted questions to compute precision (avoid division by 0) */
  MIN_ATTEMPTED: 1,
} as const;

// ─── Recommendation Thresholds ───────────────────────────────────────────────

/**
 * Thresholds for generating specific recommendations
 */
export const RECOMMENDATION_THRESHOLDS = {
  /** High NSP rate triggers "bases fragiles" recommendation */
  HIGH_NSP_RATE: 0.25, // 25%
  
  /** Low precision triggers "attention aux erreurs" recommendation */
  LOW_PRECISION: 50, // < 50%
  
  /** Low global score triggers "renforcement global" recommendation */
  LOW_GLOBAL_SCORE: 40, // < 40/100
  
  /** Category weakness triggers specific chapter recommendation */
  CATEGORY_WEAKNESS: 40, // < 40% in category
} as const;

// ─── Diagnostic Text Templates ───────────────────────────────────────────────

/**
 * Score ranges for diagnostic text generation
 */
export const DIAGNOSTIC_SCORE_RANGES = {
  EXCELLENT: { min: 80, max: 100, label: 'Excellent niveau' },
  GOOD: { min: 60, max: 79, label: 'Bon niveau' },
  AVERAGE: { min: 40, max: 59, label: 'Niveau correct' },
  WEAK: { min: 0, max: 39, label: 'Niveau à renforcer' },
} as const;

/**
 * Confidence ranges for lucidity text generation
 */
export const LUCIDITY_CONFIDENCE_RANGES = {
  HIGH: { min: 80, max: 100, label: 'Très lucide' },
  MEDIUM: { min: 60, max: 79, label: 'Lucidité correcte' },
  LOW: { min: 0, max: 59, label: 'Manque de lucidité' },
} as const;

// ─── Export All Constants ────────────────────────────────────────────────────

/**
 * Centralized export of all constants for easy import
 */
export const CONSTANTS = {
  SCORE_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  NSP_THRESHOLDS,
  QUESTION_WEIGHTS,
  MAX_POINTS_50Q,
  MATHS_COMPETENCY_WEIGHTS,
  MATHS_STRENGTH_THRESHOLD,
  MATHS_WEAKNESS_THRESHOLD,
  NSI_COMPETENCY_WEIGHTS,
  NSI_STRENGTH_THRESHOLD,
  NSI_WEAKNESS_THRESHOLD,
  NSI_ERROR_WEIGHTS,
  CONFIDENCE_FORMULA,
  PRECISION_FORMULA,
  RECOMMENDATION_THRESHOLDS,
  DIAGNOSTIC_SCORE_RANGES,
  LUCIDITY_CONFIDENCE_RANGES,
} as const;
