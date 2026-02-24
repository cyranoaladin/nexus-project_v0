/**
 * Raw SQL Fallback Monitor — Complete Test Suite
 *
 * Tests: incrementRawSqlFailure, getRawSqlFailureCount, resetRawSqlFailureCount
 *
 * Source: lib/core/raw-sql-monitor.ts
 */

import {
  incrementRawSqlFailure,
  getRawSqlFailureCount,
  resetRawSqlFailureCount,
} from '@/lib/core/raw-sql-monitor';

beforeEach(() => {
  resetRawSqlFailureCount();
});

// ─── getRawSqlFailureCount ───────────────────────────────────────────────────

describe('getRawSqlFailureCount', () => {
  it('should return 0 after reset', () => {
    expect(getRawSqlFailureCount()).toBe(0);
  });

  it('should return current count', () => {
    incrementRawSqlFailure();
    incrementRawSqlFailure();
    expect(getRawSqlFailureCount()).toBe(2);
  });
});

// ─── incrementRawSqlFailure ──────────────────────────────────────────────────

describe('incrementRawSqlFailure', () => {
  it('should increment count by 1', () => {
    expect(incrementRawSqlFailure()).toBe(1);
    expect(incrementRawSqlFailure()).toBe(2);
    expect(incrementRawSqlFailure()).toBe(3);
  });

  it('should return the new count', () => {
    const count = incrementRawSqlFailure();
    expect(count).toBe(getRawSqlFailureCount());
  });

  it('should be monotonically increasing', () => {
    const counts = Array.from({ length: 10 }, () => incrementRawSqlFailure());
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBe(counts[i - 1] + 1);
    }
  });
});

// ─── resetRawSqlFailureCount ─────────────────────────────────────────────────

describe('resetRawSqlFailureCount', () => {
  it('should reset count to 0', () => {
    incrementRawSqlFailure();
    incrementRawSqlFailure();
    expect(getRawSqlFailureCount()).toBe(2);

    resetRawSqlFailureCount();
    expect(getRawSqlFailureCount()).toBe(0);
  });

  it('should allow re-incrementing after reset', () => {
    incrementRawSqlFailure();
    resetRawSqlFailureCount();
    expect(incrementRawSqlFailure()).toBe(1);
  });

  it('should be idempotent when called multiple times', () => {
    resetRawSqlFailureCount();
    resetRawSqlFailureCount();
    resetRawSqlFailureCount();
    expect(getRawSqlFailureCount()).toBe(0);
  });
});
