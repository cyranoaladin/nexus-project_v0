/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  buildAriaConversationContext,
  cancelAriaConversationTurn,
  claimAriaConversationTurn,
  reserveAriaConversationTurn,
} from '@/lib/aria/application/conversation/public';
import { fingerprintAriaTurnRequest } from '@/lib/aria/application/conversation/reserve-turn';
import {
  makeRunAriaConversation,
} from '@/lib/aria/application/conversation/run-conversation';
import { prismaAriaConversationRepository } from '@/lib/aria/infrastructure/prisma/conversation-repository';

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

  it('D001 ARIA-B-R057 concurrently reserves the same clientRequestId exactly once', async () => {
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

  it('CODEX_SECURITY_RATE_LIMIT_PRE_RESERVATION denied unique requests create no durable rows', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const before = await pool.query(
      'SELECT count(*)::int AS conversations FROM aria_conversations WHERE "studentId"=$1',
      [ids.student],
    );
    const clientRequestIds = [randomUUID(), randomUUID(), randomUUID()];
    const admission = { admitExecution: jest.fn(async () => ({ status: 'DENIED' as const })) };
    const retrieve = jest.fn();
    const streamModel = jest.fn(async function* () { yield 'interdit'; });
    const run = makeRunAriaConversation({
      repository: prismaAriaConversationRepository,
      admission,
      retrieve,
      buildPrompt: jest.fn(),
      streamModel,
      now: () => new Date('2026-08-31T11:58:00.000Z'),
      createExecutionToken: randomUUID,
      monotonicNow: () => 0,
      modelPolicy: 'ARIA_CHAT_DEFAULT_V1',
      telemetry: { record: jest.fn() },
    });

    const settled = await Promise.allSettled(clientRequestIds.map((clientRequestId) => run({
      requestId: randomUUID(),
      context,
      clientRequestId,
      message: 'Requête indépendante refusée avant persistance.',
    })));
    expect(settled).toHaveLength(clientRequestIds.length);
    for (const result of settled) {
      expect(result).toMatchObject({
        status: 'rejected', reason: { code: 'RATE_LIMIT_EXCEEDED' },
      });
    }
    expect(admission.admitExecution).toHaveBeenCalledTimes(clientRequestIds.length);
    expect(retrieve).not.toHaveBeenCalled();
    expect(streamModel).not.toHaveBeenCalled();

    const persisted = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM aria_conversation_turns
          WHERE "clientRequestId" = ANY($1::text[])) AS turns,
         (SELECT count(*)::int FROM aria_messages
          WHERE "turnId" IN (
            SELECT id FROM aria_conversation_turns WHERE "clientRequestId" = ANY($1::text[])
          )) AS messages,
         (SELECT count(*)::int FROM canonical_job_outbox
          WHERE "aggregateId" IN (
            SELECT id FROM aria_conversation_turns WHERE "clientRequestId" = ANY($1::text[])
          )) AS watchdogs,
         (SELECT count(*)::int FROM aria_conversations WHERE "studentId"=$2) AS conversations`,
      [clientRequestIds, ids.student],
    );
    expect(persisted.rows).toEqual([{
      turns: 0,
      messages: 0,
      watchdogs: 0,
      conversations: before.rows[0].conversations,
    }]);
  });

  it('finds no idempotent reservation for an unknown clientRequestId', async () => {
    await expect(prismaAriaConversationRepository.findTurnReservation({
      actorUserId: ids.studentUser,
      subjectStudentId: ids.student,
      clientRequestId: randomUUID(),
      requestFingerprint: 'a'.repeat(64),
    })).resolves.toBeNull();
  });

  it('finds an exact existing PENDING reservation without creating another row', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const message = 'Réservation existante en lecture seule.';
    const reserved = await reserveAriaConversationTurn({ context, clientRequestId, message });

    await expect(prismaAriaConversationRepository.findTurnReservation({
      actorUserId: ids.studentUser,
      subjectStudentId: ids.student,
      clientRequestId,
      requestFingerprint: fingerprintAriaTurnRequest({ context, clientRequestId, message }),
    })).resolves.toEqual({ ...reserved, disposition: 'IN_PROGRESS' });
  });

  it('rejects a reused idempotency key with a different request fingerprint', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    await reserveAriaConversationTurn({ context, clientRequestId, message: 'Question originale.' });

    await expect(prismaAriaConversationRepository.findTurnReservation({
      actorUserId: ids.studentUser,
      subjectStudentId: ids.student,
      clientRequestId,
      requestFingerprint: fingerprintAriaTurnRequest({
        context, clientRequestId, message: 'Contenu forgé.',
      }),
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('does not disclose another actor idempotency reservation', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const message = 'Réservation privée par acteur.';
    await reserveAriaConversationTurn({ context, clientRequestId, message });

    await expect(prismaAriaConversationRepository.findTurnReservation({
      actorUserId: randomUUID(),
      subjectStudentId: ids.student,
      clientRequestId,
      requestFingerprint: fingerprintAriaTurnRequest({ context, clientRequestId, message }),
    })).resolves.toBeNull();
  });

  it('does not disclose another student idempotency reservation', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const message = 'Réservation privée par élève.';
    await reserveAriaConversationTurn({ context, clientRequestId, message });

    await expect(prismaAriaConversationRepository.findTurnReservation({
      actorUserId: ids.studentUser,
      subjectStudentId: randomUUID(),
      clientRequestId,
      requestFingerprint: fingerprintAriaTurnRequest({ context, clientRequestId, message }),
    })).resolves.toBeNull();
  });

  it.each(['USER', 'ASSISTANT'] as const)(
    'fails closed when an existing reservation has no %s message',
    async (missingRole) => {
      const context = await buildAriaConversationContext({
        actor: { userId: ids.studentUser, role: 'ELEVE' },
        courseKey: 'eds-maths-premiere',
      });
      const clientRequestId = randomUUID();
      const message = `Réservation incomplète sans ${missingRole}.`;
      const reserved = await reserveAriaConversationTurn({ context, clientRequestId, message });
      await pool.query(
        'DELETE FROM aria_messages WHERE "turnId"=$1 AND "turnRole"=$2::"AriaConversationTurnMessageRole"',
        [reserved.turnId, missingRole],
      );

      await expect(prismaAriaConversationRepository.findTurnReservation({
        actorUserId: ids.studentUser,
        subjectStudentId: ids.student,
        clientRequestId,
        requestFingerprint: fingerprintAriaTurnRequest({ context, clientRequestId, message }),
      })).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        internalDetails: { operation: 'classifyTurnReservation', turnId: reserved.turnId },
      });
    },
  );

  it('classifies a cancelled existing reservation as a terminal replay', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const message = 'Réservation annulée à rejouer.';
    const reserved = await reserveAriaConversationTurn({ context, clientRequestId, message });
    await cancelAriaConversationTurn({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      turnId: reserved.turnId,
      clientRequestId,
      now: new Date('2026-08-31T12:03:00.000Z'),
    });

    await expect(prismaAriaConversationRepository.findTurnReservation({
      actorUserId: ids.studentUser,
      subjectStudentId: ids.student,
      clientRequestId,
      requestFingerprint: fingerprintAriaTurnRequest({ context, clientRequestId, message }),
    })).resolves.toEqual({ ...reserved, status: 'CANCELLED', disposition: 'REPLAY' });
  });

  it('ARIA-B-R060 creates exactly one conversation for two concurrent initial reservations with the same ID', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const [left, right] = await Promise.all([
      reserveAriaConversationTurn({ context, clientRequestId, message: 'Création concurrente' }),
      reserveAriaConversationTurn({ context, clientRequestId, message: 'Création concurrente' }),
    ]);
    expect(left.conversationId).toBe(right.conversationId);
    const persisted = await pool.query(
      `SELECT count(DISTINCT "conversationId")::int AS conversations
       FROM aria_conversation_turns WHERE "clientRequestId"=$1`,
      [clientRequestId],
    );
    expect(persisted.rows).toEqual([{ conversations: 1 }]);
  });

  it('D002 ARIA-B-R059 allows one independent request and rejects the other as CONVERSATION_BUSY', async () => {
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

  it('refuses the claim atomically when the recovery watchdog is missing', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context,
      clientRequestId: randomUUID(),
      message: 'Claim sans watchdog',
    });
    await pool.query(
      'DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1',
      [reserved.turnId],
    );

    await expect(claimAriaConversationTurn({
      context,
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_WATCHDOG_MISSING' },
    });
    await expect(pool.query(
      `SELECT t.status::text, t."executionToken", a.status AS assistant_status
       FROM aria_conversation_turns t
       JOIN aria_messages a ON a."turnId" = t.id AND a."turnRole" = 'ASSISTANT'
       WHERE t.id = $1`,
      [reserved.turnId],
    )).resolves.toMatchObject({
      rows: [{ status: 'PENDING', executionToken: null, assistant_status: 'PENDING' }],
    });
  });

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    'refuses the claim atomically when the recovery watchdog is already %s',
    async (watchdogStatus) => {
      const context = await buildAriaConversationContext({
        actor: { userId: ids.studentUser, role: 'ELEVE' },
        courseKey: 'eds-maths-premiere',
      });
      const reserved = await reserveAriaConversationTurn({
        context,
        clientRequestId: randomUUID(),
        message: `Claim avec watchdog ${watchdogStatus}`,
      });
      await pool.query(
        `UPDATE canonical_job_outbox
         SET status = $2::"CanonicalOutboxStatus", "completedAt" = NOW()
         WHERE "aggregateId" = $1`,
        [reserved.turnId, watchdogStatus],
      );

      await expect(claimAriaConversationTurn({
        context,
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
      })).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: 'TURN_WATCHDOG_MISSING' },
      });
      await expect(pool.query(
        `SELECT t.status::text, t."executionToken", a.status AS assistant_status,
                j.status::text AS watchdog_status
         FROM aria_conversation_turns t
         JOIN aria_messages a ON a."turnId" = t.id AND a."turnRole" = 'ASSISTANT'
         JOIN canonical_job_outbox j ON j."aggregateId" = t.id
         WHERE t.id = $1`,
        [reserved.turnId],
      )).resolves.toMatchObject({
        rows: [{
          status: 'PENDING', executionToken: null, assistant_status: 'PENDING',
          watchdog_status: watchdogStatus,
        }],
      });
    },
  );
});
