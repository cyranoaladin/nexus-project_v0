/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  buildAriaConversationContext,
  cancelAriaConversationTurn,
  claimAriaConversationTurn,
  finalizeAriaConversationTurn,
  heartbeatAriaConversationTurn,
  reserveAriaConversationTurn,
} from '@/lib/aria/application/conversation/public';
import { drainAriaTurnRecoveryOutbox } from '@/lib/aria/infrastructure/jobs/recovery-worker';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('ARIA terminal transition races on PostgreSQL', () => {
  let pool: Pool;
  let ids: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl, max: 4 });
    ids = await seedAriaRealDbFixture(pool);
  });
  afterAll(async () => {
    await cleanupAriaRealDbFixture(pool, ids);
    await pool.end();
  });

  it('lets exactly one competing finalizer commit', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Finalizers concurrents',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    const base = {
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
      ragStatus: 'NOT_CONFIGURED' as const,
      retrievalEvidence: { schemaVersion: 1 as const, hits: [] }, citations: [], executionMetadata: {},
    };
    const settled = await Promise.allSettled([
      finalizeAriaConversationTurn({ ...base, status: 'COMPLETED', content: 'Winner A' }),
      finalizeAriaConversationTurn({ ...base, status: 'ERROR', content: 'Winner B' }),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const persisted = await pool.query(
      `SELECT t.status::text, a.content
       FROM aria_conversation_turns t JOIN aria_messages a
       ON a."turnId"=t.id AND a."turnRole"='ASSISTANT' WHERE t.id=$1`,
      [reserved.turnId],
    );
    expect(['COMPLETED', 'ERROR']).toContain(persisted.rows[0].status);
    expect(['Winner A', 'Winner B']).toContain(persisted.rows[0].content);
  });

  it('fences ERROR finalization after a concurrent cancellation request', async () => {
    const clientRequestId = randomUUID();
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId, message: 'Course annulation et erreur',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    const finalization = {
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId,
      executionToken: claimed.executionToken,
      status: 'ERROR' as const,
      content: 'Sortie partielle',
      ragStatus: 'NOT_CONFIGURED' as const,
      retrievalEvidence: { schemaVersion: 1 as const, hits: [] },
      citations: [],
      executionMetadata: {},
    };

    const [cancelResult, errorResult] = await Promise.allSettled([
      cancelAriaConversationTurn({ context, turnId: reserved.turnId, clientRequestId }),
      finalizeAriaConversationTurn(finalization),
    ]);
    expect(cancelResult.status).toBe('fulfilled');

    if (
      cancelResult.status === 'fulfilled'
      && cancelResult.value.disposition === 'CANCELLATION_REQUESTED'
    ) {
      expect(errorResult.status).toBe('rejected');
      await finalizeAriaConversationTurn({
        ...finalization,
        status: 'CANCELLED',
        executionMetadata: { cancellationWonRace: true },
      });
    } else {
      expect(errorResult.status).toBe('fulfilled');
      if (cancelResult.status === 'fulfilled') {
        expect(cancelResult.value).toMatchObject({
          disposition: 'TERMINAL_REPLAY',
          status: 'ERROR',
        });
      }
    }

    const persisted = await pool.query(
      `SELECT t.status::text, u.status AS "userStatus"
       FROM aria_conversation_turns t
       JOIN aria_messages u ON u."turnId"=t.id AND u."turnRole"='USER'
       WHERE t.id=$1`,
      [reserved.turnId],
    );
    expect(['CANCELLED', 'ERROR']).toContain(persisted.rows[0].status);
    expect(persisted.rows[0].userStatus).toBe('COMPLETED');
  });

  it('allows only one of two recovery workers to own a stale watchdog', async () => {
    const staleNow = new Date('2026-08-30T18:00:00.000Z');
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Deux workers', now: staleNow,
    });
    await pool.query(
      `UPDATE canonical_job_outbox SET "availableAt"=$2::timestamptz - INTERVAL '1 minute'
       WHERE "aggregateId"=$1`,
      [reserved.turnId, staleNow],
    );

    const results = await Promise.all([
      drainAriaTurnRecoveryOutbox({ owner: 'race-worker-a', now: staleNow }),
      drainAriaTurnRecoveryOutbox({ owner: 'race-worker-b', now: staleNow }),
    ]);
    expect(results.reduce((total, result) => total + result.claimed, 0)).toBe(1);
    expect(results.reduce((total, result) => total + result.recovered, 0)).toBe(1);
    const state = await pool.query(
      `SELECT t.status::text, j.status::text AS job_status
       FROM aria_conversation_turns t JOIN canonical_job_outbox j ON j."aggregateId"=t.id
       WHERE t.id=$1`,
      [reserved.turnId],
    );
    expect(state.rows).toEqual([{ status: 'ERROR', job_status: 'COMPLETED' }]);
  });

  it('resolves a heartbeat versus recovery-worker race without deadlock or split ownership', async () => {
    const raceNow = new Date('2026-08-30T19:00:00.000Z');
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Heartbeat contre worker', now: raceNow,
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId, now: raceNow,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    await pool.query(
      `UPDATE aria_conversation_turns
       SET "heartbeatAt"=$2::timestamptz - INTERVAL '2 minutes',
           "leaseExpiresAt"=$2::timestamptz - INTERVAL '1 minute' WHERE id=$1`,
      [reserved.turnId, raceNow],
    );
    await pool.query(
      `UPDATE canonical_job_outbox SET "availableAt"=$2::timestamptz - INTERVAL '1 minute'
       WHERE "aggregateId"=$1`,
      [reserved.turnId, raceNow],
    );
    const renewedUntil = new Date(raceNow.getTime() + 30_000);
    const [heartbeat, recovery] = await Promise.all([
      heartbeatAriaConversationTurn({
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
        executionToken: claimed.executionToken,
        now: raceNow,
        leaseExpiresAt: renewedUntil,
      }),
      drainAriaTurnRecoveryOutbox({ owner: 'heartbeat-race-worker', now: raceNow }),
    ]);
    const state = await pool.query(
      `SELECT t.status::text, j.status::text AS job_status, j."leaseOwner"
       FROM aria_conversation_turns t JOIN canonical_job_outbox j ON j."aggregateId"=t.id
       WHERE t.id=$1`,
      [reserved.turnId],
    );
    if (heartbeat.disposition === 'RENEWED') {
      expect(state.rows).toEqual([{ status: 'RUNNING', job_status: 'PENDING', leaseOwner: null }]);
      expect(recovery.recovered).toBe(0);
    } else {
      expect(heartbeat.disposition).toBe('LEASE_LOST');
      expect(state.rows).toEqual([{ status: 'ERROR', job_status: 'COMPLETED', leaseOwner: null }]);
      expect(recovery.recovered).toBe(1);
    }
  });
});
