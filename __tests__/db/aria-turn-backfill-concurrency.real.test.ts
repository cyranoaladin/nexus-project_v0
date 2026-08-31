/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import {
  backfillConversationTurns,
  type ConversationTurnBackfillReport,
} from '@/scripts/aria/backfill-conversation-turns';
import {
  backfillConversationContexts,
  type ConversationContextBackfillReport,
  type LegacyContextEvidence,
} from '@/scripts/aria/backfill-conversation-context';
import { rollbackLegacyBackfill } from '@/scripts/aria/run-backfills';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

async function waitForDatabaseCondition(
  condition: () => Promise<boolean>,
  timeoutMs = 2_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}

async function sealTurnDryRun(
  pool: Pool,
  runId: string,
  report: ConversationTurnBackfillReport,
): Promise<void> {
  await pool.query(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
       "scannedCount", "deterministicCount", "archivedCount", "manualReviewCount",
       "mutatedCount", "completedAt")
     VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
             'COMPLETED', $4, $5, $6, $7, 0, NOW())`,
    [
      runId,
      JSON.stringify(report.sourceSnapshot),
      report.sourceDigest,
      report.scannedMessages,
      report.deterministicGroups,
      report.archivedGroups,
      report.manualReviewGroups,
    ],
  );
}

async function sealContextDryRun(
  pool: Pool,
  runId: string,
  report: ConversationContextBackfillReport,
): Promise<void> {
  await pool.query(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
       "scannedCount", "deterministicCount", "archivedCount", "manualReviewCount",
       "mutatedCount", "completedAt")
     VALUES ($1, 'aria-conversation-context-v1', 'DRY_RUN', $2::jsonb, $3,
             'COMPLETED', $4, $5, $6, $7, 0, NOW())`,
    [
      runId,
      JSON.stringify(report.sourceSnapshot),
      report.sourceDigest,
      report.scanned,
      report.deterministic,
      report.archived,
      report.manualReview,
    ],
  );
}

