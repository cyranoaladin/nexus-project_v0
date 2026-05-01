import { describe, it, expect } from '@jest/globals';
import { isPremiereLevel, type StudentGradeLevel } from '@/lib/coach/gradeLevel';

describe('isPremiereLevel helper', () => {
  it('returns true for PREMIERE (uppercase)', () => {
    const student: StudentGradeLevel = {
      gradeLevel: 'PREMIERE',
    };
    expect(isPremiereLevel(student)).toBe(true);
  });

  it('returns true for premiere (lowercase)', () => {
    const student: StudentGradeLevel = {
      gradeLevel: 'premiere',
    };
    expect(isPremiereLevel(student)).toBe(true);
  });

  it('returns true for Premiere (mixed case)', () => {
    const student: StudentGradeLevel = {
      gradeLevel: 'Premiere',
    };
    expect(isPremiereLevel(student)).toBe(true);
  });

  it('returns false for TERMINALE', () => {
    const student: StudentGradeLevel = {
      gradeLevel: 'TERMINALE',
    };
    expect(isPremiereLevel(student)).toBe(false);
  });

  it('returns false for SECONDE', () => {
    const student: StudentGradeLevel = {
      gradeLevel: 'SECONDE',
    };
    expect(isPremiereLevel(student)).toBe(false);
  });

  it('returns false for undefined gradeLevel', () => {
    const student: StudentGradeLevel = {};
    expect(isPremiereLevel(student)).toBe(false);
  });

  it('returns false for null gradeLevel', () => {
    const student: StudentGradeLevel = {
      gradeLevel: undefined,
    };
    expect(isPremiereLevel(student)).toBe(false);
  });

  it('returns false for empty string gradeLevel', () => {
    const student: StudentGradeLevel = {
      gradeLevel: '',
    };
    expect(isPremiereLevel(student)).toBe(false);
  });
});
