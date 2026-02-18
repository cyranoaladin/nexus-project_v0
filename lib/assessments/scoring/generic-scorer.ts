/**
 * Generic Scorer
 * 
 * Scorer for non-MATHS/NSI subjects (Français, Physique, SVT, etc.).
 * Evaluates cross-curricular competencies: comprehension, analysis, application.
 * 
 * Uses the same BaseScorer Template Method pattern as MathsScorer and NsiScorer.
 */

import type {
  Grade,
  StudentAnswer,
  QuestionMetadata,
  ScoringResult,
  GenericMetrics,
} from '../core/types';
import { Subject } from '../core/types';
import { BaseScorer, type ScoringStats } from './base-scorer';

/**
 * Strength/weakness thresholds for generic assessment
 */
const GENERIC_STRENGTH_THRESHOLD = 70;
const GENERIC_WEAKNESS_THRESHOLD = 40;

/**
 * Generic competency weights
 */
const _GENERIC_COMPETENCY_WEIGHTS = {
  comprehension: 0.35,
  analyse: 0.35,
  application: 0.30,
} as const;

/**
 * Map question categories to competency dimensions
 */
const _CATEGORY_TO_COMPETENCY: Record<string, keyof typeof _GENERIC_COMPETENCY_WEIGHTS> = {
  'Connaissances': 'comprehension',
  'Methodologie': 'application',
  'Raisonnement': 'analyse',
  'Organisation': 'application',
};

export class GenericScorer extends BaseScorer<GenericMetrics> {
  constructor(grade: Grade) {
    super(Subject.GENERAL, grade);
  }

  /**
   * Compute generic metrics from student answers
   */
  protected computeMetrics(
    answers: StudentAnswer[],
    questions: QuestionMetadata[],
    _stats: ScoringStats
  ): GenericMetrics {
    const categoryMap = this.groupByCategory(answers, questions);

    // Compute category scores
    const categoryScores: GenericMetrics['categoryScores'] = {};
    
    for (const [category, stats] of categoryMap) {
      const score = this.getCategoryScore(stats);
      const key = category.toLowerCase().replace(/[^a-z]/g, '') as string;
      
      if (key === 'methodologie') categoryScores.methodologie = score;
      else if (key === 'connaissances') categoryScores.connaissances = score;
      else if (key === 'raisonnement') categoryScores.raisonnement = score;
      else if (key === 'organisation') categoryScores.organisation = score;
    }

    // Compute competency dimensions from category scores
    const comprehensionCategories = ['Connaissances'];
    const analyseCategories = ['Raisonnement'];
    const applicationCategories = ['Methodologie', 'Organisation'];

    const comprehension = this.computeCompetencyScore(categoryMap, comprehensionCategories);
    const analyse = this.computeCompetencyScore(categoryMap, analyseCategories);
    const application = this.computeCompetencyScore(categoryMap, applicationCategories);

    return {
      comprehension,
      analyse,
      application,
      categoryScores,
    };
  }

  /**
   * Compute average score for a set of categories
   */
  private computeCompetencyScore(
    categoryMap: Map<string, { total: number; correct: number }>,
    categories: string[]
  ): number {
    let totalCorrect = 0;
    let totalQuestions = 0;

    for (const cat of categories) {
      const stats = categoryMap.get(cat);
      if (stats) {
        totalCorrect += stats.correct;
        totalQuestions += stats.total;
      }
    }

    if (totalQuestions === 0) return 0;
    return Math.round((totalCorrect / totalQuestions) * 100);
  }

  /**
   * Extract strengths from scoring result
   */
  getStrengths(result: ScoringResult<GenericMetrics>): string[] {
    const strengths: string[] = [];
    const cs = result.metrics.categoryScores;

    if (cs.methodologie !== undefined && cs.methodologie >= GENERIC_STRENGTH_THRESHOLD) {
      strengths.push('Méthodologie de travail');
    }
    if (cs.connaissances !== undefined && cs.connaissances >= GENERIC_STRENGTH_THRESHOLD) {
      strengths.push('Connaissances générales');
    }
    if (cs.raisonnement !== undefined && cs.raisonnement >= GENERIC_STRENGTH_THRESHOLD) {
      strengths.push('Raisonnement et analyse');
    }
    if (cs.organisation !== undefined && cs.organisation >= GENERIC_STRENGTH_THRESHOLD) {
      strengths.push('Organisation et gestion du temps');
    }

    if (result.metrics.comprehension >= GENERIC_STRENGTH_THRESHOLD) {
      strengths.push('Compréhension');
    }
    if (result.metrics.analyse >= GENERIC_STRENGTH_THRESHOLD) {
      strengths.push('Esprit d\'analyse');
    }
    if (result.metrics.application >= GENERIC_STRENGTH_THRESHOLD) {
      strengths.push('Application pratique');
    }

    return [...new Set(strengths)];
  }

  /**
   * Extract weaknesses from scoring result
   */
  getWeaknesses(result: ScoringResult<GenericMetrics>): string[] {
    const weaknesses: string[] = [];
    const cs = result.metrics.categoryScores;

    if (cs.methodologie !== undefined && cs.methodologie < GENERIC_WEAKNESS_THRESHOLD) {
      weaknesses.push('Méthodologie de travail');
    }
    if (cs.connaissances !== undefined && cs.connaissances < GENERIC_WEAKNESS_THRESHOLD) {
      weaknesses.push('Connaissances générales');
    }
    if (cs.raisonnement !== undefined && cs.raisonnement < GENERIC_WEAKNESS_THRESHOLD) {
      weaknesses.push('Raisonnement et analyse');
    }
    if (cs.organisation !== undefined && cs.organisation < GENERIC_WEAKNESS_THRESHOLD) {
      weaknesses.push('Organisation et gestion du temps');
    }

    return weaknesses;
  }

  /**
   * Generate pedagogical recommendations
   */
  getRecommendations(result: ScoringResult<GenericMetrics>): string[] {
    const recommendations: string[] = [];
    const cs = result.metrics.categoryScores;

    if (cs.methodologie !== undefined && cs.methodologie < 60) {
      recommendations.push(
        'Adopter une méthode de révision structurée : fiches de synthèse, exercices réguliers, et auto-évaluation.'
      );
    }

    if (cs.raisonnement !== undefined && cs.raisonnement < 60) {
      recommendations.push(
        'Travailler l\'argumentation et l\'analyse critique à travers des exercices de dissertation et de synthèse.'
      );
    }

    if (cs.organisation !== undefined && cs.organisation < 60) {
      recommendations.push(
        'Mettre en place un planning de révisions avec des objectifs quotidiens et la technique Pomodoro.'
      );
    }

    if (cs.connaissances !== undefined && cs.connaissances < 60) {
      recommendations.push(
        'Renforcer les connaissances de base sur le fonctionnement du Baccalauréat et de Parcoursup.'
      );
    }

    if (result.globalScore < 40) {
      recommendations.push(
        'Un accompagnement personnalisé est fortement recommandé pour structurer le travail et combler les lacunes.'
      );
    }

    if (result.confidenceIndex < 60) {
      recommendations.push(
        'Apprendre à identifier ses zones d\'incertitude pour mieux cibler les révisions.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Continuer sur cette lancée ! Un coaching ciblé peut aider à viser l\'excellence.'
      );
    }

    return recommendations;
  }
}
