import {
  parseAriaBackfillCommand,
  runAriaBackfillCommand,
  verifyAriaBackfillRun,
} from '@/scripts/aria/run-backfills';
import { createAriaBackfillSnapshot } from '@/scripts/aria/backfill-snapshot';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    const backfillTurns = jest.fn().mockResolvedValue({
      scannedMessages: 0, turnsCreated: 0, archivedGroups: 0,
    });

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
    })).rejects.toThrow('ARIA_BACKFILL_MATCHING_AUDIT_REQUIRED');

    expect(backfillTurns).not.toHaveBeenCalled();
    expect(queries.slice(0, 3)).toEqual([
      'BEGIN',
      expect.stringContaining("mode = 'APPLY'"),
      'COMMIT',
    ]);
    expect(queries.slice(-3)).toEqual([
      'BEGIN',
      expect.stringContaining("mode = 'DRY_RUN'"),
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(2);
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
    const backfillTurns = jest.fn().mockRejectedValue(new Error('MUST_NOT_RECALCULATE'));
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

    expect(backfillTurns).not.toHaveBeenCalled();
    expect(JSON.parse(output.join(''))).toMatchObject({
      mode: 'APPLY', target: 'conversation-turns', replayed: true,
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
      backfillConversationTurns: jest.fn() as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_BACKFILL_MATCHING_AUDIT_REQUIRED');
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
      backfillConversationTurns: jest.fn() as never,
      write: jest.fn(),
    })).rejects.toThrow('ARIA_BACKFILL_AUDIT_COUNT_MISMATCH');
  });

  it('re-reads an identical persisted audit when a concurrent seal wins the insert', async () => {
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
                status: 'COMPLETED', sourceDigest: digest, scannedCount: 0,
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
        scannedMessages: 0, turnsCreated: 0, archivedGroups: 0,
      }) as never,
      write: jest.fn(),
    });

    expect(auditReads).toBe(2);
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

  it('dispatches audit read-only, rolls it back, then seals its exact counts', async () => {
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
      target: 'conversation-turns',
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
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('FROM aria_data_migration_runs')) return {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: digest, scannedCount: 1,
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
      argv: ['feedback-profile', '--verify', '--source-digest', digest],
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
    const feedbackSeal = createAriaBackfillSnapshot({
      target: 'feedback-profile',
      plannerVersion: 1,
      inputs: { feedbackProfileContract: { version: 1 } },
      units: [{ action: 'CREATE' }, { action: 'MANUAL_NOOP' }],
      report: { scanned: 2, deterministic: 1, archived: 0, manualReview: 1 },
    });
    const client = {
      query: jest.fn(async (sql: string) => sql.includes('INSERT INTO aria_data_migration_runs')
        ? { rowCount: 1, rows: [{ id: 'audit' }] }
        : { rowCount: 0, rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client), end: jest.fn() };
    const backfillEntitlements = jest.fn().mockResolvedValue({
      scanned: 1, deterministic: 1, archived: 0, manualReview: 0, mutated: 0,
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
    const client = {
      query: jest.fn(async (sql: string) => sql.includes("mode = 'DRY_RUN'")
        ? {
          rowCount: 1,
          rows: [{
            status: 'COMPLETED', sourceDigest: digest,
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
      argv: ['feedback-profile', '--apply', '--source-digest', digest],
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
      runId: `feedback-profile-${digest.slice(0, 24)}`,
      sourceDigest: digest,
      prerequisiteRunId: `feedback-profile-${digest.slice(0, 24)}-audit`,
      mode: 'APPLY',
    });
    expect(client.release).toHaveBeenCalledTimes(1);
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

      expect(backfillContexts).toHaveBeenCalledTimes(2);
      expect(backfillContexts).toHaveBeenCalledWith(client, expect.objectContaining({
        mode: 'APPLY',
        evidence: {
          skillCourseCandidates: new Map([['skill-1', ['eds-maths-terminale']]]),
          resourceCourseCandidates: new Map([['resource-1', ['eds-maths-terminale']]]),
          academicSubjectCandidates: new Map([['MATHEMATIQUES', ['eds-maths-terminale']]]),
        },
      }));
      expect(queries[0]).toBe('BEGIN');
      expect(queries[1]).toContain('FROM aria_data_migration_runs');
      expect(queries.at(-1)).toBe('COMMIT');
      expect(client.release).toHaveBeenCalledTimes(2);
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
      scannedMessages: 2, turnsCreated: 1, archivedGroups: 0,
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
    expect(backfillTurns).toHaveBeenCalledTimes(2);
    expect(backfillTurns.mock.calls.map(([, options]) => options.mode)).toEqual(['DRY_RUN', 'APPLY']);
    expect(queries[0]).toBe('BEGIN');
    expect(queries[1]).toContain('FROM aria_data_migration_runs');
    expect(queries.at(-1)).toBe('COMMIT');
  });
});
