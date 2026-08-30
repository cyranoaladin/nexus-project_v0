/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  buildAriaConversationContext,
  claimAriaConversationTurn,
  reserveAriaConversationTurn,
} from '@/lib/aria/application/conversation/public';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('ARIA Turn idempotency and concurrency on PostgreSQL', () => {
  let pool: Pool;
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    studentUser: randomUUID(),
    student: randomUUID(),
    entitlement: randomUUID(),
    conversation: randomUUID(),
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
       ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
      [ids.parentUser, `parent-${ids.parentUser}@invalid.test`, ids.studentUser, `student-${ids.studentUser}@invalid.test`],
    );
    await pool.query('INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)', [ids.parent, ids.parentUser]);
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
    await pool.query(
      `INSERT INTO aria_conversations
       (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'ACTIVE', NOW())`,
      [ids.conversation, ids.student],
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
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[ids.studentUser, ids.parentUser]]);
    await pool.end();
  });

  it('concurrently reserves the same clientRequestId exactly once', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const requests = Array.from({ length: 8 }, () => reserveAriaConversationTurn({
      context,
      clientRequestId,
      message: 'Même requête concurrente',
    }));
    const results = await Promise.all(requests);

    expect(new Set(results.map((result) => result.turnId))).toEqual(new Set([results[0].turnId]));
    expect(results.filter((result) => result.disposition === 'RESERVED')).toHaveLength(1);
    expect(results.filter((result) => result.disposition === 'IN_PROGRESS')).toHaveLength(7);

    const counts = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM aria_conversation_turns WHERE "clientRequestId" = $1) AS turns,
         (SELECT count(*)::int FROM aria_messages WHERE "turnId" = $2) AS messages,
         (SELECT count(*)::int FROM canonical_job_outbox WHERE "aggregateId" = $2) AS watchdogs,
         (SELECT count(DISTINCT "conversationId")::int FROM aria_conversation_turns
          WHERE "clientRequestId" = $1) AS conversations`,
      [clientRequestId, results[0].turnId],
    );
    expect(counts.rows).toEqual([{ turns: 1, messages: 2, watchdogs: 1, conversations: 1 }]);
  });

  it('allows one independent request and rejects the other as CONVERSATION_BUSY', async () => {
    const freeConversation = randomUUID();
    await pool.query(
      `INSERT INTO aria_conversations
       (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'ACTIVE', NOW())`,
      [freeConversation, ids.student],
    );
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: freeConversation,
    });
    const settled = await Promise.allSettled([
      reserveAriaConversationTurn({ context, clientRequestId: randomUUID(), message: 'A' }),
      reserveAriaConversationTurn({ context, clientRequestId: randomUUID(), message: 'B' }),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = settled.find((result) => result.status === 'rejected');
    expect(rejection).toMatchObject({
      status: 'rejected',
      reason: { code: 'CONVERSATION_BUSY', status: 409 },
    });
    const active = await pool.query(
      `SELECT count(*)::int AS count FROM aria_conversation_turns
       WHERE "conversationId" = $1 AND status IN ('PENDING', 'RUNNING')`,
      [freeConversation],
    );
    expect(active.rows).toEqual([{ count: 1 }]);
  });

  it('allows independent conversations to reserve in parallel', async () => {
    const conversationIds = [randomUUID(), randomUUID()];
    await pool.query(
      `INSERT INTO aria_conversations
       (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $3, 'eds-maths-premiere', 'ACTIVE', NOW()),
              ($2, $3, 'eds-maths-premiere', 'ACTIVE', NOW())`,
      [conversationIds[0], conversationIds[1], ids.student],
    );
    const contexts = await Promise.all(conversationIds.map((conversationId) =>
      buildAriaConversationContext({
        actor: { userId: ids.studentUser, role: 'ELEVE' },
        courseKey: 'eds-maths-premiere',
        conversationId,
      })));

    const reservations = await Promise.all(contexts.map((context, index) =>
      reserveAriaConversationTurn({
        context,
        clientRequestId: randomUUID(),
        message: `Conversation indépendante ${index}`,
      })));
    expect(reservations.map((reservation) => reservation.disposition)).toEqual([
      'RESERVED',
      'RESERVED',
    ]);
    expect(new Set(reservations.map((reservation) => reservation.conversationId))).toEqual(
      new Set(conversationIds),
    );
  });

  it('lets only one worker claim a Turn and never mirrors assistant lifecycle onto user status', async () => {
    const freeConversation = randomUUID();
    await pool.query(
      `INSERT INTO aria_conversations
       (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'ACTIVE', NOW())`,
      [freeConversation, ids.student],
    );
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: freeConversation,
    });
    const reserved = await reserveAriaConversationTurn({
      context,
      clientRequestId: randomUUID(),
      message: 'Claim unique',
    });
    const now = new Date('2026-08-30T12:00:00.000Z');
    const claims = await Promise.all([
      claimAriaConversationTurn({ context, turnId: reserved.turnId, now }),
      claimAriaConversationTurn({ context, turnId: reserved.turnId, now }),
    ]);

    expect(claims.filter((result) => result.disposition === 'CLAIMED')).toHaveLength(1);
    expect(claims.filter((result) => result.disposition === 'NOT_CLAIMED')).toHaveLength(1);
    const messages = await pool.query(
      `SELECT "turnRole"::text, status FROM aria_messages WHERE "turnId" = $1 ORDER BY "turnRole"`,
      [reserved.turnId],
    );
    expect(messages.rows).toEqual([
      { turnRole: 'ASSISTANT', status: 'STREAMING' },
      { turnRole: 'USER', status: 'COMPLETED' },
    ]);
    const watchdog = await pool.query(
      `SELECT "availableAt" > TIMESTAMP '2026-08-30 12:00:00' AS scheduled
       FROM canonical_job_outbox WHERE "aggregateId" = $1`,
      [reserved.turnId],
    );
    expect(watchdog.rows[0].scheduled).toBe(true);
  });
});
