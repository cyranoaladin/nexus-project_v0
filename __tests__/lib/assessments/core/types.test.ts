/**
 * Tests for lib/assessments/core/types.ts
 *
 * Covers: isMathsMetrics, isNsiMetrics, isGenericMetrics type guards
 */

import {
  isMathsMetrics,
  isNsiMetrics,
  isGenericMetrics,
  Subject,
  Grade,
  AssessmentType,
  AssessmentStatus,
  Audience,
} from '@/lib/assessments/core/types';
import type { MathsMetrics, NsiMetrics, GenericMetrics } from '@/lib/assessments/core/types';

describe('Assessment Type Guards', () => {
  const mathsMetrics: MathsMetrics = {
    raisonnement: 80,
    calcul: 70,
    abstraction: 60,
    categoryScores: { algebre: 75, analyse: 85 },
  };

  const nsiMetrics: NsiMetrics = {
    logique: 90,
    syntaxe: 80,
    optimisation: 70,
    debuggage: 60,
    categoryScores: { python: 85, poo: 75 },
  };

  const genericMetrics: GenericMetrics = {
    comprehension: 80,
    analyse: 70,
    application: 60,
    categoryScores: { methodologie: 75 },
  };

  describe('isMathsMetrics', () => {
    it('returns true for MathsMetrics', () => {
      expect(isMathsMetrics(mathsMetrics)).toBe(true);
    });

    it('returns false for NsiMetrics', () => {
      expect(isMathsMetrics(nsiMetrics)).toBe(false);
    });

    it('returns false for GenericMetrics', () => {
      expect(isMathsMetrics(genericMetrics)).toBe(false);
    });
  });

  describe('isNsiMetrics', () => {
    it('returns true for NsiMetrics', () => {
      expect(isNsiMetrics(nsiMetrics)).toBe(true);
    });

    it('returns false for MathsMetrics', () => {
      expect(isNsiMetrics(mathsMetrics)).toBe(false);
    });

    it('returns false for GenericMetrics', () => {
      expect(isNsiMetrics(genericMetrics)).toBe(false);
    });
  });

  describe('isGenericMetrics', () => {
    it('returns true for GenericMetrics', () => {
      expect(isGenericMetrics(genericMetrics)).toBe(true);
    });

    it('returns false for MathsMetrics', () => {
      expect(isGenericMetrics(mathsMetrics)).toBe(false);
    });

    it('returns false for NsiMetrics', () => {
      expect(isGenericMetrics(nsiMetrics)).toBe(false);
    });
  });
});

describe('Assessment Enums', () => {
  it('Subject has expected values', () => {
    expect(Subject.MATHS).toBe('MATHS');
    expect(Subject.NSI).toBe('NSI');
    expect(Subject.GENERAL).toBe('GENERAL');
  });

  it('Grade has expected values', () => {
    expect(Grade.PREMIERE).toBe('PREMIERE');
    expect(Grade.TERMINALE).toBe('TERMINALE');
  });

  it('AssessmentType has expected values', () => {
    expect(AssessmentType.DIAGNOSTIC_RAPIDE).toBe('DIAGNOSTIC_RAPIDE');
    expect(AssessmentType.BILAN_COMPLET).toBe('BILAN_COMPLET');
  });

  it('AssessmentStatus has expected values', () => {
    expect(AssessmentStatus.PENDING).toBe('PENDING');
    expect(AssessmentStatus.SUBMITTED).toBe('SUBMITTED');
    expect(AssessmentStatus.PROCESSING).toBe('PROCESSING');
    expect(AssessmentStatus.COMPLETED).toBe('COMPLETED');
    expect(AssessmentStatus.FAILED).toBe('FAILED');
  });

  it('Audience has expected values', () => {
    expect(Audience.ELEVE).toBe('ELEVE');
    expect(Audience.PARENTS).toBe('PARENTS');
    expect(Audience.NEXUS).toBe('NEXUS');
  });
});
