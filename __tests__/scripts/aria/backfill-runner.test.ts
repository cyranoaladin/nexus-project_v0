import {
  parseAriaBackfillCommand,
  runAriaBackfillCommand,
  verifyAriaBackfillRun,
} from '@/scripts/aria/run-backfills';

const digest = 'a'.repeat(64);
const databaseUrl = 'postgresql://127.0.0.1:55432/nexus_disposable_aria_deadbeef_test?schema=public';

describe('ARIA canonical backfill runner', () => {
  it.each([
    [[], 'ARIA_BACKFILL_INPUT_REQUIRED'],
    [['unknown', '--audit', '--source-digest', digest], 'ARIA_BACKFILL_INPUT_REQUIRED'],
    [['entitlements', '--audit', '--apply', '--source-digest', digest], 'ARIA_BACKFILL_INPUT_REQUIRED'],
    [['entitlements', '--source-digest', digest], 'ARIA_BACKFILL_INPUT_REQUIRED'],
    [['entitlements', '--audit', '--source-digest', 'bad'], 'ARIA_BACKFILL_INPUT_REQUIRED'],
    [['conversation-context', '--audit', '--source-digest', digest], 'ARIA_BACKFILL_INPUT_REQUIRED'],
    [['entitlements', '--audit', '--source-digest', digest], 'ARIA_BACKFILL_NOW_REQUIRED'],
  ])('fails closed on invalid command %#', (argv, code) => {
    expect(() => parseAriaBackfillCommand(argv, {
      DATABASE_URL: databaseUrl,
      NEXUS_DISPOSABLE_POSTGRES: '1',
    })).toThrow(code);
  });

  it('parses audit, apply and verify as exclusive explicit modes', () => {
    expect(parseAriaBackfillCommand([
      'conversation-context', '--audit', '--source-digest', digest, '--evidence', '/tmp/evidence.json',
    ], { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' })).toMatchObject({
      target: 'conversation-context', mode: 'DRY_RUN', sourceDigest: digest,
      evidencePath: '/tmp/evidence.json',
    });
    expect(parseAriaBackfillCommand([
      'feedback-profile', '--apply', '--source-digest', digest,
    ], {
      DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1',
      ARIA_BACKFILL_APPLY_AUTHORIZATION: 'M1_EXPLICIT_APPLY',
    })).toMatchObject({ target: 'feedback-profile', mode: 'APPLY' });
    expect(parseAriaBackfillCommand([
      'conversation-turns', '--verify', '--source-digest', digest,
    ], { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' })).toMatchObject({
      target: 'conversation-turns', mode: 'VERIFY',
    });
  });

  it('requires a separate explicit mutation authorization', () => {
    expect(() => parseAriaBackfillCommand([
      'conversation-turns', '--apply', '--source-digest', digest,
    ], { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' }))
      .toThrow('ARIA_BACKFILL_APPLY_NOT_AUTHORIZED');
  });

  it('verifies exact completed run and target-specific postconditions', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{
        status: 'COMPLETED', sourceDigest: digest, scannedCount: 4,
        deterministicCount: 2, archivedCount: 1, manualReviewCount: 1, mutatedCount: 2,
      }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ auditCount: 4, deterministic: 2, archived: 1, manual: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ targetCount: 2 }] });
    await expect(verifyAriaBackfillRun({ query } as never, {
      target: 'conversation-context', runId: `conversation-context-${digest.slice(0, 24)}`,
      sourceDigest: digest,
    })).resolves.toEqual({
      scanned: 4, deterministic: 2, archived: 1, manualReview: 1, mutated: 2,
      auditRows: 4, targetRows: 2,
    });
  });

  it.each([
    [{ rowCount: 0, rows: [] }, 'ARIA_BACKFILL_VERIFY_RUN_NOT_COMPLETED'],
    [{ rowCount: 1, rows: [{
      status: 'RUNNING', sourceDigest: digest, scannedCount: 1,
      deterministicCount: 1, archivedCount: 0, manualReviewCount: 0, mutatedCount: 1,
    }] }, 'ARIA_BACKFILL_VERIFY_RUN_NOT_COMPLETED'],
  ])('rejects missing or incomplete apply runs %#', async (runResult, code) => {
    const query = jest.fn().mockResolvedValueOnce(runResult);
    await expect(verifyAriaBackfillRun({ query } as never, {
      target: 'conversation-context', runId: 'run', sourceDigest: digest,
    })).rejects.toThrow(code);
  });

  it('rejects a count mismatch instead of greenwashing verification', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{
        status: 'COMPLETED', sourceDigest: digest, scannedCount: 4,
        deterministicCount: 2, archivedCount: 1, manualReviewCount: 1, mutatedCount: 2,
      }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ auditCount: 3, deterministic: 2, archived: 1, manual: 0 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ targetCount: 2 }] });
    await expect(verifyAriaBackfillRun({ query } as never, {
      target: 'conversation-context', runId: 'run', sourceDigest: digest,
    })).rejects.toThrow('ARIA_BACKFILL_VERIFY_COUNT_MISMATCH');
  });

  it('dispatches audit through a short transaction and always rolls it back', async () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => { queries.push(sql); return { rowCount: 0, rows: [] }; }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const output: string[] = [];
    const backfillTurns = jest.fn().mockResolvedValue({
      scannedMessages: 0, turnsCreated: 0, archivedGroups: 0,
    });
    await runAriaBackfillCommand({
      argv: ['conversation-turns', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: backfillTurns as never,
      write: (value) => output.push(value),
    });
    expect(backfillTurns).toHaveBeenCalledWith(client, expect.objectContaining({ mode: 'DRY_RUN' }));
    expect(queries).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(JSON.parse(output.join(''))).toMatchObject({ mode: 'DRY_RUN', target: 'conversation-turns' });
  });

  it('rolls back and closes resources when a worker fails', async () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => { queries.push(sql); return { rowCount: 0, rows: [] }; }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    await expect(runAriaBackfillCommand({
      argv: ['conversation-turns', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockRejectedValue(new Error('fixture')) as never,
      write: jest.fn(),
    })).rejects.toThrow('fixture');
    expect(queries).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
