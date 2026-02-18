/**
 * Tests for lib/assessments/core/config.ts
 *
 * Covers: isSupportedCombination, getAssessmentConfig, getCanonicalDomains,
 * backfillCanonicalDomains, getCategoryLabels, getCompetencyLabels
 */

import {
  isSupportedCombination,
  getAssessmentConfig,
  getCanonicalDomains,
  backfillCanonicalDomains,
  getCategoryLabels,
  getCompetencyLabels,
  SUPPORTED_COMBINATIONS,
  CANONICAL_DOMAINS_MATHS,
  CANONICAL_DOMAINS_NSI,
  CANONICAL_DOMAINS_GENERAL,
  MATHS_CATEGORIES,
  NSI_CATEGORIES,
  GENERAL_CATEGORIES,
  MATHS_COMPETENCIES,
  NSI_COMPETENCIES,
  GENERAL_COMPETENCIES,
} from '@/lib/assessments/core/config';
import { Subject, Grade, AssessmentType } from '@/lib/assessments/core/types';

describe('Assessment Config', () => {
  describe('SUPPORTED_COMBINATIONS', () => {
    it('contains all 6 subject/grade combinations', () => {
      expect(SUPPORTED_COMBINATIONS).toHaveLength(6);
    });
  });

  describe('isSupportedCombination', () => {
    it('returns true for MATHS/PREMIERE', () => {
      expect(isSupportedCombination(Subject.MATHS, Grade.PREMIERE)).toBe(true);
    });

    it('returns true for MATHS/TERMINALE', () => {
      expect(isSupportedCombination(Subject.MATHS, Grade.TERMINALE)).toBe(true);
    });

    it('returns true for NSI/PREMIERE', () => {
      expect(isSupportedCombination(Subject.NSI, Grade.PREMIERE)).toBe(true);
    });

    it('returns true for NSI/TERMINALE', () => {
      expect(isSupportedCombination(Subject.NSI, Grade.TERMINALE)).toBe(true);
    });

    it('returns true for GENERAL/PREMIERE', () => {
      expect(isSupportedCombination(Subject.GENERAL, Grade.PREMIERE)).toBe(true);
    });

    it('returns true for GENERAL/TERMINALE', () => {
      expect(isSupportedCombination(Subject.GENERAL, Grade.TERMINALE)).toBe(true);
    });

    it('returns false for unknown subject', () => {
      expect(isSupportedCombination('PHYSICS' as Subject, Grade.PREMIERE)).toBe(false);
    });
  });

  describe('getAssessmentConfig', () => {
    it('returns config for DIAGNOSTIC_RAPIDE', () => {
      const config = getAssessmentConfig(Subject.MATHS, Grade.TERMINALE, AssessmentType.DIAGNOSTIC_RAPIDE);
      expect(config.subject).toBe(Subject.MATHS);
      expect(config.grade).toBe(Grade.TERMINALE);
      expect(config.type).toBe(AssessmentType.DIAGNOSTIC_RAPIDE);
      expect(config.totalQuestions).toBe(50);
      expect(config.timeLimit).toBe(25);
      expect(config.allowNSP).toBe(true);
    });

    it('returns config for BILAN_COMPLET', () => {
      const config = getAssessmentConfig(Subject.NSI, Grade.PREMIERE, AssessmentType.BILAN_COMPLET);
      expect(config.subject).toBe(Subject.NSI);
      expect(config.grade).toBe(Grade.PREMIERE);
      expect(config.totalQuestions).toBe(100);
      expect(config.timeLimit).toBe(60);
    });

    it('throws for unsupported combination', () => {
      expect(() =>
        getAssessmentConfig('PHYSICS' as Subject, Grade.PREMIERE, AssessmentType.DIAGNOSTIC_RAPIDE)
      ).toThrow('Unsupported combination');
    });
  });

  describe('getCanonicalDomains', () => {
    it('returns MATHS domains for MATHS', () => {
      expect(getCanonicalDomains('MATHS')).toEqual(CANONICAL_DOMAINS_MATHS);
    });

    it('returns NSI domains for NSI', () => {
      expect(getCanonicalDomains('NSI')).toEqual(CANONICAL_DOMAINS_NSI);
    });

    it('returns GENERAL domains for GENERAL', () => {
      expect(getCanonicalDomains('GENERAL')).toEqual(CANONICAL_DOMAINS_GENERAL);
    });

    it('returns MATHS domains as fallback for unknown subject', () => {
      expect(getCanonicalDomains('UNKNOWN')).toEqual(CANONICAL_DOMAINS_MATHS);
    });
  });

  describe('backfillCanonicalDomains', () => {
    it('fills missing domains with 0', () => {
      const result = backfillCanonicalDomains('MATHS', { analyse: 80 });
      expect(result.analyse).toBe(80);
      expect(result.combinatoire).toBe(0);
      expect(result.geometrie).toBe(0);
      expect(result.logExp).toBe(0);
      expect(result.probabilites).toBe(0);
    });

    it('preserves existing scores', () => {
      const partial = { analyse: 90, combinatoire: 75, geometrie: 60, logExp: 50, probabilites: 40 };
      const result = backfillCanonicalDomains('MATHS', partial);
      expect(result).toEqual(partial);
    });

    it('replaces NaN with 0', () => {
      const result = backfillCanonicalDomains('MATHS', { analyse: NaN });
      expect(result.analyse).toBe(0);
    });

    it('replaces undefined with 0', () => {
      const result = backfillCanonicalDomains('MATHS', { analyse: undefined });
      expect(result.analyse).toBe(0);
    });

    it('replaces null with 0', () => {
      const result = backfillCanonicalDomains('MATHS', { analyse: null as unknown as number });
      expect(result.analyse).toBe(0);
    });

    it('works for NSI domains', () => {
      const result = backfillCanonicalDomains('NSI', { python: 100 });
      expect(result.python).toBe(100);
      expect(result.poo).toBe(0);
      expect(result.structures).toBe(0);
      expect(result.algorithmique).toBe(0);
      expect(result.sql).toBe(0);
      expect(result.architecture).toBe(0);
    });

    it('works for GENERAL domains', () => {
      const result = backfillCanonicalDomains('GENERAL', {});
      expect(Object.keys(result)).toHaveLength(4);
      expect(result.methodologie).toBe(0);
    });
  });

  describe('getCategoryLabels', () => {
    it('returns MATHS categories', () => {
      expect(getCategoryLabels(Subject.MATHS)).toEqual(MATHS_CATEGORIES);
    });

    it('returns NSI categories', () => {
      expect(getCategoryLabels(Subject.NSI)).toEqual(NSI_CATEGORIES);
    });

    it('returns GENERAL categories', () => {
      expect(getCategoryLabels(Subject.GENERAL)).toEqual(GENERAL_CATEGORIES);
    });

    it('throws for unknown subject', () => {
      expect(() => getCategoryLabels('PHYSICS' as Subject)).toThrow('Unknown subject');
    });
  });

  describe('getCompetencyLabels', () => {
    it('returns MATHS competencies', () => {
      expect(getCompetencyLabels(Subject.MATHS)).toEqual(MATHS_COMPETENCIES);
    });

    it('returns NSI competencies', () => {
      expect(getCompetencyLabels(Subject.NSI)).toEqual(NSI_COMPETENCIES);
    });

    it('returns GENERAL competencies', () => {
      expect(getCompetencyLabels(Subject.GENERAL)).toEqual(GENERAL_COMPETENCIES);
    });

    it('throws for unknown subject', () => {
      expect(() => getCompetencyLabels('PHYSICS' as Subject)).toThrow('Unknown subject');
    });
  });
});
