/**
 * Base Scorer - Abstract Implementation
 * 
 * Provides common scoring logic shared by all subject-specific scorers.
 * Implements the Template Method pattern for scoring computation.
 */

import type {
  Subject,
  Grade,
  IScorer,
  StudentAnswer,
  QuestionMetadata,
  ScoringResult,
  SubjectMetrics,
} from '../core/types';
import {
  MAX_POINTS_50Q,
  CONFIDENCE_FORMULA,
  PRECISION_FORMULA,
  DIAGNOSTIC_SCORE_RANGES,
  LUCIDITY_CONFIDENCE_RANGES,
} from '../core/constants';

/**
 * Abstract base class for all scorers
 * 
 * Implements common scoring logic:
 * - Global score calculation
 * - Confidence index
 * - Precision index
 * - Diagnostic text generation
 * 
 * Subclasses must implement:
 * - computeMetrics() - Subject-specific metrics
 * - getStrengths() - Identify strengths
 * - getWeaknesses() - Identify weaknesses
 * - getRecommendations() - Generate recommendations
 */
export abstract class BaseScorer<TMetrics extends SubjectMetrics = SubjectMetrics>
  implements IScorer<TMetrics>
{
  constructor(
    public readonly subject: Subject,
    public readonly grade: Grade
  ) {}

  // ─── Abstract Methods (must be implemented by subclasses) ────────────────

  /**
   * Compute subject-specific metrics
   * 
   * @param answers - Student answers
   * @param questions - Question metadata
   * @param stats - Basic statistics (correct, attempted, NSP)
   * @returns Subject-specific metrics (MathsMetrics or NsiMetrics)
   */
  protected abstract computeMetrics(
    answers: StudentAnswer[],
    questions: QuestionMetadata[],
    stats: ScoringStats
  ): TMetrics;

  /**
   * Extract strengths from scoring result
   */
  abstract getStrengths(result: ScoringResult<TMetrics>): string[];

  /**
   * Extract weaknesses from scoring result
   */
  abstract getWeaknesses(result: ScoringResult<TMetrics>): string[];

  /**
   * Generate pedagogical recommendations
   */
  abstract getRecommendations(result: ScoringResult<TMetrics>): string[];

  // ─── Public API (Template Method) ────────────────────────────────────────

  /**
   * Main scoring computation (Template Method)
   * 
   * This method orchestrates the entire scoring process:
   * 1. Compute basic statistics
   * 2. Calculate global score
   * 3. Calculate confidence and precision indices
   * 4. Compute subject-specific metrics
   * 5. Generate diagnostic texts
   * 6. Extract strengths, weaknesses, recommendations
   */
  public compute(
    answers: StudentAnswer[],
    questions: QuestionMetadata[]
  ): ScoringResult<TMetrics> {
    // 1. Compute basic statistics
    const stats = this.computeBasicStats(answers, questions);

    // 2. Calculate global score (0-100)
    const globalScore = this.computeGlobalScore(stats);

    // 3. Calculate confidence index (0-100)
    const confidenceIndex = this.computeConfidenceIndex(stats);

    // 4. Calculate precision index (0-100)
    const precisionIndex = this.computePrecisionIndex(stats);

    // 5. Compute subject-specific metrics
    const metrics = this.computeMetrics(answers, questions, stats);

    // 6. Build complete result
    const result: ScoringResult<TMetrics> = {
      globalScore,
      confidenceIndex,
      precisionIndex,
      metrics,
      strengths: [],
      weaknesses: [],
      recommendations: [],
      diagnosticText: '',
      lucidityText: '',
      totalQuestions: stats.totalQuestions,
      totalAttempted: stats.totalAttempted,
      totalCorrect: stats.totalCorrect,
      totalNSP: stats.totalNSP,
      scoredAt: new Date().toISOString(),
    };

    // 7. Generate qualitative analysis
    result.strengths = this.getStrengths(result);
    result.weaknesses = this.getWeaknesses(result);
    result.recommendations = this.getRecommendations(result);
    result.diagnosticText = this.generateDiagnosticText(result);
    result.lucidityText = this.generateLucidityText(result);

    return result;
  }

  // ─── Protected Helper Methods ────────────────────────────────────────────

  /**
   * Compute basic statistics from answers
   */
  protected computeBasicStats(
    answers: StudentAnswer[],
    questions: QuestionMetadata[]
  ): ScoringStats {
    const totalQuestions = questions.length;
    const totalCorrect = answers.filter((a) => a.status === 'correct').length;
    const totalNSP = answers.filter((a) => a.status === 'nsp').length;
    const totalAttempted = totalQuestions - totalNSP;

    // Calculate total points earned (weighted by question difficulty)
    let totalPoints = 0;
    let maxPoints = 0;

    answers.forEach((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) return;

      maxPoints += question.weight;

      if (answer.status === 'correct') {
        totalPoints += question.weight;
      }
    });

    return {
      totalQuestions,
      totalCorrect,
      totalNSP,
      totalAttempted,
      totalPoints,
      maxPoints: maxPoints || MAX_POINTS_50Q, // Fallback to default
    };
  }

  /**
   * Calculate global score (0-100)
   * 
   * Formula: (totalPoints / maxPoints) * 100
   */
  protected computeGlobalScore(stats: ScoringStats): number {
    if (stats.maxPoints === 0) return 0;
    return Math.round((stats.totalPoints / stats.maxPoints) * 100);
  }

  /**
   * Calculate confidence index (0-100)
   * 
   * Formula: (1 - NSP_rate) * 100
   * High confidence = low NSP rate
   */
  protected computeConfidenceIndex(stats: ScoringStats): number {
    if (stats.totalQuestions === 0) return 0;
    const nspRate = stats.totalNSP / stats.totalQuestions;
    return Math.round((1 - nspRate * CONFIDENCE_FORMULA.NSP_PENALTY_WEIGHT) * 100);
  }

  /**
   * Calculate precision index (0-100)
   * 
   * Formula: (totalCorrect / totalAttempted) * 100
   * Measures accuracy on attempted questions
   */
  protected computePrecisionIndex(stats: ScoringStats): number {
    if (stats.totalAttempted < PRECISION_FORMULA.MIN_ATTEMPTED) return 0;
    return Math.round((stats.totalCorrect / stats.totalAttempted) * 100);
  }

  /**
   * Generate diagnostic text based on global score
   */
  protected generateDiagnosticText(result: ScoringResult<TMetrics>): string {
    const score = result.globalScore;

    if (score >= DIAGNOSTIC_SCORE_RANGES.EXCELLENT.min) {
      return `${DIAGNOSTIC_SCORE_RANGES.EXCELLENT.label} ! Tu maîtrises très bien les concepts.`;
    } else if (score >= DIAGNOSTIC_SCORE_RANGES.GOOD.min) {
      return `${DIAGNOSTIC_SCORE_RANGES.GOOD.label}. Continue à travailler tes points faibles.`;
    } else if (score >= DIAGNOSTIC_SCORE_RANGES.AVERAGE.min) {
      return `${DIAGNOSTIC_SCORE_RANGES.AVERAGE.label}. Il y a des bases solides à consolider.`;
    } else {
      return `${DIAGNOSTIC_SCORE_RANGES.WEAK.label}. Un accompagnement ciblé sera bénéfique.`;
    }
  }

  /**
   * Generate lucidity text based on confidence index
   */
  protected generateLucidityText(result: ScoringResult<TMetrics>): string {
    const confidence = result.confidenceIndex;

    if (confidence >= LUCIDITY_CONFIDENCE_RANGES.HIGH.min) {
      return `${LUCIDITY_CONFIDENCE_RANGES.HIGH.label} : tu connais bien tes forces et faiblesses.`;
    } else if (confidence >= LUCIDITY_CONFIDENCE_RANGES.MEDIUM.min) {
      return `${LUCIDITY_CONFIDENCE_RANGES.MEDIUM.label}. N'hésite pas à utiliser "Je ne sais pas" quand tu doutes.`;
    } else {
      return `${LUCIDITY_CONFIDENCE_RANGES.LOW.label}. Apprends à identifier ce que tu ne maîtrises pas encore.`;
    }
  }

  /**
   * Group answers by category for analysis
   */
  protected groupByCategory(
    answers: StudentAnswer[],
    questions: QuestionMetadata[]
  ): Map<string, CategoryStats> {
    const categoryMap = new Map<string, CategoryStats>();

    answers.forEach((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) return;

      const category = question.category;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          total: 0,
          correct: 0,
          attempted: 0,
          nsp: 0,
        });
      }

      const stats = categoryMap.get(category)!;
      stats.total++;

      if (answer.status === 'correct') {
        stats.correct++;
        stats.attempted++;
      } else if (answer.status === 'incorrect') {
        stats.attempted++;
      } else if (answer.status === 'nsp') {
        stats.nsp++;
      }
    });

    return categoryMap;
  }

  /**
   * Calculate percentage score for a category
   */
  protected getCategoryScore(stats: CategoryStats): number {
    if (stats.total === 0) return 0;
    return Math.round((stats.correct / stats.total) * 100);
  }
}

// ─── Helper Types ────────────────────────────────────────────────────────────

/**
 * Basic scoring statistics
 */
export interface ScoringStats {
  totalQuestions: number;
  totalCorrect: number;
  totalNSP: number;
  totalAttempted: number;
  totalPoints: number;
  maxPoints: number;
}

/**
 * Category-level statistics
 */
export interface CategoryStats {
  category: string;
  total: number;
  correct: number;
  attempted: number;
  nsp: number;
}
