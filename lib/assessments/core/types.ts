/**
 * Core Types for Multi-Subject/Multi-Grade Assessment Platform
 * 
 * This module defines the universal types and interfaces used across
 * the entire assessment system (Maths, NSI, Première, Terminale).
 * 
 * Architecture: Factory Pattern + Strategy Pattern
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * Academic subjects supported by the platform
 */
export enum Subject {
  MATHS = 'MATHS',
  NSI = 'NSI',
}

/**
 * Grade levels (French education system)
 */
export enum Grade {
  PREMIERE = 'PREMIERE',
  TERMINALE = 'TERMINALE',
}

/**
 * Assessment types (different levels of depth)
 */
export enum AssessmentType {
  /** Quick diagnostic (e.g., Stage pre-assessment) */
  DIAGNOSTIC_RAPIDE = 'DIAGNOSTIC_RAPIDE',
  /** Full assessment with LLM-generated report */
  BILAN_COMPLET = 'BILAN_COMPLET',
}

/**
 * Target audiences for generated reports
 */
export enum Audience {
  /** Student (tutoiement, motivational tone) */
  ELEVE = 'ELEVE',
  /** Parents (vouvoiement, supportive tone) */
  PARENTS = 'PARENTS',
  /** Internal staff (technical, pedagogical analysis) */
  NEXUS = 'NEXUS',
}

/**
 * Assessment processing status
 */
export enum AssessmentStatus {
  /** Waiting for student submission */
  PENDING = 'PENDING',
  /** Submitted, waiting for processing */
  SUBMITTED = 'SUBMITTED',
  /** LLM generation in progress */
  PROCESSING = 'PROCESSING',
  /** Successfully completed */
  COMPLETED = 'COMPLETED',
  /** Processing failed */
  FAILED = 'FAILED',
}

// ─── Student Answer Types ────────────────────────────────────────────────────

/**
 * Status of a student's answer to a question
 */
export type AnswerStatus = 'correct' | 'incorrect' | 'nsp';

/**
 * Student's answer to a single question
 */
export interface StudentAnswer {
  /** Unique question identifier */
  questionId: string;
  /** Answer status (correct/incorrect/NSP) */
  status: AnswerStatus;
}

// ─── Scoring Metrics (Subject-Specific) ──────────────────────────────────────

/**
 * Maths-specific competency metrics
 * 
 * Based on French "Terminale" mathematics curriculum:
 * - Raisonnement: Logical reasoning and proof construction
 * - Calcul: Computational accuracy and algebraic manipulation
 * - Abstraction: Ability to work with abstract concepts
 */
export interface MathsMetrics {
  /** Logical reasoning score (0-100) */
  raisonnement: number;
  /** Computational skills score (0-100) */
  calcul: number;
  /** Abstract thinking score (0-100) */
  abstraction: number;
  
  /** Detailed scores by mathematical domain */
  categoryScores: {
    /** Algebra (equations, polynomials) */
    algebre?: number;
    /** Analysis (functions, derivatives, integrals) */
    analyse?: number;
    /** Geometry (space, vectors) */
    geometrie?: number;
    /** Combinatorics and counting */
    combinatoire?: number;
    /** Logarithms and exponentials */
    logExp?: number;
    /** Probability and statistics */
    probabilites?: number;
  };
}

/**
 * NSI-specific competency metrics
 * 
 * Based on French "NSI" (Numérique et Sciences Informatiques) curriculum:
 * - Logique: Algorithmic thinking and problem decomposition
 * - Syntaxe: Code syntax correctness and language mastery
 * - Optimisation: Algorithm efficiency and complexity analysis
 * - Debuggage: Error detection and debugging skills
 */
export interface NsiMetrics {
  /** Algorithmic logic score (0-100) */
  logique: number;
  /** Code syntax mastery score (0-100) */
  syntaxe: number;
  /** Algorithm optimization score (0-100) */
  optimisation: number;
  /** Debugging skills score (0-100) */
  debuggage: number;
  
  /** Detailed scores by CS domain */
  categoryScores: {
    /** Python programming fundamentals */
    python?: number;
    /** Object-Oriented Programming */
    poo?: number;
    /** Data structures (lists, trees, graphs) */
    structures?: number;
    /** Algorithms (sorting, searching, recursion) */
    algorithmique?: number;
    /** SQL and databases */
    sql?: number;
    /** Computer architecture and networks */
    architecture?: number;
  };
}

/**
 * Union type for subject-specific metrics
 */
export type SubjectMetrics = MathsMetrics | NsiMetrics;

// ─── Scoring Result (Universal Structure) ────────────────────────────────────

/**
 * Universal scoring result structure
 * 
 * This interface is implemented by all scorers (Maths, NSI)
 * regardless of subject or grade level.
 */
export interface ScoringResult<TMetrics extends SubjectMetrics = SubjectMetrics> {
  // ─── Global Scores ─────────────────────────────────────────────────────────
  
  /** Overall performance score (0-100) */
  globalScore: number;
  
  /** Confidence index: measures student's self-awareness (0-100) */
  confidenceIndex: number;
  
