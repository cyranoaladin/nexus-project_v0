/**
 * Assessment Platform - Main Export
 * 
 * Central export point for the entire assessment system.
 * Provides access to all modules: core, scoring, prompts.
 * 
 * @example
 * ```typescript
 * import { 
 *   Subject, 
 *   Grade, 
 *   ScoringFactory,
 *   PromptFactory 
 * } from '@/lib/assessments';
 * 
 * // Create a scorer
 * const scorer = ScoringFactory.create(Subject.NSI, Grade.TERMINALE);
 * const result = scorer.compute(answers, questions);
 * 
 * // Get a prompt
 * const prompt = PromptFactory.get({
 *   subject: Subject.NSI,
 *   grade: Grade.TERMINALE,
 *   audience: Audience.ELEVE
 * });
 * ```
 */

// ─── Core Module ─────────────────────────────────────────────────────────────
export {
  // Enums
  Subject,
  Grade,
  AssessmentType,
  Audience,
  AssessmentStatus,
  
  // Type Guards
  isMathsMetrics,
  isNsiMetrics,
  
  // Configuration
  SUPPORTED_COMBINATIONS,
  isSupportedCombination,
  ASSESSMENT_CONFIGS,
  getAssessmentConfig,
  
  // Labels
  SUBJECT_LABELS,
  GRADE_LABELS,
  ASSESSMENT_TYPE_LABELS,
  MATHS_CATEGORIES,
  NSI_CATEGORIES,
  getCategoryLabels,
  MATHS_COMPETENCIES,
  NSI_COMPETENCIES,
  getCompetencyLabels,
  
  // Constants
  SCORE_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  NSP_THRESHOLDS,
  QUESTION_WEIGHTS,
  MAX_POINTS_50Q,
  MATHS_COMPETENCY_WEIGHTS,
  NSI_COMPETENCY_WEIGHTS,
  NSI_ERROR_WEIGHTS,
  MATHS_STRENGTH_THRESHOLD,
  MATHS_WEAKNESS_THRESHOLD,
  NSI_STRENGTH_THRESHOLD,
  NSI_WEAKNESS_THRESHOLD,
  CONFIDENCE_FORMULA,
  PRECISION_FORMULA,
  RECOMMENDATION_THRESHOLDS,
  DIAGNOSTIC_SCORE_RANGES,
  LUCIDITY_CONFIDENCE_RANGES,
  CONSTANTS,
} from './core';

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
} from './core';

// ─── Scoring Module ──────────────────────────────────────────────────────────
export {
  ScoringFactory,
  BaseScorer,
  MathsScorer,
  NsiScorer,
} from './scoring';

export type {
  ScoringStats,
  CategoryStats,
} from './scoring';

// ─── Prompts Module ──────────────────────────────────────────────────────────
export {
  PromptFactory,
  renderPrompt,
} from './prompts';

export type {
  PromptConfig,
  PromptTemplate,
} from './prompts';
