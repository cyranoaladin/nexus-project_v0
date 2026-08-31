import {
  parseAriaBackfillCommand,
  rollbackLegacyBackfill,
  runAriaBackfillCommand,
  verifyAriaBackfillRun,
} from '@/scripts/aria/run-backfills';
import { createAriaBackfillSnapshot } from '@/scripts/aria/backfill-snapshot';
import { stableLegacyFingerprint } from '@/scripts/aria/audit-legacy-data';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const digest = 'a'.repeat(64);
const databaseUrl = 'postgresql://127.0.0.1:55432/nexus_disposable_aria_deadbeef_test?schema=public';

function contextRollbackClient(
  failure: 'DEPENDENCY' | 'RUNTIME_DEPENDENCY' | 'LOCK' | 'FINGERPRINT' | 'TERMINAL',
) {
  const runId = 'context-run';
  const beforeImage = {
    contextState: 'ARCHIVED_NON_RESUMABLE', courseKey: null,
    resourceId: null, skillId: null, subject: 'MATHEMATIQUES',
  };
  const current = {
    id: 'conversation-1', studentId: 'student-1', subject: 'MATHEMATIQUES',
    skillId: null, resourceId: null, courseKey: 'eds-maths-terminale',
    contextState: 'ACTIVE', contextMigrationRunId: runId,
  };
  const sourceFingerprint = stableLegacyFingerprint({
    id: current.id, studentId: current.studentId,
    contextState: beforeImage.contextState, courseKey: beforeImage.courseKey,
    resourceId: current.resourceId, skillId: current.skillId, subject: current.subject,
  });
  return {
    runId,
    client: {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM aria_data_migration_runs WHERE id')) return {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', migrationName: 'aria-conversation-context-v1', mode: 'APPLY',
            sourceSnapshot: {}, scannedCount: 1, deterministicCount: 1,
            archivedCount: 0, manualReviewCount: 0, mutatedCount: 1,
          }],
        };
        if (sql.includes('SELECT t.id, a.classification')) return { rowCount: 0, rows: [] };
        if (sql.includes('FROM aria_data_migration_row_audits')
          && sql.includes("sourceType\" = 'ARIA_CONVERSATION'")) return {
          rowCount: 1,
          rows: [{
            sourceId: current.id, sourceFingerprint,
            targetKey: { courseKey: current.courseKey }, beforeImage,
          }],
        };
        if (sql.includes('SELECT id FROM aria_conversations')) {
          return failure === 'LOCK'
            ? { rowCount: 0, rows: [] }
            : { rowCount: 1, rows: [{ id: current.id }] };
        }
        if (sql.includes("\"useCase\" = 'CONVERSATION'")) {
          return failure === 'RUNTIME_DEPENDENCY'
            ? { rowCount: 1, rows: [{ id: 'runtime-turn' }] }
            : { rowCount: 0, rows: [] };
        }
        if (sql.includes('SELECT DISTINCT dependent_run.id')) {
          return failure === 'DEPENDENCY'
            ? { rowCount: 1, rows: [{ id: 'dependent-run' }] }
            : { rowCount: 0, rows: [] };
        }
        if (sql.includes('SELECT id, "studentId"')) return {
          rowCount: 1,
          rows: [{
            ...current,
            courseKey: failure === 'FINGERPRINT' ? 'eds-nsi-terminale' : current.courseKey,
          }],
        };
        if (sql.includes('UPDATE aria_conversations')) return { rowCount: 1, rows: [] };
        if (sql.includes("SET status = 'ROLLED_BACK'")) {
          return { rowCount: failure === 'TERMINAL' ? 0 : 1, rows: [] };
        }
        throw new Error(`UNEXPECTED_QUERY:${sql}`);
      }),
    },
  };
}

