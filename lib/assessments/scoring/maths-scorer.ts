/**
 * Maths Scorer - Subject-Specific Implementation
 * 
 * Implements scoring logic specific to Mathematics:
 * - Raisonnement (logical reasoning)
 * - Calcul (computational skills)
 * - Abstraction (abstract thinking)
 * - Category-based analysis (Algèbre, Analyse, Géométrie, etc.)
 */

import { BaseScorer, type ScoringStats, type CategoryStats } from './base-scorer';
import type {
  Subject,
  Grade,
  StudentAnswer,
  QuestionMetadata,
  MathsMetrics,
  ScoringResult,
} from '../core/types';
import {
  MATHS_COMPETENCY_WEIGHTS,
  MATHS_STRENGTH_THRESHOLD,
  MATHS_WEAKNESS_THRESHOLD,
  RECOMMENDATION_THRESHOLDS,
} from '../core/constants';
import { getCategoryLabels } from '../core/config';

/**
 * Maths-specific scorer implementation
 * 
 * Scoring strategy:
 * 1. Compute category scores (Algèbre, Analyse, Géométrie, etc.)
 * 2. Infer competency scores from category performance
 * 3. Identify strengths (>= 70%) and weaknesses (< 40%)
 * 4. Generate targeted recommendations
 */
export class MathsScorer extends BaseScorer<MathsMetrics> {
  constructor(grade: Grade) {
    super('MATHS' as Subject, grade);
  }

  // ─── Metrics Computation ─────────────────────────────────────────────────

  protected computeMetrics(
    answers: StudentAnswer[],
    questions: QuestionMetadata[],
    stats: ScoringStats
  ): MathsMetrics {
    // 1. Group answers by category
    const categoryMap = this.groupByCategory(answers, questions);

    // 2. Compute category scores
    const categoryScores: MathsMetrics['categoryScores'] = {};

    categoryMap.forEach((categoryStats, category) => {
      const score = this.getCategoryScore(categoryStats);
      
      // Map category names to standardized keys
      const key = this.normalizeCategoryKey(category);
      if (key) {
        categoryScores[key] = score;
      }
    });

    // 3. Infer competency scores from category performance
    const competencies = this.computeCompetencyScores(categoryScores, answers, questions);

    return {
      raisonnement: competencies.raisonnement,
      calcul: competencies.calcul,
      abstraction: competencies.abstraction,
      categoryScores,
    };
  }

  /**
   * Compute competency scores from category performance
   * 
   * Strategy:
   * - Raisonnement: weighted average of Combinatoire, Analyse
   * - Calcul: weighted average of Algèbre, LogExp
   * - Abstraction: weighted average of Géométrie, Probabilités
   */
  private computeCompetencyScores(
    categoryScores: MathsMetrics['categoryScores'],
    answers: StudentAnswer[],
    questions: QuestionMetadata[]
  ): Pick<MathsMetrics, 'raisonnement' | 'calcul' | 'abstraction'> {
    // Raisonnement: logic-heavy categories
    const raisonnementCategories = ['combinatoire', 'analyse'];
    const raisonnement = this.averageScores(categoryScores, raisonnementCategories);

    // Calcul: computation-heavy categories
    const calculCategories = ['algebre', 'logExp'];
    const calcul = this.averageScores(categoryScores, calculCategories);

    // Abstraction: abstract thinking categories
    const abstractionCategories = ['geometrie', 'probabilites'];
    const abstraction = this.averageScores(categoryScores, abstractionCategories);

    return {
      raisonnement: Math.round(raisonnement),
      calcul: Math.round(calcul),
      abstraction: Math.round(abstraction),
    };
  }

