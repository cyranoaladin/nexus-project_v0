import {
  backfillAriaFeedbackProfiles,
  rollbackAriaFeedbackProfileBackfill,
} from '@/scripts/aria/backfill-feedback-profile';

const digest = 'a'.repeat(64);

function fakePool(query: jest.Mock) {
  const client = { query, release: jest.fn() };
  return {
    pool: { connect: jest.fn().mockResolvedValue(client) },
    client,
  };
}

function applyQuery(input: Readonly<{ concurrentUseful?: boolean }>) {
  return jest.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (sql.includes('FROM aria_messages message') && sql.includes('LEFT JOIN aria_feedbacks')) {
      return {
        rowCount: 1,
        rows: [{
          messageId: 'message-1', studentId: 'student-1', feedback: true,
          canonicalId: null, canonicalUseful: null,
        }],
      };
    }
    if (sql.includes('FROM aria_learning_profiles')) return { rowCount: 0, rows: [] };
    if (sql.includes('INSERT INTO aria_data_migration_runs')) {
      return { rowCount: 1, rows: [{ id: 'run-1' }] };
    }
    if (sql.includes('INSERT INTO aria_feedbacks')) return { rowCount: 0, rows: [] };
    if (sql.includes('SELECT id, useful FROM aria_feedbacks')) {
      return { rowCount: 1, rows: [{ id: 'feedback-1', useful: input.concurrentUseful }] };
    }
    return { rowCount: 1, rows: [{}] };
  });
}

describe('ARIA feedback/profile backfill failure and concurrency boundaries', () => {
  it('rejects an invalid source digest and rolls back the wrapper transaction', async () => {
    const query = jest.fn(async (_sql: string) => ({ rowCount: 0, rows: [] }));
    const { pool, client } = fakePool(query);
    await expect(backfillAriaFeedbackProfiles(pool as never, {
      runId: 'run-1', sourceDigest: 'invalid', mode: 'APPLY',
    })).rejects.toThrow('ARIA_FEEDBACK_PROFILE_SOURCE_DIGEST_INVALID');
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('reconciles an identical canonical feedback inserted by a concurrent writer', async () => {
    const query = applyQuery({ concurrentUseful: true });
    const { pool, client } = fakePool(query);
    await expect(backfillAriaFeedbackProfiles(pool as never, {
      runId: 'run-1', sourceDigest: digest, mode: 'APPLY',
    })).resolves.toEqual({
      feedback: { scanned: 1, deterministic: 1, manualReview: 0, mutated: 0 },
      profiles: { scanned: 0, deterministic: 0, manualReview: 0, mutated: 0 },
    });
    expect(query.mock.calls.map(([sql]) => sql)).toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects an opposite concurrent feedback and rolls back without corrupting canonical state', async () => {
    const query = applyQuery({ concurrentUseful: false });
    const { pool, client } = fakePool(query);
    await expect(backfillAriaFeedbackProfiles(pool as never, {
      runId: 'run-1', sourceDigest: digest, mode: 'APPLY',
    })).rejects.toThrow('ARIA_FEEDBACK_BACKFILL_CONCURRENT_CONFLICT');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects rollback for an unknown or incomplete migration run', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT status::text')) return { rowCount: 0, rows: [] };
      return { rowCount: 0, rows: [] };
    });
    const { pool, client } = fakePool(query);
    await expect(rollbackAriaFeedbackProfileBackfill(pool as never, 'missing-run'))
      .rejects.toThrow('ARIA_FEEDBACK_PROFILE_ROLLBACK_RUN_NOT_COMPLETED');
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      expect.stringContaining('SELECT status::text'),
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects rollback when either the legacy source or canonical target drifted', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT status::text')) {
        return { rowCount: 1, rows: [{ status: 'COMPLETED' }] };
      }
      if (sql.includes('FROM aria_data_migration_row_audits')) {
        return {
          rowCount: 1,
          rows: [{
            sourceId: 'message-1', targetId: 'feedback-1',
            sourceFingerprint: 'wrong-fingerprint', beforeImage: { feedback: true },
          }],
        };
      }
      if (sql.includes('FROM aria_messages message')) {
        return { rowCount: 1, rows: [{ feedback: true, useful: true }] };
      }
      return { rowCount: 0, rows: [] };
    });
    const { pool, client } = fakePool(query);
    await expect(rollbackAriaFeedbackProfileBackfill(pool as never, 'run-1'))
      .rejects.toThrow('ARIA_FEEDBACK_PROFILE_ROLLBACK_FINGERPRINT_CONFLICT');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