describe('ARIA canonical backfill runner', () => {
  it('ROLLBACK_REJECTS_UNKNOWN_OR_NON_COMPLETED_RUN', async () => {
    await expect(rollbackLegacyBackfill({
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    } as never, 'missing-run')).rejects.toThrow('ARIA_BACKFILL_ROLLBACK_RUN_NOT_COMPLETED');
  });

  it('ROLLBACK_REJECTS_LEGACY_TURN_PLANNER_VERSION', async () => {
    const legacySeal = createAriaBackfillSnapshot({
      target: 'conversation-turns', plannerVersion: 1,
      inputs: { groupingContract: { version: 1 } }, units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    await expect(rollbackLegacyBackfill({
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{
          status: 'COMPLETED', migrationName: 'aria-conversation-turns-v1', mode: 'APPLY',
          sourceSnapshot: legacySeal.sourceSnapshot, scannedCount: 0, deterministicCount: 0,
          archivedCount: 0, manualReviewCount: 0, mutatedCount: 0,
        }],
      }),
    } as never, 'legacy-turn-run')).rejects.toThrow('ARIA_BACKFILL_ROLLBACK_RUN_NOT_COMPLETED');
  });

  it.each(['DEPENDENCY', 'RUNTIME_DEPENDENCY', 'LOCK', 'FINGERPRINT', 'TERMINAL'] as const)(
    'ROLLBACK_REJECTS_CONTEXT_%s_CONFLICT',
    async (failure) => {
      const fixture = contextRollbackClient(failure);
      await expect(rollbackLegacyBackfill(fixture.client as never, fixture.runId))
        .rejects.toThrow(failure === 'DEPENDENCY' || failure === 'RUNTIME_DEPENDENCY'
          ? 'ARIA_BACKFILL_ROLLBACK_DEPENDENCY_CONFLICT'
          : 'ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
    },
  );

  it('ROLLBACK_REJECTS_LOST_CONTEXT_RESTORATION_FENCE', async () => {
    const runId = 'context-run';
    const beforeImage = {
      contextState: 'ARCHIVED_NON_RESUMABLE',
      courseKey: null,
      resourceId: null,
      skillId: null,
      subject: 'MATHEMATIQUES',
    };
    const current = {
      id: 'conversation-1',
      studentId: 'student-1',
      subject: 'MATHEMATIQUES',
      skillId: null,
      resourceId: null,
      courseKey: 'eds-maths-terminale',
      contextState: 'ACTIVE',
      contextMigrationRunId: runId,
    };
    const sourceFingerprint = stableLegacyFingerprint({
      id: current.id,
      studentId: current.studentId,
      contextState: beforeImage.contextState,
      courseKey: beforeImage.courseKey,
      resourceId: current.resourceId,
      skillId: current.skillId,
      subject: current.subject,
    });
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM aria_data_migration_runs WHERE id')) return {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', migrationName: 'aria-conversation-context-v1', mode: 'APPLY',
            sourceSnapshot: {}, scannedCount: 1, deterministicCount: 1,
            archivedCount: 0, manualReviewCount: 0, mutatedCount: 1,
          }],
        };
        if (sql.includes('SELECT t.id, a.classification')) return { rowCount: 0, rows: [] };
        if (sql.includes('FROM aria_data_migration_row_audits')
          && sql.includes("sourceType\" = 'ARIA_CONVERSATION'")) return {
          rowCount: 1,
          rows: [{
            sourceId: current.id,
            sourceFingerprint,
            targetKey: { courseKey: current.courseKey },
            beforeImage,
          }],
        };
        if (sql.includes('SELECT id FROM aria_conversations')) {
          return { rowCount: 1, rows: [{ id: current.id }] };
        }
        if (sql.includes("\"useCase\" = 'CONVERSATION'")) return { rowCount: 0, rows: [] };
        if (sql.includes('SELECT DISTINCT dependent_run.id')) return { rowCount: 0, rows: [] };
        if (sql.includes('SELECT id, "studentId"')) return { rowCount: 1, rows: [current] };
        if (sql.includes('UPDATE aria_conversations')) return { rowCount: 0, rows: [] };
        if (sql.includes("SET status = 'ROLLED_BACK'")) return { rowCount: 1, rows: [] };
        throw new Error(`UNEXPECTED_QUERY:${sql}`);
      }),
    };

    await expect(rollbackLegacyBackfill(client as never, runId))
      .rejects.toThrow('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
  });

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

  it('BACKFILL_APPLY_REQUIRES_MATCHING_PERSISTED_AUDIT_DIGEST_AND_COUNTS', async () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const backfillTurns = jest.fn().mockRejectedValue(
      new Error('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH'),
    );

    await expect(runAriaBackfillCommand({
      argv: ['conversation-turns', '--apply', '--source-digest', digest],
      env: {
        DATABASE_URL: databaseUrl,
        NEXUS_DISPOSABLE_POSTGRES: '1',
        ARIA_BACKFILL_APPLY_AUTHORIZATION: 'M1_EXPLICIT_APPLY',
      },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: backfillTurns as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH');

    expect(backfillTurns).toHaveBeenCalledTimes(1);
    expect(queries).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('replays a completed APPLY run before recalculating a now-consumed source set', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM aria_data_migration_runs')) return {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: digest, scannedCount: 2,
            deterministicCount: 1, archivedCount: 0, manualReviewCount: 0,
            mutatedCount: 1,
          }],
        };
        return { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const backfillTurns = jest.fn().mockResolvedValue({
      scannedMessages: 2, turnsCreated: 1, deterministicGroups: 1,
      archivedGroups: 0, manualReviewGroups: 0,
    });
    const output: string[] = [];

    await runAriaBackfillCommand({
      argv: ['conversation-turns', '--apply', '--source-digest', digest],
      env: {
        DATABASE_URL: databaseUrl,
        NEXUS_DISPOSABLE_POSTGRES: '1',
        ARIA_BACKFILL_APPLY_AUTHORIZATION: 'M1_EXPLICIT_APPLY',
      },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: backfillTurns as never,
      write: (value) => output.push(value),
    });

    expect(backfillTurns).toHaveBeenCalledTimes(1);
    expect(JSON.parse(output.join(''))).toMatchObject({
      mode: 'APPLY', target: 'conversation-turns',
      report: {
        scanned: 2, deterministic: 1, archived: 0, manualReview: 0, mutated: 1,
      },
    });
  });

  it('COMPLETED_APPLY_REPLAY_REQUIRES_MATCHING_PERSISTED_AUDIT', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("mode = 'APPLY'")) return {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: digest, scannedCount: 2,
            deterministicCount: 1, archivedCount: 0, manualReviewCount: 0,
            mutatedCount: 1,
          }],
        };
        if (sql.includes("mode = 'DRY_RUN'")) return { rowCount: 0, rows: [] };
        return { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };

    await expect(runAriaBackfillCommand({
      argv: ['conversation-turns', '--apply', '--source-digest', digest],
      env: {
        DATABASE_URL: databaseUrl,
        NEXUS_DISPOSABLE_POSTGRES: '1',
        ARIA_BACKFILL_APPLY_AUTHORIZATION: 'M1_EXPLICIT_APPLY',
      },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockRejectedValue(
        new Error('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH'),
      ) as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH');
  });

  it('COMPLETED_APPLY_REPLAY_REJECTS_AUDIT_COUNT_DIVERGENCE', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("mode = 'APPLY'")) return {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: digest, scannedCount: 2,
            deterministicCount: 1, archivedCount: 0, manualReviewCount: 0,
            mutatedCount: 1,
          }],
        };
        if (sql.includes("mode = 'DRY_RUN'")) return {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: digest, scannedCount: 3,
            deterministicCount: 1, archivedCount: 1, manualReviewCount: 0,
          }],
        };
        return { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };

    await expect(runAriaBackfillCommand({
      argv: ['conversation-turns', '--apply', '--source-digest', digest],
      env: {
        DATABASE_URL: databaseUrl,
        NEXUS_DISPOSABLE_POSTGRES: '1',
        ARIA_BACKFILL_APPLY_AUTHORIZATION: 'M1_EXPLICIT_APPLY',
      },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockRejectedValue(
        new Error('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH'),
      ) as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH');
  });

  it('re-reads an identical persisted audit when a concurrent seal wins the insert', async () => {
    const turnSeal = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 } },
      units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    let auditReads = 0;
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM aria_data_migration_runs')) {
          auditReads += 1;
          return auditReads === 1
            ? { rowCount: 0, rows: [] }
            : {
              rowCount: 1,
              rows: [{
                status: 'COMPLETED', sourceDigest: turnSeal.sourceDigest,
                sourceSnapshot: turnSeal.sourceSnapshot, scannedCount: 0,
                deterministicCount: 0, archivedCount: 0, manualReviewCount: 0,
              }],
            };
        }
        if (sql.includes('INSERT INTO aria_data_migration_runs')) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };

    await runAriaBackfillCommand({
      argv: ['conversation-turns', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockResolvedValue({
        scannedMessages: 0, turnsCreated: 0, deterministicGroups: 0,
        archivedGroups: 0, manualReviewGroups: 0,
        sourceDigest: turnSeal.sourceDigest,
        sourceSnapshot: turnSeal.sourceSnapshot,
      }) as never,
      write: jest.fn(),
    });

    expect(auditReads).toBe(2);
  });

  it('RUNNER_REJECTS_WORKER_COUNTS_DIVERGENT_FROM_SEALED_SNAPSHOT', async () => {
    const turnSeal = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 } },
      units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    const client = {
      query: jest.fn(async (sql: string) => sql.includes('INSERT INTO aria_data_migration_runs')
        ? { rowCount: 1, rows: [{ id: 'audit' }] }
        : { rowCount: 0, rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };

    await expect(runAriaBackfillCommand({
      argv: ['conversation-turns', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockResolvedValue({
        scannedMessages: 2,
        turnsCreated: 0,
        deterministicGroups: 1,
        archivedGroups: 0,
        manualReviewGroups: 0,
        sourceDigest: turnSeal.sourceDigest,
        sourceSnapshot: turnSeal.sourceSnapshot,
      }) as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_BACKFILL_AUDIT_COUNT_MISMATCH');
  });

  it('RUNNER_REJECTS_EXISTING_AUDIT_COUNTS_DIVERGENT_FROM_ITS_SNAPSHOT', async () => {
    const turnSeal = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 } },
      units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    const client = {
      query: jest.fn(async (sql: string) => sql.includes('FROM aria_data_migration_runs')
        ? {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED',
            sourceDigest: turnSeal.sourceDigest,
            sourceSnapshot: turnSeal.sourceSnapshot,
            scannedCount: 2,
            deterministicCount: 1,
            archivedCount: 0,
            manualReviewCount: 0,
          }],
        }
        : { rowCount: 0, rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };

    await expect(runAriaBackfillCommand({
      argv: ['conversation-turns', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockResolvedValue({
        scannedMessages: 2,
        turnsCreated: 0,
        deterministicGroups: 1,
        archivedGroups: 0,
        manualReviewGroups: 0,
        sourceDigest: turnSeal.sourceDigest,
        sourceSnapshot: turnSeal.sourceSnapshot,
      }) as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_BACKFILL_AUDIT_COUNT_MISMATCH');
  });

  it.each([
    ['INVALID_TURN_CARDINALITY', {
      report: {
        scannedMessages: 1,
        turnsCreated: 0,
        deterministicGroups: 1,
        archivedGroups: 0,
        manualReviewGroups: 0,
      },
      expected: 'ARIA_BACKFILL_AUDIT_REPORT_INVALID',
    }],
    ['MISSING_WORKER_SOURCE_DIGEST', {
      report: {
        scannedMessages: 0,
        turnsCreated: 0,
        deterministicGroups: 0,
        archivedGroups: 0,
        manualReviewGroups: 0,
      },
      expected: 'ARIA_BACKFILL_AUDIT_SEAL_INVALID',
    }],
    ['WORKER_SNAPSHOT_DIGEST_MISMATCH', {
      report: {
        scannedMessages: 0,
        turnsCreated: 0,
        deterministicGroups: 0,
        archivedGroups: 0,
        manualReviewGroups: 0,
        sourceDigest: 'b'.repeat(64),
      },
      expected: 'ARIA_BACKFILL_AUDIT_SEAL_INVALID',
    }],
  ])('RUNNER_REJECTS_%s', async (_name, fixture) => {
    const seal = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 } },
      units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    const client = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const workerReport = {
      ...fixture.report,
      ...(!('sourceDigest' in fixture.report) && _name !== 'MISSING_WORKER_SOURCE_DIGEST'
        ? { sourceDigest: seal.sourceDigest }
        : {}),
      sourceSnapshot: seal.sourceSnapshot,
    };

    await expect(runAriaBackfillCommand({
      argv: ['conversation-turns', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockResolvedValue(workerReport) as never,
      write: jest.fn(),
    })).rejects.toThrow(fixture.expected);
  });

  it('RUNNER_REUSES_IDENTICAL_EXISTING_AUDIT', async () => {
    const seal = createAriaBackfillSnapshot({
      target: 'conversation-turns', plannerVersion: 2,
      inputs: { groupingContract: { version: 2 } }, units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    const client = {
      query: jest.fn(async (sql: string) => sql.includes('FROM aria_data_migration_runs')
        ? {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: seal.sourceDigest,
            sourceSnapshot: seal.sourceSnapshot, scannedCount: 0,
            deterministicCount: 0, archivedCount: 0, manualReviewCount: 0,
          }],
        }
        : { rowCount: 0, rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };

    await expect(runAriaBackfillCommand({
      argv: ['conversation-turns', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockResolvedValue({
        scannedMessages: 0, turnsCreated: 0, deterministicGroups: 0,
        archivedGroups: 0, manualReviewGroups: 0,
        sourceDigest: seal.sourceDigest, sourceSnapshot: seal.sourceSnapshot,
      }) as never,
      write: jest.fn(),
    })).resolves.toBeUndefined();

    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO aria_data_migration_runs'),
      expect.anything(),
    );
  });

  it.each([
    ['CONFLICTING_EXISTING_AUDIT', 1, 'RUNNING'],
    ['NON_UNIQUE_EXISTING_AUDIT_RESULT', 2, 'COMPLETED'],
  ] as const)('RUNNER_REJECTS_%s', async (_name, rowCount, status) => {
    const seal = createAriaBackfillSnapshot({
      target: 'conversation-turns', plannerVersion: 2,
      inputs: { groupingContract: { version: 2 } }, units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    const audit = {
      status, sourceDigest: seal.sourceDigest, sourceSnapshot: seal.sourceSnapshot,
      scannedCount: 0, deterministicCount: 0, archivedCount: 0, manualReviewCount: 0,
    };
    const client = {
      query: jest.fn(async (sql: string) => sql.includes('FROM aria_data_migration_runs')
        ? { rowCount, rows: rowCount === 2 ? [audit, audit] : [audit] }
        : { rowCount: 0, rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };

    await expect(runAriaBackfillCommand({
      argv: ['conversation-turns', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockResolvedValue({
        scannedMessages: 0, turnsCreated: 0, deterministicGroups: 0,
        archivedGroups: 0, manualReviewGroups: 0,
        sourceDigest: seal.sourceDigest, sourceSnapshot: seal.sourceSnapshot,
      }) as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_BACKFILL_AUDIT_CONFLICT');
  });

  it('RUNNER_REJECTS_INVALID_CONCURRENT_AUDIT_SEAL', async () => {
    const seal = createAriaBackfillSnapshot({
      target: 'conversation-turns', plannerVersion: 2,
      inputs: { groupingContract: { version: 2 } }, units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    const client = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };

    await expect(runAriaBackfillCommand({
      argv: ['conversation-turns', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockResolvedValue({
        scannedMessages: 0, turnsCreated: 0, deterministicGroups: 0,
        archivedGroups: 0, manualReviewGroups: 0,
        sourceDigest: seal.sourceDigest, sourceSnapshot: seal.sourceSnapshot,
      }) as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_BACKFILL_AUDIT_CONFLICT');
  });

  it('RUNNER_DEFAULT_DEPENDENCIES_FAIL_BEFORE_EXTERNAL_IO_ON_INVALID_INPUT', async () => {
    await expect(runAriaBackfillCommand({ argv: [], env: {} }))
      .rejects.toThrow('ARIA_BACKFILL_INPUT_REQUIRED');
  });

  it('verifies exact completed run and target-specific postconditions', async () => {
    const seal = createAriaBackfillSnapshot({
      target: 'conversation-context', plannerVersion: 1,
      inputs: { contextContract: { version: 1 } }, units: [],
      report: { scanned: 4, deterministic: 2, archived: 1, manualReview: 1 },
    });
    const query = jest.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{
        status: 'COMPLETED', sourceDigest: seal.sourceDigest,
        sourceSnapshot: seal.sourceSnapshot, scannedCount: 4,
        deterministicCount: 2, archivedCount: 1, manualReviewCount: 1, mutatedCount: 2,
      }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ auditCount: 4, deterministic: 2, archived: 1, manual: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ targetCount: 2 }] });
    await expect(verifyAriaBackfillRun({ query } as never, {
      target: 'conversation-context', runId: `conversation-context-${seal.sourceDigest.slice(0, 24)}`,
      sourceDigest: seal.sourceDigest,
    })).resolves.toEqual({
      scanned: 4, deterministic: 2, archived: 1, manualReview: 1, mutated: 2,
      auditRows: 4, targetRows: 2,
    });
    expect(query.mock.calls[0][0]).toContain('"migrationName" = $2');
    expect(query.mock.calls[0][0]).toContain("mode = 'APPLY'");
  });

  it.each([
    ['invalid snapshot', {}, digest],
    ['snapshot digest mismatch', createAriaBackfillSnapshot({
      target: 'feedback-profile',
      plannerVersion: 1,
      inputs: { feedbackProfileContract: { version: 1 } },
      units: [{ action: 'CREATE' }],
      report: { scanned: 1, deterministic: 1, archived: 0, manualReview: 0 },
    }).sourceSnapshot, digest],
  ] as const)(
    'RUNNER_VERIFY_REJECTS_INVALID_OR_DIGEST_DIVERGENT_SOURCE_SNAPSHOT_%s',
    async (_label, sourceSnapshot, sourceDigest) => {
      const query = jest.fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{
          status: 'COMPLETED', sourceDigest, sourceSnapshot, scannedCount: 1,
          deterministicCount: 1, archivedCount: 0, manualReviewCount: 0, mutatedCount: 1,
        }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{
          auditCount: 1, deterministic: 1, archived: 0, manual: 0, invalidSources: 0,
        }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ targetCount: 1 }] });

      await expect(verifyAriaBackfillRun({ query } as never, {
        target: 'feedback-profile', runId: 'feedback-run', sourceDigest,
      })).rejects.toThrow('ARIA_BACKFILL_VERIFY_SEAL_INVALID');
    },
  );

  it('RUNNER_VERIFY_REJECTS_SEALED_SNAPSHOT_COUNT_DIVERGENCE', async () => {
    const seal = createAriaBackfillSnapshot({
      target: 'feedback-profile', plannerVersion: 1,
      inputs: { feedbackProfileContract: { version: 1 } }, units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    const query = jest.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{
      status: 'COMPLETED', sourceDigest: seal.sourceDigest,
      sourceSnapshot: seal.sourceSnapshot, scannedCount: 1,
      deterministicCount: 1, archivedCount: 0, manualReviewCount: 0, mutatedCount: 1,
    }] });

    await expect(verifyAriaBackfillRun({ query } as never, {
      target: 'feedback-profile', runId: 'feedback-run', sourceDigest: seal.sourceDigest,
    })).rejects.toThrow('ARIA_BACKFILL_VERIFY_COUNT_MISMATCH');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('B2_VERIFY_REJECTS_WRONG_SOURCE_TYPE_OR_MESSAGE_CARDINALITY', async () => {
    const seal = createAriaBackfillSnapshot({
      target: 'conversation-turns', plannerVersion: 2,
      inputs: { groupingContract: { version: 2 } }, units: [],
      report: { scanned: 2, deterministic: 1, archived: 0, manualReview: 0 },
    });
    const query = jest.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{
        status: 'COMPLETED', sourceDigest: seal.sourceDigest,
        sourceSnapshot: seal.sourceSnapshot, scannedCount: 2,
        deterministicCount: 1, archivedCount: 0, manualReviewCount: 0, mutatedCount: 1,
      }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{
        auditCount: 1, deterministic: 1, archived: 0, manual: 0,
        invalidSources: 1, messageCount: 1, distinctMessageCount: 1,
      }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ targetCount: 1 }] });

    await expect(verifyAriaBackfillRun({ query } as never, {
      target: 'conversation-turns', runId: 'turn-run', sourceDigest: seal.sourceDigest,
    })).rejects.toThrow('ARIA_BACKFILL_VERIFY_COUNT_MISMATCH');
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
    const seal = createAriaBackfillSnapshot({
      target: 'conversation-context', plannerVersion: 1,
      inputs: { contextContract: { version: 1 } }, units: [],
      report: { scanned: 4, deterministic: 2, archived: 1, manualReview: 1 },
    });
    const query = jest.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{
        status: 'COMPLETED', sourceDigest: seal.sourceDigest,
        sourceSnapshot: seal.sourceSnapshot, scannedCount: 4,
        deterministicCount: 2, archivedCount: 1, manualReviewCount: 1, mutatedCount: 2,
      }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ auditCount: 3, deterministic: 2, archived: 1, manual: 0 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ targetCount: 2 }] });
    await expect(verifyAriaBackfillRun({ query } as never, {
      target: 'conversation-context', runId: 'run', sourceDigest: seal.sourceDigest,
    })).rejects.toThrow('ARIA_BACKFILL_VERIFY_COUNT_MISMATCH');
  });

  it('dispatches audit read-only, rolls it back, then seals its exact counts', async () => {
    const turnSeal = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 } },
      units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('INSERT INTO aria_data_migration_runs')) {
          return { rowCount: 1, rows: [{ id: `conversation-turns-${digest.slice(0, 24)}-audit` }] };
        }
        return { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const output: string[] = [];
    const backfillTurns = jest.fn().mockResolvedValue({
      scannedMessages: 0, turnsCreated: 0, deterministicGroups: 0,
      archivedGroups: 0, manualReviewGroups: 0,
      sourceDigest: turnSeal.sourceDigest,
      sourceSnapshot: turnSeal.sourceSnapshot,
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
    expect(queries.slice(0, 2)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(queries).toEqual(expect.arrayContaining([
      expect.stringContaining("mode = 'DRY_RUN'"),
      expect.stringContaining('INSERT INTO aria_data_migration_runs'),
    ]));
    expect(queries.at(-1)).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(JSON.parse(output.join(''))).toEqual({
      mode: 'DRY_RUN',
      report: {
        scanned: 0,
        deterministic: 0,
        archived: 0,
        manualReview: 0,
        mutated: 0,
      },
      sourceDigest: turnSeal.sourceDigest,
      target: 'conversation-turns',
    });
  });

  it('B2_RUNNER_USES_EXPLICIT_DETERMINISTIC_AND_MANUAL_COUNTS', async () => {
    const turnSeal = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 } },
      units: [],
      report: { scanned: 9, deterministic: 2, archived: 3, manualReview: 2 },
    });
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO aria_data_migration_runs')) {
          return { rowCount: 1, rows: [{ id: `conversation-turns-${digest.slice(0, 24)}-audit` }] };
        }
        return { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const output: string[] = [];

    await runAriaBackfillCommand({
      argv: ['conversation-turns', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: jest.fn().mockResolvedValue({
        scannedMessages: 9,
        turnsCreated: 0,
        deterministicGroups: 2,
        archivedGroups: 3,
        manualReviewGroups: 2,
        sourceDigest: turnSeal.sourceDigest,
        sourceSnapshot: turnSeal.sourceSnapshot,
      }) as never,
      write: (value) => output.push(value),
    });

    expect(JSON.parse(output.join('')).report).toEqual({
      scanned: 9,
      deterministic: 2,
      archived: 3,
      manualReview: 2,
      mutated: 0,
    });
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

  it('verifies through a read-only transaction and commits only exact counts', async () => {
    const seal = createAriaBackfillSnapshot({
      target: 'feedback-profile', plannerVersion: 1,
      inputs: { feedbackProfileContract: { version: 1 } }, units: [],
      report: { scanned: 1, deterministic: 1, archived: 0, manualReview: 0 },
    });
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('FROM aria_data_migration_runs')) return {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: seal.sourceDigest,
            sourceSnapshot: seal.sourceSnapshot, scannedCount: 1,
            deterministicCount: 1, archivedCount: 0, manualReviewCount: 0, mutatedCount: 1,
          }],
        };
        if (sql.includes('COUNT(*)::integer AS "auditCount"')) return {
          rowCount: 1,
          rows: [{ auditCount: 1, deterministic: 1, archived: 0, manual: 0 }],
        };
        if (sql.includes('targetCount')) return { rowCount: 1, rows: [{ targetCount: 1 }] };
        return { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const output: string[] = [];

    await runAriaBackfillCommand({
      argv: ['feedback-profile', '--verify', '--source-digest', seal.sourceDigest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      write: (value) => output.push(value),
    });

    expect(queries[0]).toBe('BEGIN TRANSACTION READ ONLY');
    expect(queries.at(-1)).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(JSON.parse(output.join(''))).toMatchObject({
      mode: 'VERIFY', target: 'feedback-profile', report: { targetRows: 1, auditRows: 1 },
    });
  });

  it('rolls back a read-only verification transaction when counts cannot be proved', async () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };

    await expect(runAriaBackfillCommand({
      argv: ['feedback-profile', '--verify', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_BACKFILL_VERIFY_RUN_NOT_COMPLETED');

    expect(queries).toEqual([
      'BEGIN TRANSACTION READ ONLY',
      expect.stringContaining('FROM aria_data_migration_runs'),
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('dispatches entitlement and feedback-profile audits and seals both count snapshots', async () => {
    const entitlementSeal = createAriaBackfillSnapshot({
      target: 'entitlements',
      plannerVersion: 1,
      inputs: { entitlementContract: { version: 1 } },
      units: [{ action: 'GRANT' }],
      report: { scanned: 1, deterministic: 1, archived: 0, manualReview: 0 },
    });
    const feedbackSeal = createAriaBackfillSnapshot({
      target: 'feedback-profile',
      plannerVersion: 1,
      inputs: { feedbackProfileContract: { version: 1 } },
      units: [{ action: 'CREATE' }, { action: 'MANUAL_NOOP' }],
      report: { scanned: 2, deterministic: 1, archived: 0, manualReview: 1 },
    });
    const client = {
      query: jest.fn(async (sql: string, values?: readonly unknown[]) => {
        void values;
        return sql.includes('INSERT INTO aria_data_migration_runs')
          ? { rowCount: 1, rows: [{ id: 'audit' }] }
          : { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const backfillEntitlements = jest.fn().mockResolvedValue({
      scanned: 1, deterministic: 1, archived: 0, manualReview: 0, mutated: 0,
      sourceDigest: entitlementSeal.sourceDigest,
      sourceSnapshot: entitlementSeal.sourceSnapshot,
    });
    const backfillFeedback = jest.fn().mockResolvedValue({
      feedback: { scanned: 1, deterministic: 1, manualReview: 0, mutated: 0 },
      profiles: { scanned: 1, deterministic: 0, manualReview: 1, mutated: 0 },
      sourceDigest: feedbackSeal.sourceDigest,
      sourceSnapshot: feedbackSeal.sourceSnapshot,
    });
    const output: string[] = [];

    await runAriaBackfillCommand({
      argv: [
        'entitlements', '--audit', '--source-digest', digest,
        '--now', '2026-08-30T12:00:00.000Z',
      ],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillAriaEntitlements: backfillEntitlements as never,
      write: (value) => output.push(value),
    });
    await runAriaBackfillCommand({
      argv: ['feedback-profile', '--audit', '--source-digest', digest],
      env: { DATABASE_URL: databaseUrl, NEXUS_DISPOSABLE_POSTGRES: '1' },
    }, {
      createPool: () => pool as never,
      backfillAriaFeedbackProfiles: backfillFeedback as never,
      write: (value) => output.push(value),
    });

    expect(backfillEntitlements).toHaveBeenCalledWith(pool, expect.objectContaining({
      mode: 'DRY_RUN', now: new Date('2026-08-30T12:00:00.000Z'),
    }));
    expect(backfillFeedback).toHaveBeenCalledWith(pool, expect.objectContaining({ mode: 'DRY_RUN' }));
    expect(pool.connect).toHaveBeenCalledTimes(2);
    expect(client.release).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO aria_data_migration_runs'), expect.any(Array));
    const sealValues = client.query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO aria_data_migration_runs'))
      .map(([, values]) => values);
    expect(sealValues).toEqual([
      expect.arrayContaining([
        JSON.stringify(entitlementSeal.sourceSnapshot), entitlementSeal.sourceDigest,
      ]),
      expect.arrayContaining([
        JSON.stringify(feedbackSeal.sourceSnapshot), feedbackSeal.sourceDigest,
      ]),
    ]);
    expect(pool.end).toHaveBeenCalledTimes(2);
    expect(output.map((value) => JSON.parse(value))).toEqual([
      {
        mode: 'DRY_RUN',
        report: {
          scanned: 1,
          deterministic: 1,
          archived: 0,
          manualReview: 0,
          mutated: 0,
        },
        sourceDigest: entitlementSeal.sourceDigest,
        target: 'entitlements',
      },
      {
        mode: 'DRY_RUN',
        report: {
          scanned: 2,
          deterministic: 1,
          archived: 0,
          manualReview: 1,
          mutated: 0,
        },
        sourceDigest: feedbackSeal.sourceDigest,
        target: 'feedback-profile',
      },
    ]);
  });

  it('delegates feedback-profile APPLY replay and exact snapshot validation to its locked worker', async () => {
    const seal = createAriaBackfillSnapshot({
      target: 'feedback-profile', plannerVersion: 1,
      inputs: { feedbackProfileContract: { version: 1 } }, units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    const client = {
      query: jest.fn(async (sql: string) => sql.includes("mode = 'DRY_RUN'")
        ? {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: seal.sourceDigest,
            sourceSnapshot: seal.sourceSnapshot,
            scannedCount: 0, deterministicCount: 0, archivedCount: 0,
            manualReviewCount: 0,
          }],
        }
        : { rowCount: 0, rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const backfillFeedback = jest.fn().mockResolvedValue({
      feedback: { scanned: 0, deterministic: 0, manualReview: 0, mutated: 0 },
      profiles: { scanned: 0, deterministic: 0, manualReview: 0, mutated: 0 },
    });

    await runAriaBackfillCommand({
      argv: ['feedback-profile', '--apply', '--source-digest', seal.sourceDigest],
      env: {
        DATABASE_URL: databaseUrl,
        NEXUS_DISPOSABLE_POSTGRES: '1',
        ARIA_BACKFILL_APPLY_AUTHORIZATION: 'M1_EXPLICIT_APPLY',
      },
    }, {
      createPool: () => pool as never,
      backfillAriaFeedbackProfiles: backfillFeedback as never,
      write: jest.fn(),
    });

    expect(backfillFeedback).toHaveBeenCalledTimes(1);
    expect(backfillFeedback).toHaveBeenCalledWith(pool, {
      runId: `feedback-profile-${seal.sourceDigest.slice(0, 24)}`,
      sourceDigest: seal.sourceDigest,
      prerequisiteRunId: `feedback-profile-${seal.sourceDigest.slice(0, 24)}-audit`,
      mode: 'APPLY',
    });
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('RUNNER_FEEDBACK_APPLY_REJECTS_AUDIT_COUNTS_DIVERGENT_FROM_SEALED_SNAPSHOT', async () => {
    const seal = createAriaBackfillSnapshot({
      target: 'feedback-profile', plannerVersion: 1,
      inputs: { feedbackProfileContract: { version: 1 } }, units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    const client = {
      query: jest.fn(async (sql: string) => sql.includes("mode = 'DRY_RUN'")
        ? {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: seal.sourceDigest,
            sourceSnapshot: seal.sourceSnapshot, scannedCount: 1,
            deterministicCount: 1, archivedCount: 0, manualReviewCount: 0,
          }],
        }
        : { rowCount: 0, rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const worker = jest.fn();

    await expect(runAriaBackfillCommand({
      argv: ['feedback-profile', '--apply', '--source-digest', seal.sourceDigest],
      env: {
        DATABASE_URL: databaseUrl,
        NEXUS_DISPOSABLE_POSTGRES: '1',
        ARIA_BACKFILL_APPLY_AUTHORIZATION: 'M1_EXPLICIT_APPLY',
      },
    }, {
      createPool: () => pool as never,
      backfillAriaFeedbackProfiles: worker as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_BACKFILL_MATCHING_AUDIT_REQUIRED');

    expect(worker).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('delegates entitlement APPLY exact snapshot validation to its locked worker', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const backfillEntitlements = jest.fn().mockResolvedValue({
      scanned: 0, deterministic: 0, archived: 0, manualReview: 0, mutated: 0,
    });

    await runAriaBackfillCommand({
      argv: [
        'entitlements', '--apply', '--source-digest', digest,
        '--now', '2026-08-30T12:00:00.000Z',
      ],
      env: {
        DATABASE_URL: databaseUrl,
        NEXUS_DISPOSABLE_POSTGRES: '1',
        ARIA_BACKFILL_APPLY_AUTHORIZATION: 'M1_EXPLICIT_APPLY',
      },
    }, {
      createPool: () => pool as never,
      backfillAriaEntitlements: backfillEntitlements as never,
      write: jest.fn(),
    });

    expect(backfillEntitlements).toHaveBeenCalledTimes(1);
    expect(backfillEntitlements).toHaveBeenCalledWith(pool, {
      runId: `entitlements-${digest.slice(0, 24)}`,
      sourceDigest: digest,
      prerequisiteRunId: `entitlements-${digest.slice(0, 24)}-audit`,
      mode: 'APPLY',
      now: new Date('2026-08-30T12:00:00.000Z'),
    });
    expect(pool.connect).not.toHaveBeenCalled();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('loads canonical context evidence and commits an explicitly authorized apply transaction', async () => {
    const root = mkdtempSync(join(tmpdir(), 'aria-backfill-evidence-'));
    try {
      const evidencePath = join(root, 'evidence.json');
      writeFileSync(evidencePath, JSON.stringify({
        skillCourseCandidates: { 'skill-1': ['eds-maths-terminale'] },
        resourceCourseCandidates: { 'resource-1': ['eds-maths-terminale'] },
        academicSubjectCandidates: { MATHEMATIQUES: ['eds-maths-terminale'] },
      }));
      const queries: string[] = [];
      const client = {
        query: jest.fn(async (sql: string) => {
          queries.push(sql);
          if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'APPLY'")) {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('FROM aria_data_migration_runs')) return {
            rowCount: 1,
            rows: [{
              status: 'COMPLETED', sourceDigest: digest, scannedCount: 1,
              deterministicCount: 1, archivedCount: 0, manualReviewCount: 0,
            }],
          };
          return { rowCount: 0, rows: [] };
        }),
        release: jest.fn(),
      };
      const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
      const backfillContexts = jest.fn().mockResolvedValue({
        scanned: 1, deterministic: 1, archived: 0, manualReview: 0, mutated: 1,
      });

      await runAriaBackfillCommand({
        argv: [
          'conversation-context', '--apply', '--source-digest', digest,
          '--evidence', evidencePath,
        ],
        env: {
          DATABASE_URL: databaseUrl,
          NEXUS_DISPOSABLE_POSTGRES: '1',
          ARIA_BACKFILL_APPLY_AUTHORIZATION: 'M1_EXPLICIT_APPLY',
        },
      }, {
        createPool: () => pool as never,
        backfillConversationContexts: backfillContexts as never,
        write: jest.fn(),
      });

      expect(backfillContexts).toHaveBeenCalledTimes(1);
      expect(backfillContexts).toHaveBeenCalledWith(client, expect.objectContaining({
        mode: 'APPLY',
        prerequisiteRunId: `conversation-context-${digest.slice(0, 24)}-audit`,
        evidence: {
          skillCourseCandidates: new Map([['skill-1', ['eds-maths-terminale']]]),
          resourceCourseCandidates: new Map([['resource-1', ['eds-maths-terminale']]]),
          academicSubjectCandidates: new Map([['MATHEMATIQUES', ['eds-maths-terminale']]]),
        },
      }));
      expect(queries).toEqual(['BEGIN', 'COMMIT']);
      expect(client.release).toHaveBeenCalledTimes(1);
      expect(pool.end).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('commits conversation-turn apply and does not issue the audit rollback', async () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'APPLY'")) {
          return { rowCount: 0, rows: [] };
        }
        if (sql.includes('FROM aria_data_migration_runs')) return {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: digest, scannedCount: 2,
            deterministicCount: 1, archivedCount: 0, manualReviewCount: 0,
          }],
        };
        return { rowCount: 0, rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const backfillTurns = jest.fn().mockResolvedValue({
      scannedMessages: 2, turnsCreated: 1, deterministicGroups: 1,
      archivedGroups: 0, manualReviewGroups: 0,
    });
    await runAriaBackfillCommand({
      argv: ['conversation-turns', '--apply', '--source-digest', digest],
      env: {
        DATABASE_URL: databaseUrl,
        NEXUS_DISPOSABLE_POSTGRES: '1',
        ARIA_BACKFILL_APPLY_AUTHORIZATION: 'M1_EXPLICIT_APPLY',
      },
    }, {
      createPool: () => pool as never,
      backfillConversationTurns: backfillTurns as never,
      write: jest.fn(),
    });
    expect(backfillTurns).toHaveBeenCalledTimes(1);
    expect(backfillTurns).toHaveBeenCalledWith(client, {
      runId: `conversation-turns-${digest.slice(0, 24)}`,
      sourceDigest: digest,
      prerequisiteRunId: `conversation-turns-${digest.slice(0, 24)}-audit`,
      mode: 'APPLY',
    });
    expect(queries).toEqual(['BEGIN', 'COMMIT']);
  });
});