  /**
   * Calculate weighted average of category scores
   */
  private averageScores(
    categoryScores: MathsMetrics['categoryScores'],
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
  private normalizeCategoryKey(category: string): keyof MathsMetrics['categoryScores'] | null {
    const normalized = category.toLowerCase().replace(/\s+/g, '');

    const mapping: Record<string, keyof MathsMetrics['categoryScores']> = {
      'algèbre': 'algebre',
      'algebre': 'algebre',
      'analyse': 'analyse',
      'géométrie': 'geometrie',
      'géométriedansl\'espace': 'geometrie',
      'geometrie': 'geometrie',
      'combinatoire': 'combinatoire',
      'combinatoireetdénombrement': 'combinatoire',
      'logarithme': 'logExp',
      'logarithmeetexponentielle': 'logExp',
      'logexp': 'logExp',
      'probabilités': 'probabilites',
      'probabilites': 'probabilites',
      'probabilitésetstatistiques': 'probabilites',
    };

    return mapping[normalized] || null;
  }

  // ─── Strengths & Weaknesses ──────────────────────────────────────────────

  public getStrengths(result: ScoringResult<MathsMetrics>): string[] {
    const strengths: string[] = [];
    const categoryLabels = getCategoryLabels('MATHS' as Subject);

    // Check category scores
    Object.entries(result.metrics.categoryScores).forEach(([key, score]) => {
      if (score !== undefined && score >= MATHS_STRENGTH_THRESHOLD) {
        const label = categoryLabels[key.toUpperCase()] || key;
        strengths.push(label);
      }
    });

    // Check competencies
    if (result.metrics.raisonnement >= MATHS_STRENGTH_THRESHOLD) {
      strengths.push('Raisonnement logique');
    }
    if (result.metrics.calcul >= MATHS_STRENGTH_THRESHOLD) {
      strengths.push('Calcul et manipulation');
    }
    if (result.metrics.abstraction >= MATHS_STRENGTH_THRESHOLD) {
      strengths.push('Pensée abstraite');
    }

    return strengths;
  }

  public getWeaknesses(result: ScoringResult<MathsMetrics>): string[] {
    const weaknesses: string[] = [];
    const categoryLabels = getCategoryLabels('MATHS' as Subject);

    // Check category scores
    Object.entries(result.metrics.categoryScores).forEach(([key, score]) => {
      if (score !== undefined && score < MATHS_WEAKNESS_THRESHOLD) {
        const label = categoryLabels[key.toUpperCase()] || key;
        weaknesses.push(label);
      }
    });

    // Check competencies
    if (result.metrics.raisonnement < MATHS_WEAKNESS_THRESHOLD) {
      weaknesses.push('Raisonnement logique');
    }
    if (result.metrics.calcul < MATHS_WEAKNESS_THRESHOLD) {
      weaknesses.push('Calcul et manipulation');
    }
    if (result.metrics.abstraction < MATHS_WEAKNESS_THRESHOLD) {
      weaknesses.push('Pensée abstraite');
    }

    return weaknesses;
  }

  // ─── Recommendations ─────────────────────────────────────────────────────

  public getRecommendations(result: ScoringResult<MathsMetrics>): string[] {
    const recommendations: string[] = [];

    // 1. High NSP rate → work on fundamentals
    const nspRate = result.totalNSP / result.totalQuestions;
    if (nspRate >= RECOMMENDATION_THRESHOLDS.HIGH_NSP_RATE) {
      recommendations.push(
        'Revoir les bases : beaucoup de notions non vues. Commence par les chapitres fondamentaux.'
      );
    }

    // 2. Low precision → work on accuracy
    if (result.precisionIndex < RECOMMENDATION_THRESHOLDS.LOW_PRECISION) {
      recommendations.push(
        'Améliorer la précision : vérifie tes calculs et relis bien les énoncés.'
      );
    }

    // 3. Low global score → general reinforcement
    if (result.globalScore < RECOMMENDATION_THRESHOLDS.LOW_GLOBAL_SCORE) {
      recommendations.push(
        'Renforcement global nécessaire : un accompagnement personnalisé sera très bénéfique.'
      );
    }

    // 4. Category-specific recommendations
    const weaknesses = this.getWeaknesses(result);
    if (weaknesses.length > 0) {
      weaknesses.forEach((weakness) => {
        recommendations.push(`Travailler spécifiquement : ${weakness}`);
      });
    }

    // 5. Competency-specific recommendations
    if (result.metrics.raisonnement < MATHS_WEAKNESS_THRESHOLD) {
      recommendations.push(
        'Développer le raisonnement : pratique les démonstrations et la logique mathématique.'
      );
    }

    if (result.metrics.calcul < MATHS_WEAKNESS_THRESHOLD) {
      recommendations.push(
        'Renforcer le calcul : entraîne-toi sur les manipulations algébriques et les formules.'
      );
    }

    if (result.metrics.abstraction < MATHS_WEAKNESS_THRESHOLD) {
      recommendations.push(
        'Développer l\'abstraction : travaille la visualisation et la modélisation.'
      );
    }

    // 6. If no specific recommendations, give general advice
    if (recommendations.length === 0) {
      if (result.globalScore >= 80) {
        recommendations.push(
          'Excellent niveau ! Continue à approfondir et à challenger tes connaissances.'
        );
      } else if (result.globalScore >= 60) {
        recommendations.push(
          'Bon niveau général. Concentre-toi sur tes points faibles pour progresser encore.'
        );
      } else {
        recommendations.push(
          'Continue tes efforts ! La régularité est la clé de la progression en mathématiques.'
        );
      }
    }

    return recommendations;
  }
}
