import {
  backfillConversationContexts,
  planConversationContextBackfill,
  type LegacyContextEvidence,
} from '@/scripts/aria/backfill-conversation-context';

const legacyConversation = {
  id: 'conversation-b1',
  studentId: 'student-b1',
  subject: 'MATHEMATIQUES',
  skillId: 'skill-b1',
  resourceId: null,
  courseKey: null,
  contextState: 'LEGACY_CONTEXT_UNRESOLVED',
};

const contextEvidence: LegacyContextEvidence = {
  skillCourseCandidates: new Map([['skill-b1', ['eds-maths-premiere']]]),
  resourceCourseCandidates: new Map(),
  academicSubjectCandidates: new Map(),
};

function contextApplyFixture(failure: 'UPDATE' | 'AUDIT' | 'TERMINAL') {
  const plan = planConversationContextBackfill([legacyConversation], contextEvidence);
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("mode = 'APPLY'") && sql.includes('SELECT status::text')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM aria_conversations') && sql.includes('FOR UPDATE')) {
      return { rowCount: 1, rows: [legacyConversation] };
    }
    if (sql.includes("mode = 'DRY_RUN'") && sql.includes('SELECT status::text')) {
      return {
        rowCount: 1,
        rows: [{
          status: 'COMPLETED',
          sourceDigest: plan.sourceDigest,
          sourceSnapshot: plan.sourceSnapshot,
        }],
      };
    }
    if (sql.includes('INSERT INTO aria_data_migration_runs')) {
      return { rowCount: 1, rows: [{ id: 'apply-run-b1' }] };
    }
    if (sql.includes('UPDATE aria_conversations')) {
      return failure === 'UPDATE'
        ? { rowCount: 0, rows: [] }
        : { rowCount: 1, rows: [{ id: legacyConversation.id }] };
    }
    if (sql.includes('INSERT INTO aria_data_migration_row_audits')) {
      return failure === 'AUDIT' ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [] };
    }
    if (sql.includes('UPDATE aria_data_migration_runs')) {
      return failure === 'TERMINAL' ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [] };
    }
    throw new Error(`UNEXPECTED_QUERY:${sql}`);
  });
  return {
    client: { query } as never,
    options: {
      runId: 'apply-run-b1',
      mode: 'APPLY' as const,
      sourceDigest: plan.sourceDigest,
      prerequisiteRunId: 'apply-run-b1-audit',
      evidence: contextEvidence,
    },
    query,
  };
}

