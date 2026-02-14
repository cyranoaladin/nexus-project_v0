/**
 * Scoring Factory Tests
 * 
 * Demonstrates how MathsScorer and NsiScorer produce different metrics
 * while respecting the same IScorer interface.
 */

import { describe, it, expect } from '@jest/globals';
import { ScoringFactory } from '../scoring';
import { Subject, Grade } from '../core/types';
import type { StudentAnswer, QuestionMetadata } from '../core/types';

describe('ScoringFactory', () => {
  // ─── Sample Data ───────────────────────────────────────────────────────────

  const mathsQuestions: QuestionMetadata[] = [
    { id: 'M1', subject: 'MATHS' as Subject, category: 'Algèbre', weight: 2, competencies: ['calcul'] },
    { id: 'M2', subject: 'MATHS' as Subject, category: 'Analyse', weight: 3, competencies: ['raisonnement'] },
    { id: 'M3', subject: 'MATHS' as Subject, category: 'Géométrie', weight: 2, competencies: ['abstraction'] },
  ];

  const nsiQuestions: QuestionMetadata[] = [
    { id: 'N1', subject: 'NSI' as Subject, category: 'Python', weight: 2, competencies: ['syntaxe'], nsiErrorType: 'SYNTAX' },
    { id: 'N2', subject: 'NSI' as Subject, category: 'Algorithmique', weight: 3, competencies: ['logique'], nsiErrorType: 'LOGIC' },
    { id: 'N3', subject: 'NSI' as Subject, category: 'POO', weight: 2, competencies: ['abstraction'], nsiErrorType: 'OPTIMIZATION' },
  ];

  const mathsAnswers: StudentAnswer[] = [
    { questionId: 'M1', status: 'correct' },
    { questionId: 'M2', status: 'incorrect' },
    { questionId: 'M3', status: 'nsp' },
  ];

  const nsiAnswers: StudentAnswer[] = [
    { questionId: 'N1', status: 'incorrect' }, // SYNTAX error
    { questionId: 'N2', status: 'correct' },
    { questionId: 'N3', status: 'nsp' },
  ];

  // ─── Factory Tests ─────────────────────────────────────────────────────────

  it('should create a MathsScorer for MATHS subject', () => {
    const scorer = ScoringFactory.create('MATHS' as Subject, 'TERMINALE' as Grade);
    
    expect(scorer.subject).toBe('MATHS');
    expect(scorer.grade).toBe('TERMINALE');
  });

  it('should create an NsiScorer for NSI subject', () => {
    const scorer = ScoringFactory.create('NSI' as Subject, 'TERMINALE' as Grade);
    
    expect(scorer.subject).toBe('NSI');
    expect(scorer.grade).toBe('TERMINALE');
  });

  it('should throw error for unsupported subject', () => {
    expect(() => {
      ScoringFactory.create('PHYSICS' as Subject, 'TERMINALE' as Grade);
    }).toThrow('Unsupported subject: PHYSICS');
  });

  // ─── Maths Scorer Tests ────────────────────────────────────────────────────

  describe('MathsScorer', () => {
    it('should compute Maths-specific metrics', () => {
      const scorer = ScoringFactory.createMathsScorer('TERMINALE' as Grade);
      const result = scorer.compute(mathsAnswers, mathsQuestions);

      // Check that Maths metrics are present
      expect(result.metrics).toHaveProperty('raisonnement');
      expect(result.metrics).toHaveProperty('calcul');
      expect(result.metrics).toHaveProperty('abstraction');
      expect(result.metrics).toHaveProperty('categoryScores');

      // Check that metrics are numbers between 0-100
      expect(result.metrics.raisonnement).toBeGreaterThanOrEqual(0);
      expect(result.metrics.raisonnement).toBeLessThanOrEqual(100);
      expect(result.metrics.calcul).toBeGreaterThanOrEqual(0);
      expect(result.metrics.calcul).toBeLessThanOrEqual(100);
      expect(result.metrics.abstraction).toBeGreaterThanOrEqual(0);
      expect(result.metrics.abstraction).toBeLessThanOrEqual(100);
    });

    it('should compute global score correctly', () => {
      const scorer = ScoringFactory.createMathsScorer('TERMINALE' as Grade);
      const result = scorer.compute(mathsAnswers, mathsQuestions);

      // 1 correct (weight 2) out of 7 total points (2+3+2)
      // Expected: (2/7) * 100 ≈ 29
      expect(result.globalScore).toBeGreaterThan(0);
      expect(result.globalScore).toBeLessThan(50);
    });

    it('should compute confidence index correctly', () => {
      const scorer = ScoringFactory.createMathsScorer('TERMINALE' as Grade);
      const result = scorer.compute(mathsAnswers, mathsQuestions);

      // 1 NSP out of 3 questions = 33% NSP rate
      // Confidence = (1 - 0.33) * 100 ≈ 67%
      expect(result.confidenceIndex).toBeGreaterThan(60);
      expect(result.confidenceIndex).toBeLessThan(70);
    });

    it('should identify strengths and weaknesses', () => {
      const scorer = ScoringFactory.createMathsScorer('TERMINALE' as Grade);
      const result = scorer.compute(mathsAnswers, mathsQuestions);

      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.weaknesses)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  // ─── NSI Scorer Tests ──────────────────────────────────────────────────────

  describe('NsiScorer', () => {
    it('should compute NSI-specific metrics (different from Maths)', () => {
      const scorer = ScoringFactory.createNsiScorer('TERMINALE' as Grade);
      const result = scorer.compute(nsiAnswers, nsiQuestions);

      // Check that NSI metrics are present (NOT Maths metrics)
      expect(result.metrics).toHaveProperty('logique');
      expect(result.metrics).toHaveProperty('syntaxe');
      expect(result.metrics).toHaveProperty('optimisation');
      expect(result.metrics).toHaveProperty('debuggage');
      expect(result.metrics).toHaveProperty('categoryScores');

      // Should NOT have Maths metrics
      expect(result.metrics).not.toHaveProperty('raisonnement');
      expect(result.metrics).not.toHaveProperty('calcul');
      expect(result.metrics).not.toHaveProperty('abstraction');

      // Check that metrics are numbers between 0-100
      expect(result.metrics.logique).toBeGreaterThanOrEqual(0);
      expect(result.metrics.logique).toBeLessThanOrEqual(100);
      expect(result.metrics.syntaxe).toBeGreaterThanOrEqual(0);
      expect(result.metrics.syntaxe).toBeLessThanOrEqual(100);
      expect(result.metrics.optimisation).toBeGreaterThanOrEqual(0);
      expect(result.metrics.optimisation).toBeLessThanOrEqual(100);
      expect(result.metrics.debuggage).toBeGreaterThanOrEqual(0);
      expect(result.metrics.debuggage).toBeLessThanOrEqual(100);
    });

    it('should penalize syntaxe score for SYNTAX errors', () => {
      const scorer = ScoringFactory.createNsiScorer('TERMINALE' as Grade);
      const result = scorer.compute(nsiAnswers, nsiQuestions);

      // N1 is a SYNTAX error (incorrect)
      // Syntaxe score should be affected
      expect(result.metrics.syntaxe).toBeLessThan(100);
    });

    it('should compute global score correctly', () => {
      const scorer = ScoringFactory.createNsiScorer('TERMINALE' as Grade);
      const result = scorer.compute(nsiAnswers, nsiQuestions);

      // 1 correct (weight 3) out of 7 total points (2+3+2)
      // Expected: (3/7) * 100 ≈ 43
      expect(result.globalScore).toBeGreaterThan(30);
      expect(result.globalScore).toBeLessThan(60);
    });

    it('should identify NSI-specific strengths and weaknesses', () => {
      const scorer = ScoringFactory.createNsiScorer('TERMINALE' as Grade);
      const result = scorer.compute(nsiAnswers, nsiQuestions);

      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.weaknesses)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);

      // Recommendations should be NSI-specific
      const allRecommendations = result.recommendations.join(' ');
      // Should mention programming/code-related terms
      const hasNsiTerms = 
        allRecommendations.includes('syntaxe') ||
        allRecommendations.includes('code') ||
        allRecommendations.includes('programmation') ||
        allRecommendations.includes('algorithme');
      
      expect(hasNsiTerms).toBe(true);
    });
  });

  // ─── Interface Compliance ──────────────────────────────────────────────────

  describe('IScorer Interface Compliance', () => {
    it('both scorers should return the same result structure', () => {
      const mathsScorer = ScoringFactory.createMathsScorer('TERMINALE' as Grade);
      const nsiScorer = ScoringFactory.createNsiScorer('TERMINALE' as Grade);

      const mathsResult = mathsScorer.compute(mathsAnswers, mathsQuestions);
      const nsiResult = nsiScorer.compute(nsiAnswers, nsiQuestions);

      // Both should have the same top-level structure
      const mathsKeys = Object.keys(mathsResult).sort();
      const nsiKeys = Object.keys(nsiResult).sort();

      expect(mathsKeys).toEqual(nsiKeys);

      // Both should have required fields
      expect(mathsResult).toHaveProperty('globalScore');
      expect(mathsResult).toHaveProperty('confidenceIndex');
      expect(mathsResult).toHaveProperty('precisionIndex');
      expect(mathsResult).toHaveProperty('metrics');
      expect(mathsResult).toHaveProperty('strengths');
      expect(mathsResult).toHaveProperty('weaknesses');
      expect(mathsResult).toHaveProperty('recommendations');

      expect(nsiResult).toHaveProperty('globalScore');
      expect(nsiResult).toHaveProperty('confidenceIndex');
      expect(nsiResult).toHaveProperty('precisionIndex');
      expect(nsiResult).toHaveProperty('metrics');
      expect(nsiResult).toHaveProperty('strengths');
      expect(nsiResult).toHaveProperty('weaknesses');
      expect(nsiResult).toHaveProperty('recommendations');
    });

    it('both scorers should implement getStrengths, getWeaknesses, getRecommendations', () => {
      const mathsScorer = ScoringFactory.createMathsScorer('TERMINALE' as Grade);
      const nsiScorer = ScoringFactory.createNsiScorer('TERMINALE' as Grade);

      const mathsResult = mathsScorer.compute(mathsAnswers, mathsQuestions);
      const nsiResult = nsiScorer.compute(nsiAnswers, nsiQuestions);

      // Methods should exist and return arrays
      expect(typeof mathsScorer.getStrengths).toBe('function');
      expect(typeof mathsScorer.getWeaknesses).toBe('function');
      expect(typeof mathsScorer.getRecommendations).toBe('function');

      expect(typeof nsiScorer.getStrengths).toBe('function');
      expect(typeof nsiScorer.getWeaknesses).toBe('function');
      expect(typeof nsiScorer.getRecommendations).toBe('function');

      // Results should be arrays
      expect(Array.isArray(mathsScorer.getStrengths(mathsResult))).toBe(true);
      expect(Array.isArray(mathsScorer.getWeaknesses(mathsResult))).toBe(true);
      expect(Array.isArray(mathsScorer.getRecommendations(mathsResult))).toBe(true);

      expect(Array.isArray(nsiScorer.getStrengths(nsiResult))).toBe(true);
      expect(Array.isArray(nsiScorer.getWeaknesses(nsiResult))).toBe(true);
      expect(Array.isArray(nsiScorer.getRecommendations(nsiResult))).toBe(true);
    });
  });
});
