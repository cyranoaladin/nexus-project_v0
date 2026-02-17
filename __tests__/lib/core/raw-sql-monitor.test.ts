/**
 * Unit Tests — Raw SQL Monitor
 *
 * Tests for incrementRawSqlFailure, getRawSqlFailureCount, resetRawSqlFailureCount.
 * Pure functions — no DB dependency.
 */

import {
  incrementRawSqlFailure,
  getRawSqlFailureCount,
  resetRawSqlFailureCount,
} from '@/lib/core/raw-sql-monitor';

describe('raw-sql-monitor', () => {
  beforeEach(() => {
    resetRawSqlFailureCount();
  });

  it('starts at 0', () => {
    expect(getRawSqlFailureCount()).toBe(0);
  });

  it('increments and returns new count', () => {
    expect(incrementRawSqlFailure()).toBe(1);
    expect(incrementRawSqlFailure()).toBe(2);
    expect(incrementRawSqlFailure()).toBe(3);
    expect(getRawSqlFailureCount()).toBe(3);
  });

  it('resets to 0', () => {
    incrementRawSqlFailure();
    incrementRawSqlFailure();
    expect(getRawSqlFailureCount()).toBe(2);
    resetRawSqlFailureCount();
    expect(getRawSqlFailureCount()).toBe(0);
  });

  it('can increment after reset', () => {
    incrementRawSqlFailure();
    resetRawSqlFailureCount();
    expect(incrementRawSqlFailure()).toBe(1);
  });
});