describe('ARIA conversation-context backfill persistence fencing', () => {
  it.each([
    ['UPDATE', 'ARIA_CONVERSATION_CONTEXT_BACKFILL_UPDATE_CONFLICT'],
    ['AUDIT', 'ARIA_CONVERSATION_CONTEXT_BACKFILL_AUDIT_INSERT_CONFLICT'],
    ['TERMINAL', 'ARIA_CONVERSATION_CONTEXT_BACKFILL_TERMINAL_CONFLICT'],
  ] as const)(
    'B1_APPLY_REJECTS_%s_CAS_LOSS',
    async (failure, expectedError) => {
      const fixture = contextApplyFixture(failure);

      await expect(backfillConversationContexts(fixture.client, fixture.options))
        .rejects.toThrow(expectedError);

      if (failure === 'UPDATE') {
        expect(fixture.query.mock.calls.some(([sql]) =>
          String(sql).includes('INSERT INTO aria_data_migration_row_audits'))).toBe(false);
      }
      if (failure === 'AUDIT') {
        expect(fixture.query.mock.calls.some(([sql]) =>
          String(sql).includes('SET status = \'COMPLETED\''))).toBe(false);
      }
    },
  );

  it('B1_DRY_RUN_RETURNS_THE_EXACT_IMMUTABLE_PLAN_WITHOUT_MUTATION', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1, rows: [legacyConversation] });

    const result = await backfillConversationContexts({ query } as never, {
      runId: 'dry-run-b1',
      mode: 'DRY_RUN',
      sourceDigest: '0'.repeat(64),
      evidence: contextEvidence,
    });

    expect(result).toMatchObject({
      scanned: 1, deterministic: 1, archived: 0, manualReview: 0, mutated: 0,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['MISSING_ID', null],
    ['MISSING_ROW', { rowCount: 0, rows: [] }],
    ['DUPLICATE_ROW', { rowCount: 2, rows: [] }],
    ['RUNNING', { status: 'RUNNING' }],
    ['DIGEST_DRIFT', { sourceDigest: 'f'.repeat(64) }],
    ['INVALID_SNAPSHOT', { sourceSnapshot: {} }],
  ] as const)(
    'B1_APPLY_REQUIRES_EXACT_PREREQUISITE_%s',
    async (_caseName, override) => {
      const plan = planConversationContextBackfill([legacyConversation], contextEvidence);
      const query = jest.fn(async (sql: string) => {
        if (sql.includes("mode = 'APPLY'")) return { rowCount: 0, rows: [] };
        if (sql.includes('FROM aria_conversations')) {
          return { rowCount: 1, rows: [legacyConversation] };
        }
        if (sql.includes("mode = 'DRY_RUN'")) {
          if (override && 'rowCount' in override) return override;
          return {
            rowCount: 1,
            rows: [{
              status: 'COMPLETED',
              sourceDigest: plan.sourceDigest,
              sourceSnapshot: plan.sourceSnapshot,
              ...(override ?? {}),
            }],
          };
        }
        throw new Error(`UNEXPECTED_QUERY:${sql}`);
      });

      await expect(backfillConversationContexts({ query } as never, {
        runId: 'apply-run-b1',
        mode: 'APPLY',
        sourceDigest: plan.sourceDigest,
        ...(override === null ? {} : { prerequisiteRunId: 'apply-run-b1-audit' }),
        evidence: contextEvidence,
      })).rejects.toThrow('ARIA_CONVERSATION_CONTEXT_SOURCE_SNAPSHOT_MISMATCH');
    },
  );

  it.each([
    ['DUPLICATE_ROW', { rowCount: 2, rows: [] }],
    ['MISSING_ROW', { rowCount: 1, rows: [] }],
    ['RUNNING', { status: 'RUNNING' }],
    ['PREREQUISITE_DRIFT', { prerequisiteRunId: 'other-audit' }],
    ['DIGEST_DRIFT', { sourceDigest: 'f'.repeat(64) }],
  ] as const)(
    'B1_COMPLETED_REPLAY_REJECTS_%s',
    async (_caseName, override) => {
      const plan = planConversationContextBackfill([legacyConversation], contextEvidence);
      const completed = {
        status: 'COMPLETED', prerequisiteRunId: 'apply-run-b1-audit',
        sourceDigest: plan.sourceDigest, sourceSnapshot: plan.sourceSnapshot,
        scannedCount: 1, deterministicCount: 1, archivedCount: 0,
        manualReviewCount: 0, mutatedCount: 1,
      };
      const query = jest.fn(async (sql: string) => {
        if (sql.includes("mode = 'APPLY'")) {
          if ('rowCount' in override) return override;
          return { rowCount: 1, rows: [{ ...completed, ...override }] };
        }
        throw new Error(`UNEXPECTED_QUERY:${sql}`);
      });

      await expect(backfillConversationContexts({ query } as never, {
        runId: 'apply-run-b1', mode: 'APPLY', sourceDigest: plan.sourceDigest,
        prerequisiteRunId: 'apply-run-b1-audit', evidence: contextEvidence,
      })).rejects.toThrow('ARIA_CONVERSATION_CONTEXT_BACKFILL_RUN_NOT_REPLAYABLE');
    },
  );

  it('B1_COMPLETED_REPLAY_REQUIRES_THE_EXACT_PREREQUISITE_SNAPSHOT', async () => {
    const plan = planConversationContextBackfill([legacyConversation], contextEvidence);
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("mode = 'APPLY'")) return {
        rowCount: 1,
        rows: [{
          status: 'COMPLETED', prerequisiteRunId: 'apply-run-b1-audit',
          sourceDigest: plan.sourceDigest, sourceSnapshot: { ...plan.sourceSnapshot, unitsSha256: 'f'.repeat(64) },
          scannedCount: 1, deterministicCount: 1, archivedCount: 0,
          manualReviewCount: 0, mutatedCount: 1,
        }],
      };
      if (sql.includes("mode = 'DRY_RUN'")) return {
        rowCount: 1,
        rows: [{ status: 'COMPLETED', sourceDigest: plan.sourceDigest, sourceSnapshot: plan.sourceSnapshot }],
      };
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });

    await expect(backfillConversationContexts({ query } as never, {
      runId: 'apply-run-b1', mode: 'APPLY', sourceDigest: plan.sourceDigest,
      prerequisiteRunId: 'apply-run-b1-audit', evidence: contextEvidence,
    })).rejects.toThrow('ARIA_CONVERSATION_CONTEXT_BACKFILL_RUN_NOT_REPLAYABLE');
  });

  it('B1_RECHECKS_AND_REPLAYS_A_COMPLETED_RUN_AFTER_LOCKING_THE_SOURCE', async () => {
    const plan = planConversationContextBackfill([legacyConversation], contextEvidence);
    let applyReads = 0;
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("mode = 'APPLY'")) {
        applyReads += 1;
        return applyReads === 1 ? { rowCount: 0, rows: [] } : {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', prerequisiteRunId: 'apply-run-b1-audit',
            sourceDigest: plan.sourceDigest, sourceSnapshot: plan.sourceSnapshot,
            scannedCount: 1, deterministicCount: 1, archivedCount: 0,
            manualReviewCount: 0, mutatedCount: 1,
          }],
        };
      }
      if (sql.includes('FROM aria_conversations')) return { rowCount: 1, rows: [legacyConversation] };
      if (sql.includes("mode = 'DRY_RUN'")) return {
        rowCount: 1,
        rows: [{ status: 'COMPLETED', sourceDigest: plan.sourceDigest, sourceSnapshot: plan.sourceSnapshot }],
      };
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });

    await expect(backfillConversationContexts({ query } as never, {
      runId: 'apply-run-b1', mode: 'APPLY', sourceDigest: plan.sourceDigest,
      prerequisiteRunId: 'apply-run-b1-audit', evidence: contextEvidence,
    })).resolves.toMatchObject({ scanned: 1, deterministic: 1, mutated: 1 });
    expect(applyReads).toBe(2);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO aria_data_migration_runs')))
      .toBe(false);
  });

  it.each([
    ['ABSENT_REPLAY', false],
    ['COMPLETED_REPLAY', true],
  ] as const)(
    'B1_INSERT_CONFLICT_HANDLES_%s_EXPLICITLY',
    async (_caseName, completedReplay) => {
      const plan = planConversationContextBackfill([legacyConversation], contextEvidence);
      let applyReads = 0;
      const query = jest.fn(async (sql: string) => {
        if (sql.includes("mode = 'APPLY'")) {
          applyReads += 1;
          if (applyReads < 3 || !completedReplay) return { rowCount: 0, rows: [] };
          return {
            rowCount: 1,
            rows: [{
              status: 'COMPLETED', prerequisiteRunId: 'apply-run-b1-audit',
              sourceDigest: plan.sourceDigest, sourceSnapshot: plan.sourceSnapshot,
              scannedCount: 1, deterministicCount: 1, archivedCount: 0,
              manualReviewCount: 0, mutatedCount: 1,
            }],
          };
        }
        if (sql.includes('FROM aria_conversations')) return { rowCount: 1, rows: [legacyConversation] };
        if (sql.includes("mode = 'DRY_RUN'")) return {
          rowCount: 1,
          rows: [{ status: 'COMPLETED', sourceDigest: plan.sourceDigest, sourceSnapshot: plan.sourceSnapshot }],
        };
        if (sql.includes('INSERT INTO aria_data_migration_runs')) return { rowCount: 0, rows: [] };
        throw new Error(`UNEXPECTED_QUERY:${sql}`);
      });
      const operation = backfillConversationContexts({ query } as never, {
        runId: 'apply-run-b1', mode: 'APPLY', sourceDigest: plan.sourceDigest,
        prerequisiteRunId: 'apply-run-b1-audit', evidence: contextEvidence,
      });

      if (completedReplay) {
        await expect(operation).resolves.toMatchObject({ mutated: 1 });
      } else {
        await expect(operation).rejects.toThrow(
          'ARIA_CONVERSATION_CONTEXT_BACKFILL_RUN_NOT_REPLAYABLE',
        );
      }
    },
  );
});
