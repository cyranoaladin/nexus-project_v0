/**
 * Assessment Core Module
 * 
 * Central export point for all core types, configurations, and constants.
 * This module provides the foundation for the entire assessment platform.
 * 
 * @example
 * ```typescript
 * import { Subject, Grade, IScorer, CONSTANTS } from '@/lib/assessments/core';
 * 
 * const scorer = ScoringFactory.create(Subject.NSI, Grade.TERMINALE);
 * const result = scorer.compute(answers, questions);
 * ```
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  // Answer Types
  AnswerStatus,
  StudentAnswer,
  
  // Metrics
  MathsMetrics,
  NsiMetrics,
  SubjectMetrics,
  
  // Scoring
  ScoringResult,
  IScorer,
  
  // Questions
  QuestionMetadata,
  
  // Configuration
  AssessmentConfig,
  
  // Utility Types
  SubjectMetricsMap,
  MetricsForSubject,
} from './types';

export {
  // Enums (exported as both type and value)
  Subject,
  Grade,
  AssessmentType,
  Audience,
  AssessmentStatus,
  
  // Type Guards
  isMathsMetrics,
  isNsiMetrics,
} from './types';

// ─── Configuration ───────────────────────────────────────────────────────────
export {
  // Supported Combinations
  SUPPORTED_COMBINATIONS,
  isSupportedCombination,
  
  // Assessment Configs
  ASSESSMENT_CONFIGS,
  getAssessmentConfig,
  
  // Labels
  SUBJECT_LABELS,
  GRADE_LABELS,
  ASSESSMENT_TYPE_LABELS,
  
  // Categories
  MATHS_CATEGORIES,
  NSI_CATEGORIES,
  getCategoryLabels,
  
  // Competencies
  MATHS_COMPETENCIES,
  NSI_COMPETENCIES,
  getCompetencyLabels,
} from './config';

// ─── Constants ───────────────────────────────────────────────────────────────
export {
  // Thresholds
  SCORE_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  NSP_THRESHOLDS,
  
  // Weights
  QUESTION_WEIGHTS,
  MAX_POINTS_50Q,
  MATHS_COMPETENCY_WEIGHTS,
  NSI_COMPETENCY_WEIGHTS,
  NSI_ERROR_WEIGHTS,
  
  // Category Thresholds
  MATHS_STRENGTH_THRESHOLD,
  MATHS_WEAKNESS_THRESHOLD,
  NSI_STRENGTH_THRESHOLD,
  NSI_WEAKNESS_THRESHOLD,
  
  // Formulas
  CONFIDENCE_FORMULA,
  PRECISION_FORMULA,
  
  // Recommendations
  RECOMMENDATION_THRESHOLDS,
  
  // Diagnostic Ranges
  DIAGNOSTIC_SCORE_RANGES,
  LUCIDITY_CONFIDENCE_RANGES,
  
  // All Constants
  CONSTANTS,
} from './constants';
