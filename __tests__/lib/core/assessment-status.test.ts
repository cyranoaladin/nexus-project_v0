/**
 * Unit Tests — Assessment Status Helpers
 *
 * Tests for isCompletedAssessmentStatus and COMPLETED_STATUSES.
 * Pure functions — no DB dependency.
 */

import {
  isCompletedAssessmentStatus,
  COMPLETED_STATUSES,
} from '@/lib/core/assessment-status';

describe('COMPLETED_STATUSES', () => {
  it('contains COMPLETED', () => {
    expect(COMPLETED_STATUSES).toContain('COMPLETED');
  });

  it('is a readonly array', () => {
    expect(Array.isArray(COMPLETED_STATUSES)).toBe(true);
  });

  it('does not contain FAILED', () => {
    expect((COMPLETED_STATUSES as readonly string[]).includes('FAILED')).toBe(false);
  });

  it('does not contain PENDING', () => {
    expect((COMPLETED_STATUSES as readonly string[]).includes('PENDING')).toBe(false);
  });
});

describe('isCompletedAssessmentStatus', () => {
  it('returns true for COMPLETED', () => {
    expect(isCompletedAssessmentStatus('COMPLETED')).toBe(true);
  });

  it('returns false for PENDING', () => {
    expect(isCompletedAssessmentStatus('PENDING')).toBe(false);
  });

  it('returns false for SCORING', () => {
    expect(isCompletedAssessmentStatus('SCORING')).toBe(false);
  });

  it('returns false for GENERATING', () => {
    expect(isCompletedAssessmentStatus('GENERATING')).toBe(false);
  });

  it('returns false for FAILED', () => {
    expect(isCompletedAssessmentStatus('FAILED')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isCompletedAssessmentStatus(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isCompletedAssessmentStatus(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isCompletedAssessmentStatus('')).toBe(false);
  });

  it('returns false for unknown status', () => {
    expect(isCompletedAssessmentStatus('ARCHIVED')).toBe(false);
    expect(isCompletedAssessmentStatus('completed')).toBe(false);
    expect(isCompletedAssessmentStatus('Completed')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isCompletedAssessmentStatus('completed')).toBe(false);
    expect(isCompletedAssessmentStatus('COMPLETED')).toBe(true);
  });
});
