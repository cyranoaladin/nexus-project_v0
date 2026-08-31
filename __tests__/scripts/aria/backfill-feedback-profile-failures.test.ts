import {
  backfillAriaFeedbackProfiles,
  planAriaFeedbackProfileBackfill,
  rollbackAriaFeedbackProfileBackfill,
} from '@/scripts/aria/backfill-feedback-profile';

const source = {
  messageId: 'message-1', conversationId: 'conversation-1',
  studentId: 'student-1', feedback: true,
};
const planned = planAriaFeedbackProfileBackfill({
  feedbackSources: [source], canonicalFeedbacks: [], profiles: [],
});
const digest = planned.sourceDigest;
const prerequisiteRunId = 'audit-run-1';
const validProfile = {
  profileId: 'profile-1', studentId: 'student-1', selectedCourseKeys: [], uiPreferences: {},
  preferencesVersion: 1, pinnedCourseKeys: [], focusedCourseKey: null,
  courseOrder: [], showCitations: true,
};
const profilePlanned = planAriaFeedbackProfileBackfill({
  feedbackSources: [], canonicalFeedbacks: [], profiles: [validProfile],
});

function fakePool(query: jest.Mock) {
  const client = { query, release: jest.fn() };
  return {
    pool: { connect: jest.fn().mockResolvedValue(client) },
    client,
  };
}

function applyQuery(input: Readonly<{
  concurrentUseful?: boolean;
  feedbackAuditRowCount?: number;
  terminalRowCount?: number;
}>) {
  return jest.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (sql.includes('FROM aria_messages message') && sql.includes('JOIN aria_conversations')) {
      return {
        rowCount: 1,
        rows: [{
          ...source,
        }],
      };
    }
    if (sql.includes('FROM aria_feedbacks WHERE "messageId" = ANY')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM aria_learning_profiles')) return { rowCount: 0, rows: [] };
    if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'APPLY'")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'DRY_RUN'")) {
      return {
        rowCount: 1,
        rows: [{
          status: 'COMPLETED', sourceDigest: digest, sourceSnapshot: planned.sourceSnapshot,
          scannedCount: 1, deterministicCount: 1, manualReviewCount: 0,
        }],
      };
    }
    if (sql.includes('INSERT INTO aria_data_migration_runs')) {
      return { rowCount: 1, rows: [{ id: 'run-1' }] };
    }
    if (sql.includes('INSERT INTO aria_feedbacks')) return { rowCount: 0, rows: [] };
    if (sql.includes('SELECT id, "studentId", useful FROM aria_feedbacks')) {
      return {
        rowCount: 1,
        rows: [{
          id: 'feedback-1', studentId: 'student-1', useful: input.concurrentUseful,
        }],
      };
    }
    if (sql.includes('INSERT INTO aria_data_migration_row_audits')) {
      return { rowCount: input.feedbackAuditRowCount ?? 1, rows: [] };
    }
    if (sql.includes('UPDATE aria_data_migration_runs')) {
      return { rowCount: input.terminalRowCount ?? 1, rows: [] };
    }
    return { rowCount: 1, rows: [{}] };
  });
}

function profileApplyQuery(profileAuditRowCount: number) {
  return jest.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (sql.includes('FROM aria_messages message') && sql.includes('JOIN aria_conversations')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM aria_learning_profiles')) return { rowCount: 1, rows: [validProfile] };
    if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'APPLY'")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'DRY_RUN'")) {
      return {
        rowCount: 1,
        rows: [{
          status: 'COMPLETED', sourceDigest: profilePlanned.sourceDigest,
          sourceSnapshot: profilePlanned.sourceSnapshot, scannedCount: 1,
          deterministicCount: 1, manualReviewCount: 0,
        }],
      };
    }
    if (sql.includes('INSERT INTO aria_data_migration_runs')) {
      return { rowCount: 1, rows: [{ id: 'profile-run-1' }] };
    }
    if (sql.includes('INSERT INTO aria_data_migration_row_audits')) {
      return { rowCount: profileAuditRowCount, rows: [] };
    }
    return { rowCount: 1, rows: [{}] };
  });
}

