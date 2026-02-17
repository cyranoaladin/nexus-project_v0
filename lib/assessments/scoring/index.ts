/**
 * Scoring Module - Factory Pattern Implementation
 * 
 * Central export point for all scoring functionality.
 * Provides the ScoringFactory for dynamic scorer instantiation.
 * 
 * @example
 * ```typescript
 * import { ScoringFactory } from '@/lib/assessments/scoring';
 * 
 * const scorer = ScoringFactory.create(Subject.NSI, Grade.TERMINALE);
 * const result = scorer.compute(answers, questions);
 * ```
 */

import type { Subject, Grade, IScorer, SubjectMetrics } from '../core/types';
import { MathsScorer } from './maths-scorer';
import { NsiScorer } from './nsi-scorer';
import { GenericScorer } from './generic-scorer';

/**
 * Scoring Factory
 * 
 * Implements the Factory Pattern to create subject-specific scorers.
 * This allows the system to handle different subjects (Maths, NSI)
 * with different scoring strategies while maintaining a common interface.
 * 
 * Design Pattern: Factory Pattern
 * - Encapsulates scorer instantiation logic
 * - Returns the appropriate scorer based on subject
 * - Ensures type safety with TypeScript generics
 */
export class ScoringFactory {
  /**
   * Create a scorer for a specific subject and grade
   * 
   * @param subject - Subject (MATHS or NSI)
   * @param grade - Grade level (PREMIERE or TERMINALE)
   * @returns Subject-specific scorer instance
   * @throws Error if subject is not supported
   * 
   * @example
   * ```typescript
   * // Create a Maths scorer for Terminale
   * const mathsScorer = ScoringFactory.create(Subject.MATHS, Grade.TERMINALE);
   * 
   * // Create an NSI scorer for Première
   * const nsiScorer = ScoringFactory.create(Subject.NSI, Grade.PREMIERE);
   * ```
   */
  static create(subject: Subject, grade: Grade): IScorer<SubjectMetrics> {
    switch (subject) {
      case 'MATHS':
        return new MathsScorer(grade);
      
      case 'NSI':
        return new NsiScorer(grade);
      
      case 'GENERAL':
        return new GenericScorer(grade);
      
      default:
        throw new Error(`Unsupported subject: ${subject}`);
    }
  }

  /**
   * Create a Maths-specific scorer (type-safe)
   * 
   * @param grade - Grade level
   * @returns MathsScorer instance
   */
  static createMathsScorer(grade: Grade): MathsScorer {
    return new MathsScorer(grade);
  }

  /**
   * Create an NSI-specific scorer (type-safe)
   * 
   * @param grade - Grade level
   * @returns NsiScorer instance
   */
  static createNsiScorer(grade: Grade): NsiScorer {
    return new NsiScorer(grade);
  }

  /**
   * Check if a subject is supported
   * 
   * @param subject - Subject to check
   * @returns True if subject is supported
   */
  static isSupported(subject: string): subject is Subject {
    return subject === 'MATHS' || subject === 'NSI' || subject === 'GENERAL';
  }
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { BaseScorer, type ScoringStats, type CategoryStats } from './base-scorer';
export { MathsScorer } from './maths-scorer';
export { NsiScorer } from './nsi-scorer';
export { GenericScorer } from './generic-scorer';

// ─── Type Exports ────────────────────────────────────────────────────────────

export type {
  Subject,
  Grade,
  IScorer,
  ScoringResult,
  MathsMetrics,
  NsiMetrics,
  GenericMetrics,
  SubjectMetrics,
  StudentAnswer,
  QuestionMetadata,
} from '../core/types';
