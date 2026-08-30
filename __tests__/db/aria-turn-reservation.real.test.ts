/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  buildAriaConversationContext,
  reserveAriaConversationTurn,
} from '@/lib/aria/application/conversation/public';

jest.mock('@/lib/aria/infrastructure/rag/manifest', () => ({
  getAriaRagCorpusCapability: jest.fn(() => ({
    status: 'AVAILABLE',
    corpus: {
      corpusId: 'fixture-maths-premiere', corpusVersionId: 'fixture-v1',
      physicalCollection: 'fixture_maths_premiere', manifestSha256: 'a'.repeat(64),
      resourceRegistrySha256: 'b'.repeat(64), academicYear: '2026-2027',
      curriculumVersion: 'fixture-v1', retrievalScope: {},
      retrievalScopeSha256: 'c'.repeat(64), resourceBindings: [],
    },
  })),
}));

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('ARIA Turn reservation transaction on PostgreSQL', () => {
  let pool: Pool;
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    studentUser: randomUUID(),
    student: randomUUID(),
    entitlement: randomUUID(),
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
       ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
      [
        ids.parentUser,
        `parent-${ids.parentUser}@invalid.test`,
        ids.studentUser,
        `student-${ids.studentUser}@invalid.test`,
      ],
    );
    await pool.query('INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)', [
      ids.parent,
      ids.parentUser,
    ]);
    await pool.query(
      `INSERT INTO students
       (id, "parentId", "userId", "gradeLevel", "academicTrack", "updatedAt")
       VALUES ($1, $2, $3, 'PREMIERE', 'EDS_GENERALE', NOW())`,
      [ids.student, ids.parent, ids.studentUser],
    );
    await pool.query(
      `INSERT INTO student_academic_enrollments
       (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
      [randomUUID(), ids.student],
    );
    await pool.query(
      `INSERT INTO entitlements
       (id, "userId", "productCode", label, status, "startsAt", "endsAt", "createdAt", "updatedAt")
       VALUES ($1, $2, 'ARIA_ACCESS', 'ARIA', 'ACTIVE', NOW() - INTERVAL '1 day',
               NOW() + INTERVAL '30 days', NOW(), NOW())`,
      [ids.entitlement, ids.studentUser],
    );
    await pool.query(
      `INSERT INTO aria_entitlement_scopes
       (id, "entitlementId", kind, "courseKey", "createdAt", "updatedAt")
       VALUES ($1, $2, 'COURSE', 'eds-maths-premiere', NOW(), NOW())`,
      [randomUUID(), ids.entitlement],
    );
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM canonical_job_outbox
       WHERE "jobType"='RECOVER_ARIA_TURN'
         AND "aggregateId" IN (
           SELECT id FROM aria_conversation_turns WHERE "subjectStudentId"=$1
         )`,
      [ids.student],
    );
    await pool.query('DELETE FROM aria_conversations WHERE "studentId" = $1', [ids.student]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [
      [ids.studentUser, ids.parentUser],
    ]);
    await pool.end();
  });

  it('reserves one PENDING Turn, accepted user message, assistant placeholder and watchdog', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const now = new Date('2026-08-30T12:00:00.000Z');

    const first = await reserveAriaConversationTurn({
      context,
      clientRequestId,
      message: 'Explique-moi les suites arithmétiques.',
      now,
    });
    const retry = await reserveAriaConversationTurn({
      context,
      clientRequestId,
      message: 'Explique-moi les suites arithmétiques.',
      now: new Date(now.getTime() + 1_000),
    });

    expect(first.disposition).toBe('RESERVED');
    expect(retry).toMatchObject({
      disposition: 'IN_PROGRESS',
      turnId: first.turnId,
      conversationId: first.conversationId,
    });

    const turns = await pool.query(
      `SELECT status::text, sequence FROM aria_conversation_turns
       WHERE "actorUserId" = $1 AND "clientRequestId" = $2`,
      [ids.studentUser, clientRequestId],
    );
    expect(turns.rows).toEqual([{ status: 'PENDING', sequence: 1 }]);

    const messages = await pool.query(
      `SELECT role, status, "turnRole"::text FROM aria_messages
       WHERE "turnId" = $1 ORDER BY "turnRole"`,
      [first.turnId],
    );
    expect(messages.rows).toEqual([
      { role: 'assistant', status: 'PENDING', turnRole: 'ASSISTANT' },
      { role: 'user', status: 'COMPLETED', turnRole: 'USER' },
    ]);

    const watchdogs = await pool.query(
      `SELECT "availableAt" > TIMESTAMP '2026-08-30 12:00:00' AS scheduled, payload
       FROM canonical_job_outbox
       WHERE "idempotencyKey" = $1`,
      [`aria-turn-watchdog:${first.turnId}`],
    );
    expect(watchdogs.rowCount).toBe(1);
    expect(watchdogs.rows[0].payload).toEqual({ turnId: first.turnId });
    expect(watchdogs.rows[0].scheduled).toBe(true);
  });

  it('rejects reuse of an idempotency key with a different request fingerprint', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    await reserveAriaConversationTurn({ context, clientRequestId, message: 'Première question' });

    await expect(reserveAriaConversationTurn({
      context,
      clientRequestId,
      message: 'Payload modifié',
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
  });

  it('replays the persisted terminal Turn without creating another message pair', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const first = await reserveAriaConversationTurn({
      context,
      clientRequestId,
      message: 'Rejoue cette réponse terminale',
    });
    await pool.query(
      `UPDATE aria_conversation_turns
       SET status = 'ERROR', "completedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $1`,
      [first.turnId],
    );

    const replay = await reserveAriaConversationTurn({
      context,
      clientRequestId,
      message: 'Rejoue cette réponse terminale',
    });
    expect(replay).toMatchObject({
      disposition: 'REPLAY',
      status: 'ERROR',
      turnId: first.turnId,
      conversationId: first.conversationId,
    });
    const messages = await pool.query(
      'SELECT count(*)::int AS count FROM aria_messages WHERE "turnId" = $1',
      [first.turnId],
    );
    expect(messages.rows).toEqual([{ count: 2 }]);
  });

  it('rolls back the whole reservation when assistant placeholder persistence fails', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const before = await pool.query(
      'SELECT count(*)::int AS count FROM aria_conversations WHERE "studentId" = $1',
      [ids.student],
    );
    await pool.query(`
      CREATE OR REPLACE FUNCTION aria_test_reject_placeholder() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.role = 'assistant' AND NEW.content = '' THEN
          RAISE EXCEPTION 'ARIA_TEST_PLACEHOLDER_FAILURE';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER aria_test_reject_placeholder
      BEFORE INSERT ON aria_messages
      FOR EACH ROW EXECUTE FUNCTION aria_test_reject_placeholder();
    `);

    try {
      await expect(reserveAriaConversationTurn({
        context,
        clientRequestId,
        message: 'ROLLBACK_TX1',
      })).rejects.toThrow('ARIA_TEST_PLACEHOLDER_FAILURE');
    } finally {
      await pool.query(`
        DROP TRIGGER aria_test_reject_placeholder ON aria_messages;
        DROP FUNCTION aria_test_reject_placeholder();
      `);
    }

    const persisted = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM aria_conversation_turns WHERE "clientRequestId" = $1) AS turns,
         (SELECT count(*)::int FROM aria_messages WHERE content = 'ROLLBACK_TX1') AS messages,
         (SELECT count(*)::int FROM aria_conversations WHERE "studentId" = $2) AS conversations`,
      [clientRequestId, ids.student],
    );
    expect(persisted.rows).toEqual([{
      turns: 0,
      messages: 0,
      conversations: before.rows[0].count,
    }]);
  });
});