describe('ARIA feedback/profile backfill failure and concurrency boundaries', () => {
  it('rejects an invalid source digest and rolls back the wrapper transaction', async () => {
    const seen: string[] = [];
    const query = jest.fn(async (sql: string) => {
      seen.push(sql);
      return { rowCount: 0, rows: [] };
    });
    const { pool, client } = fakePool(query);
    await expect(backfillAriaFeedbackProfiles(pool as never, {
      runId: 'run-1', sourceDigest: 'invalid', mode: 'APPLY',
    })).rejects.toThrow('ARIA_FEEDBACK_PROFILE_SOURCE_DIGEST_INVALID');
    expect(seen).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('reconciles an identical canonical feedback inserted by a concurrent writer', async () => {
    const query = applyQuery({ concurrentUseful: true });
    const { pool, client } = fakePool(query);
    const report = await backfillAriaFeedbackProfiles(pool as never, {
      runId: 'run-1', sourceDigest: digest, prerequisiteRunId, mode: 'APPLY',
    });
    expect(report).toMatchObject({
      feedback: { scanned: 1, deterministic: 1, manualReview: 0, mutated: 0 },
      profiles: { scanned: 0, deterministic: 0, manualReview: 0, mutated: 0 },
    });
    expect(report.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(report.sourceSnapshot.target).toBe('feedback-profile');
    expect(query.mock.calls.map(([sql]) => sql)).toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects an opposite concurrent feedback and rolls back without corrupting canonical state', async () => {
    const query = applyQuery({ concurrentUseful: false });
    const { pool, client } = fakePool(query);
    await expect(backfillAriaFeedbackProfiles(pool as never, {
      runId: 'run-1', sourceDigest: digest, prerequisiteRunId, mode: 'APPLY',
    })).rejects.toThrow('ARIA_FEEDBACK_BACKFILL_CONCURRENT_CONFLICT');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('B4_APPLY_REJECTS_FEEDBACK_AUDIT_INSERT_CONFLICT', async () => {
    const query = applyQuery({ concurrentUseful: true, feedbackAuditRowCount: 0 });
    const { pool } = fakePool(query);

    await expect(backfillAriaFeedbackProfiles(pool as never, {
      runId: 'run-1', sourceDigest: digest, prerequisiteRunId, mode: 'APPLY',
    })).rejects.toThrow('ARIA_FEEDBACK_PROFILE_BACKFILL_AUDIT_INSERT_CONFLICT');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
  });

  it('B4_APPLY_REJECTS_PROFILE_AUDIT_INSERT_CONFLICT', async () => {
    const query = profileApplyQuery(0);
    const { pool } = fakePool(query);

    await expect(backfillAriaFeedbackProfiles(pool as never, {
      runId: 'profile-run-1', sourceDigest: profilePlanned.sourceDigest,
      prerequisiteRunId, mode: 'APPLY',
    })).rejects.toThrow('ARIA_FEEDBACK_PROFILE_BACKFILL_AUDIT_INSERT_CONFLICT');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
  });

  it('B4_APPLY_REJECTS_TERMINAL_TRANSITION_LOSS', async () => {
    const query = applyQuery({ concurrentUseful: true, terminalRowCount: 0 });
    const { pool } = fakePool(query);

    await expect(backfillAriaFeedbackProfiles(pool as never, {
      runId: 'run-1', sourceDigest: digest, prerequisiteRunId, mode: 'APPLY',
    })).rejects.toThrow('ARIA_FEEDBACK_PROFILE_BACKFILL_TERMINAL_CONFLICT');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
  });

  it('rejects a completed replay whose persisted planner seal is corrupt', async () => {
    const snapshot = planned.sourceSnapshot;
    const query = jest.fn(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
      if (sql.includes('FROM aria_messages message')) return { rowCount: 1, rows: [source] };
      if (sql.includes('FROM aria_feedbacks WHERE "messageId" = ANY')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('FROM aria_learning_profiles')) return { rowCount: 0, rows: [] };
      if (sql.includes('INSERT INTO aria_data_migration_runs')) return { rowCount: 0, rows: [] };
      if (sql.includes('FROM aria_data_migration_runs')) {
        return {
          rowCount: 1,
          rows: [{
            id: 'new-run', prerequisiteRunId, status: 'COMPLETED',
            sourceSnapshot: { ...snapshot, unitsSha256: '0'.repeat(64) },
            scannedCount: 1, deterministicCount: 1, manualReviewCount: 0, mutatedCount: 1,
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    });
    const { pool, client } = fakePool(query);

    await expect(backfillAriaFeedbackProfiles(pool as never, {
      runId: 'new-run', sourceDigest: digest, prerequisiteRunId, mode: 'APPLY',
    })).rejects.toThrow('ARIA_BACKFILL_REPLAY_SEAL_INVALID');
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
      if (sql.includes('SELECT DISTINCT dependent_run.id')) {
        return { rowCount: 0, rows: [] };
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

  it('rejects rollback when another live APPLY run references a created feedback target', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK'
        || sql.startsWith('LOCK TABLE aria_data_migration_row_audits')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('SELECT status::text')) {
        return { rowCount: 1, rows: [{ status: 'COMPLETED' }] };
      }
      if (sql.includes('SELECT DISTINCT dependent_run.id')) {
        return { rowCount: 1, rows: [{ id: 'later-run' }] };
      }
      if (sql.includes('FROM aria_data_migration_row_audits')) {
        return {
          rowCount: 1,
          rows: [{
            sourceId: 'message-1', targetId: 'feedback-1',
            sourceFingerprint: 'a'.repeat(64),
            targetKey: { afterFingerprint: 'b'.repeat(64), created: true },
            beforeImage: { feedback: true },
          }],
        };
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const { pool, client } = fakePool(query);
    await expect(rollbackAriaFeedbackProfileBackfill(pool as never, 'run-1'))
      .rejects.toThrow('ARIA_FEEDBACK_PROFILE_ROLLBACK_DEPENDENCY_CONFLICT');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
