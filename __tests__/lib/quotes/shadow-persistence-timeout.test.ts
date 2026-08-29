/**
 * logShadowComparisonWithTimeout (mission recâblage §4 finding) — shadow
 * mode's own stated contract is "never blocks" the family-facing response,
 * but the call site awaits the DB write with no bound, so a hang
 * previously cost its full duration. This bounds it deterministically.
 */
jest.mock('@/lib/prisma', () => ({ prisma: { shadowComparisonLog: { create: jest.fn() } } }));

import { prisma } from '@/lib/prisma';
import { logShadowComparisonWithTimeout, SHADOW_LOG_TIMEOUT_MS } from '@/lib/quotes/shadow-persistence.server';
import type { ShadowComparisonRecord } from '@/lib/quotes/shadow-comparison';

const mockCreate = prisma.shadowComparisonLog.create as jest.Mock;

const RECORD: ShadowComparisonRecord = {
  situationChecksum: 'abc',
  divergenceCategory: 'IDENTICAL',
  legacySummary: { subjects: [], priceAnnualTnd: null, depositTnd: null, installmentTnd: null, status: 'x', warningsCount: 0 },
  newSummary: { subjects: [], priceAnnualTnd: null, depositTnd: null, installmentTnd: null, status: 'x', warningsCount: 0 },
  detail: '',
};

describe('logShadowComparisonWithTimeout', () => {
  test('a fast write resolves normally', async () => {
    mockCreate.mockResolvedValue({ id: 'log-1' });
    await expect(logShadowComparisonWithTimeout(RECORD, 2000)).resolves.toBeUndefined();
  });

  test('a hung write rejects at the timeout boundary — never waits indefinitely', async () => {
    jest.useFakeTimers();
    mockCreate.mockImplementation(() => new Promise(() => {})); // never resolves
    const promise = logShadowComparisonWithTimeout(RECORD, 50);
    const assertion = expect(promise).rejects.toThrow(/exceeded 50ms/);
    jest.advanceTimersByTime(50);
    await assertion;
    jest.useRealTimers();
  });

  test('the default timeout is a small, bounded constant, not effectively unbounded', () => {
    expect(SHADOW_LOG_TIMEOUT_MS).toBeGreaterThan(0);
    expect(SHADOW_LOG_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });
});
