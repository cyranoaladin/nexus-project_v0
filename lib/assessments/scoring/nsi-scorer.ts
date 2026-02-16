/**
 * NSI Scorer - Subject-Specific Implementation
 * 
 * Implements scoring logic specific to NSI (Numérique et Sciences Informatiques):
 * - Logique (algorithmic thinking)
 * - Syntaxe (code syntax mastery)
 * - Optimisation (algorithm efficiency)
 * - Debuggage (error detection and debugging)
 * - Category-based analysis (Python, POO, Structures, SQL, etc.)
 */

import { BaseScorer, type ScoringStats } from './base-scorer';
import type {
  Subject,
  Grade,
  StudentAnswer,
  QuestionMetadata,
  NsiMetrics,
  ScoringResult,
} from '../core/types';
import {
  NSI_STRENGTH_THRESHOLD,
  NSI_WEAKNESS_THRESHOLD,
  RECOMMENDATION_THRESHOLDS,
} from '../core/constants';
import { getCategoryLabels } from '../core/config';

/**
 * NSI-specific scorer implementation
 * 
 * Scoring strategy:
 * 1. Compute category scores (Python, POO, Structures, SQL, etc.)
 * 2. Analyze error types (SYNTAX, LOGIC, RUNTIME, OPTIMIZATION)
 * 3. Infer competency scores from category performance and error patterns
 * 4. Identify strengths (>= 70%) and weaknesses (< 40%)
 * 5. Generate targeted recommendations
 */
export class NsiScorer extends BaseScorer<NsiMetrics> {
  constructor(grade: Grade) {
    super('NSI' as Subject, grade);
  }

  // ─── Metrics Computation ─────────────────────────────────────────────────

  protected computeMetrics(
    answers: StudentAnswer[],
    questions: QuestionMetadata[],
    stats: ScoringStats
  ): NsiMetrics {
    // 1. Group answers by category
    const categoryMap = this.groupByCategory(answers, questions);

    // 2. Compute category scores
    const categoryScores: NsiMetrics['categoryScores'] = {};

    categoryMap.forEach((categoryStats, category) => {
      const score = this.getCategoryScore(categoryStats);
      
      // Map category names to standardized keys
      const key = this.normalizeCategoryKey(category);
      if (key) {
        categoryScores[key] = score;
      }
    });

    // 3. Analyze error patterns
    const errorAnalysis = this.analyzeErrors(answers, questions);

    // 4. Infer competency scores from category performance and errors
    const competencies = this.computeCompetencyScores(
      categoryScores,
      errorAnalysis,
      answers,
      questions
    );

    return {
      logique: competencies.logique,
      syntaxe: competencies.syntaxe,
      optimisation: competencies.optimisation,
      debuggage: competencies.debuggage,
      categoryScores,
    };
  }

  /**
   * Analyze error patterns in incorrect answers
   * 
   * NSI questions can have error type metadata (SYNTAX, LOGIC, RUNTIME, OPTIMIZATION)
   * This helps identify specific weaknesses in coding skills.
   */
  private analyzeErrors(
    answers: StudentAnswer[],
    questions: QuestionMetadata[]
  ): ErrorAnalysis {
    const errorCounts = {
      SYNTAX: { total: 0, incorrect: 0 },
      LOGIC: { total: 0, incorrect: 0 },
      RUNTIME: { total: 0, incorrect: 0 },
      OPTIMIZATION: { total: 0, incorrect: 0 },
    };

    answers.forEach((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question || !question.nsiErrorType) return;

      const errorType = question.nsiErrorType;
      errorCounts[errorType].total++;

      if (answer.status === 'incorrect') {
        errorCounts[errorType].incorrect++;
      }
    });