  /** Precision index: correct answers / attempted questions (0-100) */
  precisionIndex: number;
  
  // ─── Subject-Specific Metrics ──────────────────────────────────────────────
  
  /** Detailed metrics specific to the subject (Maths or NSI) */
  metrics: TMetrics;
  
  // ─── Qualitative Analysis ──────────────────────────────────────────────────
  
  /** List of student's strengths (e.g., ["Géométrie", "POO"]) */
  strengths: string[];
  
  /** List of student's weaknesses (e.g., ["Combinatoire", "SQL"]) */
  weaknesses: string[];
  
  /** Pedagogical recommendations for improvement */
  recommendations: string[];
  
  /** Diagnostic text (summary for student) */
  diagnosticText: string;
  
  /** Lucidity text (self-awareness analysis) */
  lucidityText: string;
  
  // ─── Statistics ────────────────────────────────────────────────────────────
  
  /** Total number of questions in the assessment */
  totalQuestions: number;
  
  /** Number of questions attempted (not NSP) */
  totalAttempted: number;
  
  /** Number of correct answers */
  totalCorrect: number;
  
  /** Number of "Je ne sais pas" (NSP) answers */
  totalNSP: number;
  
  /** Timestamp when scoring was computed */
  scoredAt: string;
}

// ─── Scorer Interface (Contract for all implementations) ─────────────────────

/**
 * Universal scorer interface
 * 
 * All subject-specific scorers (MathsScorer, NsiScorer) must implement
 * this interface to ensure consistency across the platform.
 * 
 * Design Pattern: Strategy Pattern
 * - Each scorer implements a different scoring strategy
 * - ScoringFactory selects the appropriate scorer at runtime
 */
export interface IScorer<TMetrics extends SubjectMetrics = SubjectMetrics> {
  /** Subject this scorer handles */
  readonly subject: Subject;
  
  /** Grade level this scorer handles */
  readonly grade: Grade;
  
  /**
   * Compute scoring result from student answers
   * 
   * @param answers - Array of student answers
   * @param questionMetadata - Question bank metadata
   * @returns Complete scoring result with metrics and analysis
   */
  compute(
    answers: StudentAnswer[],
    questionMetadata: QuestionMetadata[]
  ): ScoringResult<TMetrics>;
  
  /**
   * Extract strengths from scoring result
   * 
   * @param result - Scoring result
   * @returns Array of strength labels
   */
  getStrengths(result: ScoringResult<TMetrics>): string[];
  
  /**
   * Extract weaknesses from scoring result
   * 
   * @param result - Scoring result
   * @returns Array of weakness labels
   */
  getWeaknesses(result: ScoringResult<TMetrics>): string[];
  
  /**
   * Generate pedagogical recommendations
   * 
   * @param result - Scoring result
   * @returns Array of actionable recommendations
   */
  getRecommendations(result: ScoringResult<TMetrics>): string[];
}

// ─── Question Metadata ───────────────────────────────────────────────────────

/**
 * Metadata for a single question
 * 
 * This interface is used by the scoring engine to understand
 * question characteristics (difficulty, category, competencies).
 */
export interface QuestionMetadata {
  /** Unique question identifier */
  id: string;
  
  /** Subject (MATHS or NSI) */
  subject: Subject;
  
  /** Category/domain (e.g., "Analyse", "POO") */
  category: string;
  
  /** Difficulty weight (1=easy, 2=medium, 3=hard) */
  weight: 1 | 2 | 3;
  
  /** Competencies tested by this question */
  competencies: string[];
  
  /** NSI-specific: error type if applicable */
  nsiErrorType?: 'SYNTAX' | 'LOGIC' | 'RUNTIME' | 'OPTIMIZATION';
}

// ─── Assessment Configuration ────────────────────────────────────────────────

/**
 * Configuration for an assessment
 */
export interface AssessmentConfig {
  /** Subject */
  subject: Subject;
  
  /** Grade level */
  grade: Grade;
  
  /** Assessment type */
  type: AssessmentType;
  
  /** Total number of questions */
  totalQuestions: number;
  
  /** Time limit in minutes (optional) */
  timeLimit?: number;
  
  /** Whether NSP (Je ne sais pas) is allowed */
  allowNSP: boolean;
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

/**
 * Type guard to check if metrics are MathsMetrics
 */
export function isMathsMetrics(metrics: SubjectMetrics): metrics is MathsMetrics {
  return 'raisonnement' in metrics && 'calcul' in metrics && 'abstraction' in metrics;
}

/**
 * Type guard to check if metrics are NsiMetrics
 */
export function isNsiMetrics(metrics: SubjectMetrics): metrics is NsiMetrics {
  return 'logique' in metrics && 'syntaxe' in metrics && 'optimisation' in metrics;
}

// ─── Utility Types ───────────────────────────────────────────────────────────

/**
 * Type-safe subject-metrics mapping
 */
export type SubjectMetricsMap = {
  [Subject.MATHS]: MathsMetrics;
  [Subject.NSI]: NsiMetrics;
};

/**
 * Extract metrics type for a given subject
 */
export type MetricsForSubject<S extends Subject> = SubjectMetricsMap[S];
