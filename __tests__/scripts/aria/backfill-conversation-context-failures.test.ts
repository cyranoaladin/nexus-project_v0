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
});