    return errorCounts;
  }

  /**
   * Compute competency scores from category performance and error analysis
   * 
   * Strategy:
   * - Logique: weighted average of Algorithmique, Structures
   * - Syntaxe: inferred from SYNTAX error rate + Python score
   * - Optimisation: weighted average of Algorithmique + OPTIMIZATION error rate
   * - Debuggage: inferred from overall error detection + RUNTIME/LOGIC errors
   */
  private computeCompetencyScores(
    categoryScores: NsiMetrics['categoryScores'],
    errorAnalysis: ErrorAnalysis,
    answers: StudentAnswer[],
    questions: QuestionMetadata[]
  ): Pick<NsiMetrics, 'logique' | 'syntaxe' | 'optimisation' | 'debuggage'> {
    // Logique: algorithmic thinking (Algorithmique, Structures)
    const logiqueCategories = ['algorithmique', 'structures'];
    const logique = this.averageScores(categoryScores, logiqueCategories);

    // Syntaxe: code syntax (Python score + inverse of SYNTAX error rate)
    const pythonScore = categoryScores.python || 0;
    const syntaxErrorRate = this.getErrorRate(errorAnalysis.SYNTAX);
    const syntaxe = Math.round((pythonScore * 0.7 + (100 - syntaxErrorRate * 100) * 0.3));

    // Optimisation: algorithm efficiency (Algorithmique + inverse of OPTIMIZATION error rate)
    const algoScore = categoryScores.algorithmique || 0;
    const optimErrorRate = this.getErrorRate(errorAnalysis.OPTIMIZATION);
    const optimisation = Math.round((algoScore * 0.6 + (100 - optimErrorRate * 100) * 0.4));

    // Debuggage: error detection (inverse of LOGIC + RUNTIME error rates)
    const logicErrorRate = this.getErrorRate(errorAnalysis.LOGIC);
    const runtimeErrorRate = this.getErrorRate(errorAnalysis.RUNTIME);
    const debuggage = Math.round(100 - (logicErrorRate + runtimeErrorRate) * 50);

    return {
      logique: Math.max(0, Math.min(100, Math.round(logique))),
      syntaxe: Math.max(0, Math.min(100, syntaxe)),
      optimisation: Math.max(0, Math.min(100, optimisation)),
      debuggage: Math.max(0, Math.min(100, debuggage)),
    };
  }

  /**
   * Calculate error rate for a specific error type
   */
  private getErrorRate(errorCount: { total: number; incorrect: number }): number {
    if (errorCount.total === 0) return 0;
    return errorCount.incorrect / errorCount.total;
  }

  /**
   * Calculate weighted average of category scores
   */
  private averageScores(
    categoryScores: NsiMetrics['categoryScores'],
    categories: string[]
  ): number {
    const scores = categories
      .map((cat) => categoryScores[cat as keyof typeof categoryScores])
      .filter((score): score is number => score !== undefined);

    if (scores.length === 0) return 0;

    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  }

  /**
   * Normalize category names to standardized keys
   */
  private normalizeCategoryKey(category: string): keyof NsiMetrics['categoryScores'] | null {
    const normalized = category.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');

    const mapping: Record<string, keyof NsiMetrics['categoryScores']> = {
      'python': 'python',
      'pythonbases': 'python',
      'poo': 'poo',
      'programmationorientéeobjet': 'poo',
      'structures': 'structures',
      'structuresdedonnées': 'structures',
      'algorithmique': 'algorithmique',
      'sql': 'sql',
      'basesdedonnées': 'sql',
      'basesdedonnéesetsql': 'sql',
      'architecture': 'architecture',
      'architectureetréseaux': 'architecture',
    };

    return mapping[normalized] || null;
  }

  // ─── Strengths & Weaknesses ──────────────────────────────────────────────

  public getStrengths(result: ScoringResult<NsiMetrics>): string[] {
    const strengths: string[] = [];
    const categoryLabels = getCategoryLabels('NSI' as Subject);

    // Check category scores
    Object.entries(result.metrics.categoryScores).forEach(([key, score]) => {
      if (score !== undefined && score >= NSI_STRENGTH_THRESHOLD) {
        const label = categoryLabels[key.toUpperCase()] || key;
        strengths.push(label);
      }
    });

    // Check competencies
    if (result.metrics.logique >= NSI_STRENGTH_THRESHOLD) {
      strengths.push('Logique algorithmique');
    }
    if (result.metrics.syntaxe >= NSI_STRENGTH_THRESHOLD) {
      strengths.push('Maîtrise de la syntaxe');
    }
    if (result.metrics.optimisation >= NSI_STRENGTH_THRESHOLD) {
      strengths.push('Optimisation');
    }
    if (result.metrics.debuggage >= NSI_STRENGTH_THRESHOLD) {
      strengths.push('Débogage');
    }

    return strengths;
  }

  public getWeaknesses(result: ScoringResult<NsiMetrics>): string[] {
    const weaknesses: string[] = [];
    const categoryLabels = getCategoryLabels('NSI' as Subject);

    // Check category scores
    Object.entries(result.metrics.categoryScores).forEach(([key, score]) => {
      if (score !== undefined && score < NSI_WEAKNESS_THRESHOLD) {
        const label = categoryLabels[key.toUpperCase()] || key;
        weaknesses.push(label);
      }
    });

    // Check competencies
    if (result.metrics.logique < NSI_WEAKNESS_THRESHOLD) {
      weaknesses.push('Logique algorithmique');
    }
    if (result.metrics.syntaxe < NSI_WEAKNESS_THRESHOLD) {
      weaknesses.push('Maîtrise de la syntaxe');
    }
    if (result.metrics.optimisation < NSI_WEAKNESS_THRESHOLD) {
      weaknesses.push('Optimisation');
    }
    if (result.metrics.debuggage < NSI_WEAKNESS_THRESHOLD) {
      weaknesses.push('Débogage');
    }

    return weaknesses;
  }

  // ─── Recommendations ─────────────────────────────────────────────────────

  public getRecommendations(result: ScoringResult<NsiMetrics>): string[] {
    const recommendations: string[] = [];

    // 1. High NSP rate → work on fundamentals
    const nspRate = result.totalNSP / result.totalQuestions;
    if (nspRate >= RECOMMENDATION_THRESHOLDS.HIGH_NSP_RATE) {
      recommendations.push(
        'Revoir les bases : beaucoup de notions non vues. Commence par les concepts fondamentaux de la programmation.'
      );
    }

    // 2. Low precision → work on accuracy
    if (result.precisionIndex < RECOMMENDATION_THRESHOLDS.LOW_PRECISION) {
      recommendations.push(
        'Améliorer la précision : teste ton code, vérifie la syntaxe et la logique.'
      );
    }

    // 3. Low global score → general reinforcement
    if (result.globalScore < RECOMMENDATION_THRESHOLDS.LOW_GLOBAL_SCORE) {
      recommendations.push(
        'Renforcement global nécessaire : un accompagnement personnalisé en NSI sera très bénéfique.'
      );
    }

    // 4. Competency-specific recommendations
    if (result.metrics.logique < NSI_WEAKNESS_THRESHOLD) {
      recommendations.push(
        'Développer la logique algorithmique : pratique la décomposition de problèmes et les algorithmes classiques.'
      );
    }

    if (result.metrics.syntaxe < NSI_WEAKNESS_THRESHOLD) {
      recommendations.push(
        'Renforcer la syntaxe Python : entraîne-toi sur les structures de base (boucles, conditions, fonctions).'
      );
    }

    if (result.metrics.optimisation < NSI_WEAKNESS_THRESHOLD) {
      recommendations.push(
        'Travailler l\'optimisation : étudie la complexité algorithmique et les structures de données efficaces.'
      );
    }

    if (result.metrics.debuggage < NSI_WEAKNESS_THRESHOLD) {
      recommendations.push(
        'Améliorer le débogage : apprends à lire les messages d\'erreur et à utiliser un debugger.'
      );
    }

    // 5. Category-specific recommendations
    const weaknesses = this.getWeaknesses(result);
    if (weaknesses.length > 0) {
      weaknesses.forEach((weakness) => {
        if (!weakness.includes('Logique') && !weakness.includes('Syntaxe') && 
            !weakness.includes('Optimisation') && !weakness.includes('Débogage')) {
          recommendations.push(`Travailler spécifiquement : ${weakness}`);
        }
      });
    }

    // 6. If no specific recommendations, give general advice
    if (recommendations.length === 0) {
      if (result.globalScore >= 80) {
        recommendations.push(
          'Excellent niveau en NSI ! Continue à coder régulièrement et à explorer de nouveaux concepts.'
        );
      } else if (result.globalScore >= 60) {
        recommendations.push(
          'Bon niveau général. Concentre-toi sur la pratique régulière et les projets personnels.'
        );
      } else {
        recommendations.push(
          'Continue tes efforts ! La programmation demande de la pratique régulière et de la persévérance.'
        );
      }
    }

    return recommendations;
  }
}

// ─── Helper Types ────────────────────────────────────────────────────────────

/**
 * Error analysis by type
 */
interface ErrorAnalysis {
  SYNTAX: { total: number; incorrect: number };
  LOGIC: { total: number; incorrect: number };
  RUNTIME: { total: number; incorrect: number };
  OPTIMIZATION: { total: number; incorrect: number };
}