describe('ARIA conversation-turn backfill concurrency on PostgreSQL', () => {
  let pool: Pool;

  beforeAll(() => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('B2_CONCURRENT_CONTEXT_CHANGE_CANNOT_ESCAPE_FROZEN_PLAN', async () => {
    const parentUserId = randomUUID();
    const parentId = randomUUID();
    const studentUserId = randomUUID();
    const studentId = randomUUID();
    const conversationId = randomUUID();
    const userMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    const applyRunId = randomUUID();
    const prerequisiteRunId = randomUUID();
    let locker: PoolClient | undefined;
    let worker: PoolClient | undefined;
    let lockerOpen = false;
    let workerOpen = false;
    let apply: ReturnType<typeof backfillConversationTurns> | undefined;

    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
        ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
      [
        parentUserId,
        `parent-${parentUserId}@invalid.test`,
        studentUserId,
        `student-${studentUserId}@invalid.test`,
      ],
    );
    await pool.query(
      'INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)',
      [parentId, parentUserId],
    );
    await pool.query(
      `INSERT INTO students
        (id, "parentId", "userId", "gradeLevel", "updatedAt")
       VALUES ($1, $2, $3, 'PREMIERE', NOW())`,
      [studentId, parentId, studentUserId],
    );
    await pool.query(
      `INSERT INTO aria_conversations
        (id, "studentId", "courseKey", "contextState", "contextVersion", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'ACTIVE', 'v1', NOW())`,
      [conversationId, studentId],
    );
    await pool.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt") VALUES
        ($1, $3, 'user', 'legacy-user', 'COMPLETED', '2029-04-01 10:00:00.000'),
        ($2, $3, 'assistant', 'legacy-assistant', 'COMPLETED', '2029-04-01 10:00:01.000')`,
      [userMessageId, assistantMessageId, conversationId],
    );

    const auditClient = await pool.connect();
    let dryRun: ConversationTurnBackfillReport;
    try {
      dryRun = await backfillConversationTurns(auditClient, {
        runId: applyRunId,
        mode: 'DRY_RUN',
        sourceDigest: '0'.repeat(64),
      });
    } finally {
      auditClient.release();
    }
    expect(dryRun).toMatchObject({
      scannedMessages: 2,
      deterministicGroups: 1,
      archivedGroups: 0,
      manualReviewGroups: 0,
    });
    await sealTurnDryRun(pool, prerequisiteRunId, dryRun);

    try {
      locker = await pool.connect();
      worker = await pool.connect();
      const workerPid = await worker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      await locker.query('BEGIN');
      lockerOpen = true;
      await locker.query(
        'SELECT id FROM aria_conversations WHERE id = $1 FOR UPDATE',
        [conversationId],
      );
      await worker.query('BEGIN');
      workerOpen = true;
      apply = backfillConversationTurns(worker, {
        runId: applyRunId,
        mode: 'APPLY',
        sourceDigest: dryRun.sourceDigest,
        prerequisiteRunId,
      });

      const blocked = await waitForDatabaseCondition(async () => {
        const activity = await pool.query<{ waitEventType: string | null }>(
          `SELECT wait_event_type AS "waitEventType"
           FROM pg_stat_activity WHERE pid = $1`,
          [workerPid.rows[0].pid],
        );
        return activity.rows[0]?.waitEventType === 'Lock';
      });
      expect(blocked).toBe(true);

      await locker.query(
        `UPDATE aria_conversations
         SET "contextVersion" = 'v2', "updatedAt" = NOW()
         WHERE id = $1`,
        [conversationId],
      );
      await locker.query('COMMIT');
      lockerOpen = false;

      await expect(apply).rejects.toThrow(
        'ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH',
      );
      await worker.query('ROLLBACK');
      workerOpen = false;

      await expect(pool.query(
        `SELECT COUNT(*)::integer AS count FROM aria_conversation_turns
         WHERE "conversationId" = $1`,
        [conversationId],
      )).resolves.toMatchObject({ rows: [{ count: 0 }] });
      await expect(pool.query(
        `SELECT COUNT(*)::integer AS count FROM aria_messages
         WHERE id = ANY($1::text[]) AND "turnId" IS NOT NULL`,
        [[userMessageId, assistantMessageId]],
      )).resolves.toMatchObject({ rows: [{ count: 0 }] });
      await expect(pool.query(
        'SELECT COUNT(*)::integer AS count FROM aria_data_migration_runs WHERE id = $1',
        [applyRunId],
      )).resolves.toMatchObject({ rows: [{ count: 0 }] });
    } finally {
      if (lockerOpen && locker) await locker.query('ROLLBACK');
      if (workerOpen && worker) await worker.query('ROLLBACK');
      await Promise.allSettled(apply ? [apply] : []);
      locker?.release();
      worker?.release();
      await pool.query('DELETE FROM users WHERE id = $1', [parentUserId]);
    }
  });

  it('B2_CONCURRENT_LIVE_TURN_RESERVATION_DOES_NOT_DEADLOCK', async () => {
    const parentUserId = randomUUID();
    const parentId = randomUUID();
    const studentUserId = randomUUID();
    const studentId = randomUUID();
    const legacyConversationId = randomUUID();
    const runtimeConversationId = randomUUID();
    const legacyUserMessageId = randomUUID();
    const legacyAssistantMessageId = randomUUID();
    const runtimeTurnId = randomUUID();
    const runtimeMessageId = randomUUID();
    const applyRunId = randomUUID();
    const prerequisiteRunId = randomUUID();
    let locker: PoolClient | undefined;
    let worker: PoolClient | undefined;
    let lockerOpen = false;
    let workerOpen = false;
    let apply: ReturnType<typeof backfillConversationTurns> | undefined;

    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
        ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
      [
        parentUserId,
        `parent-${parentUserId}@invalid.test`,
        studentUserId,
        `student-${studentUserId}@invalid.test`,
      ],
    );
    await pool.query(
      'INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)',
      [parentId, parentUserId],
    );
    await pool.query(
      `INSERT INTO students
        (id, "parentId", "userId", "gradeLevel", "updatedAt")
       VALUES ($1, $2, $3, 'PREMIERE', NOW())`,
      [studentId, parentId, studentUserId],
    );
    await pool.query(
      `INSERT INTO aria_conversations
        (id, "studentId", "courseKey", "contextState", "contextVersion", "updatedAt") VALUES
        ($1, $3, 'eds-maths-premiere', 'ACTIVE', 'v1', NOW()),
        ($2, $3, 'eds-maths-premiere', 'ACTIVE', 'v1', NOW())`,
      [legacyConversationId, runtimeConversationId, studentId],
    );
    await pool.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt") VALUES
        ($1, $3, 'user', 'legacy-user', 'COMPLETED', '2029-04-02 10:00:00.000'),
        ($2, $3, 'assistant', 'legacy-assistant', 'COMPLETED', '2029-04-02 10:00:01.000')`,
      [legacyUserMessageId, legacyAssistantMessageId, legacyConversationId],
    );
    const auditClient = await pool.connect();
    let dryRun: ConversationTurnBackfillReport;
    try {
      dryRun = await backfillConversationTurns(auditClient, {
        runId: applyRunId,
        mode: 'DRY_RUN',
        sourceDigest: '0'.repeat(64),
      });
    } finally {
      auditClient.release();
    }
    await sealTurnDryRun(pool, prerequisiteRunId, dryRun);

    try {
      locker = await pool.connect();
      worker = await pool.connect();
      const workerPid = await worker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      await locker.query('BEGIN');
      lockerOpen = true;
      await locker.query("SET LOCAL lock_timeout = '400ms'");
      await locker.query(
        `INSERT INTO aria_conversation_turns
          (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
           "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
           "completedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'CONVERSATION', $5, $6, 1, 'COMPLETED', $7::jsonb,
                 NOW(), NOW(), NOW())`,
        [
          runtimeTurnId,
          runtimeConversationId,
          studentId,
          studentUserId,
          randomUUID(),
          'e'.repeat(64),
          JSON.stringify({ contextVersion: 'v1', courseKey: 'eds-maths-premiere' }),
        ],
      );

      await worker.query('BEGIN');
      workerOpen = true;
      apply = backfillConversationTurns(worker, {
        runId: applyRunId,
        mode: 'APPLY',
        sourceDigest: dryRun.sourceDigest,
        prerequisiteRunId,
      });
      const blockedOnTurnTable = await waitForDatabaseCondition(async () => {
        const activity = await pool.query<{ waitEventType: string | null }>(
          `SELECT wait_event_type AS "waitEventType"
           FROM pg_stat_activity WHERE pid = $1`,
          [workerPid.rows[0].pid],
        );
        return activity.rows[0]?.waitEventType === 'Lock';
      });
      expect(blockedOnTurnTable).toBe(true);

      await expect(locker.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "turnId", "turnRole", "createdAt")
         VALUES ($1, $2, 'user', 'runtime-user', 'COMPLETED', $3, 'USER', NOW())`,
        [runtimeMessageId, runtimeConversationId, runtimeTurnId],
      )).resolves.toMatchObject({ rowCount: 1 });
      await locker.query('COMMIT');
      lockerOpen = false;

      await expect(apply).resolves.toMatchObject({
        scannedMessages: 2,
        deterministicGroups: 1,
        turnsCreated: 1,
      });
      await worker.query('ROLLBACK');
      workerOpen = false;
    } finally {
      if (lockerOpen && locker) await locker.query('ROLLBACK');
      if (workerOpen && worker) await worker.query('ROLLBACK');
      await Promise.allSettled(apply ? [apply] : []);
      locker?.release();
      worker?.release();
      await pool.query('DELETE FROM users WHERE id = $1', [parentUserId]);
    }
  });

  it('B1_ROLLBACK_WAITS_FOR_INFLIGHT_ZERO_TURN_B2_AND_REJECTS_AFTER_COMMIT', async () => {
    const parentUserId = randomUUID();
    const parentId = randomUUID();
    const studentUserId = randomUUID();
    const studentId = randomUUID();
    const conversationId = randomUUID();
    const messageId = randomUUID();
    const contextApplyRunId = randomUUID();
    const contextAuditRunId = randomUUID();
    const turnApplyRunId = randomUUID();
    const turnAuditRunId = randomUUID();
    const contextEvidence: LegacyContextEvidence = {
      skillCourseCandidates: new Map([['zero-turn-concurrent-skill', ['eds-maths-premiere']]]),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    };
    let b2Worker: PoolClient | undefined;
    let b1Worker: PoolClient | undefined;
    let b2Open = false;
    let b1Open = false;
    let rollback: ReturnType<typeof rollbackLegacyBackfill> | undefined;

    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
        ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
      [
        parentUserId,
        `parent-${parentUserId}@invalid.test`,
        studentUserId,
        `student-${studentUserId}@invalid.test`,
      ],
    );
    await pool.query(
      'INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)',
      [parentId, parentUserId],
    );
    await pool.query(
      `INSERT INTO students
        (id, "parentId", "userId", "gradeLevel", "updatedAt")
       VALUES ($1, $2, $3, 'PREMIERE', NOW())`,
      [studentId, parentId, studentUserId],
    );
    await pool.query(
      `INSERT INTO aria_conversations
        (id, "studentId", subject, "skillId", "contextState", "updatedAt")
       VALUES ($1, $2, 'MATHEMATIQUES', 'zero-turn-concurrent-skill',
               'LEGACY_CONTEXT_UNRESOLVED', NOW())`,
      [conversationId, studentId],
    );

    const contextClient = await pool.connect();
    try {
      await contextClient.query('BEGIN');
      const contextDryRun = await backfillConversationContexts(contextClient, {
        runId: contextApplyRunId,
        mode: 'DRY_RUN',
        sourceDigest: '0'.repeat(64),
        evidence: contextEvidence,
      });
      await contextClient.query('COMMIT');
      await sealContextDryRun(pool, contextAuditRunId, contextDryRun);
      await contextClient.query('BEGIN');
      await backfillConversationContexts(contextClient, {
        runId: contextApplyRunId,
        mode: 'APPLY',
        sourceDigest: contextDryRun.sourceDigest,
        prerequisiteRunId: contextAuditRunId,
        evidence: contextEvidence,
      });
      await contextClient.query('COMMIT');
    } finally {
      contextClient.release();
    }
    await pool.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt")
       VALUES ($1, $2, 'user', 'pending', 'PENDING', '2029-04-03 10:00:00.000')`,
      [messageId, conversationId],
    );
    const auditClient = await pool.connect();
    let turnDryRun: ConversationTurnBackfillReport;
    try {
      turnDryRun = await backfillConversationTurns(auditClient, {
        runId: turnApplyRunId,
        mode: 'DRY_RUN',
        sourceDigest: '0'.repeat(64),
      });
    } finally {
      auditClient.release();
    }
    expect(turnDryRun).toMatchObject({
      scannedMessages: 1,
      deterministicGroups: 0,
      archivedGroups: 1,
      manualReviewGroups: 0,
    });
    await sealTurnDryRun(pool, turnAuditRunId, turnDryRun);

    try {
      b2Worker = await pool.connect();
      b1Worker = await pool.connect();
      const b1Pid = await b1Worker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      await b2Worker.query('BEGIN');
      b2Open = true;
      await expect(backfillConversationTurns(b2Worker, {
        runId: turnApplyRunId,
        mode: 'APPLY',
        sourceDigest: turnDryRun.sourceDigest,
        prerequisiteRunId: turnAuditRunId,
      })).resolves.toMatchObject({ turnsCreated: 0 });

      await b1Worker.query('BEGIN');
      b1Open = true;
      rollback = rollbackLegacyBackfill(b1Worker, contextApplyRunId);
      const blocked = await waitForDatabaseCondition(async () => {
        const activity = await pool.query<{ waitEventType: string | null }>(
          `SELECT wait_event_type AS "waitEventType"
           FROM pg_stat_activity WHERE pid = $1`,
          [b1Pid.rows[0].pid],
        );
        return activity.rows[0]?.waitEventType === 'Lock';
      });
      expect(blocked).toBe(true);

      await b2Worker.query('COMMIT');
      b2Open = false;
      await expect(rollback).rejects.toThrow('ARIA_BACKFILL_ROLLBACK_DEPENDENCY_CONFLICT');
      await b1Worker.query('ROLLBACK');
      b1Open = false;
      await expect(pool.query(
        `SELECT "courseKey", "contextState"::text, "contextMigrationRunId"
         FROM aria_conversations WHERE id = $1`,
        [conversationId],
      )).resolves.toMatchObject({
        rows: [{
          courseKey: 'eds-maths-premiere',
          contextState: 'ACTIVE',
          contextMigrationRunId: contextApplyRunId,
        }],
      });
    } finally {
      if (b2Open && b2Worker) await b2Worker.query('ROLLBACK');
      if (b1Open && b1Worker) await b1Worker.query('ROLLBACK');
      await Promise.allSettled(rollback ? [rollback] : []);
      b2Worker?.release();
      b1Worker?.release();
      await pool.query('DELETE FROM users WHERE id = $1', [parentUserId]);
    }
  });
});
