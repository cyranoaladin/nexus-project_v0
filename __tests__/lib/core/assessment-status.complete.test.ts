/**
 * Assessment Status Helpers — Complete Test Suite
 *
 * Tests: COMPLETED_STATUSES, isCompletedAssessmentStatus
 *
 * Source: lib/core/assessment-status.ts
 */

import {
  COMPLETED_STATUSES,
  isCompletedAssessmentStatus,
} from '@/lib/core/assessment-status';

// ─── COMPLETED_STATUSES ──────────────────────────────────────────────────────

describe('COMPLETED_STATUSES', () => {
  it('should contain COMPLETED', () => {
    expect(COMPLETED_STATUSES).toContain('COMPLETED');
  });

  it('should be a readonly array', () => {
    expect(Array.isArray(COMPLETED_STATUSES)).toBe(true);
  });

  it('should have at least 1 status', () => {
    expect(COMPLETED_STATUSES.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── isCompletedAssessmentStatus ─────────────────────────────────────────────

describe('isCompletedAssessmentStatus', () => {
  it('should return true for COMPLETED', () => {
    expect(isCompletedAssessmentStatus('COMPLETED')).toBe(true);
  });

  it('should return false for PENDING', () => {
    expect(isCompletedAssessmentStatus('PENDING')).toBe(false);
  });

  it('should return false for SCORING', () => {
    expect(isCompletedAssessmentStatus('SCORING')).toBe(false);
  });

  it('should return false for GENERATING', () => {
    expect(isCompletedAssessmentStatus('GENERATING')).toBe(false);
  });

  it('should return false for FAILED', () => {
    expect(isCompletedAssessmentStatus('FAILED')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isCompletedAssessmentStatus(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isCompletedAssessmentStatus(undefined)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isCompletedAssessmentStatus('')).toBe(false);
  });

  it('should return false for lowercase "completed"', () => {
    expect(isCompletedAssessmentStatus('completed')).toBe(false);
  });

  it('should return false for unknown status', () => {
    expect(isCompletedAssessmentStatus('ARCHIVED')).toBe(false);
    expect(isCompletedAssessmentStatus('DELETED')).toBe(false);
  });

  it('should be deterministic across 100 calls', () => {
    const results = Array.from({ length: 100 }, () =>
      isCompletedAssessmentStatus('COMPLETED')
    );
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(true);
  });
});
