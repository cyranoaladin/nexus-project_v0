/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  buildAriaConversationContext,
  cancelAriaConversationTurn,
  claimAriaConversationTurn,
  heartbeatAriaConversationTurn,
  reserveAriaConversationTurn,
} from '@/lib/aria/application/conversation/public';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

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

describe('ARIA Turn heartbeat on PostgreSQL', () => {
  let pool: Pool;
  let ids: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    ids = await seedAriaRealDbFixture(pool);
  });

  afterAll(async () => {
    await cleanupAriaRealDbFixture(pool, ids);
    await pool.end();
  });

  async function reserveAndClaim(message: string) {
    const now = new Date('2026-08-31T08:00:00.000Z');
    const clientRequestId = randomUUID();
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context,
      clientRequestId,
      message,
      now,
    });
    const claimed = await claimAriaConversationTurn({
      context,
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      now,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    return { context, reserved, claimed, clientRequestId };
  }

  async function readLeaseState(turnId: string) {
    const result = await pool.query(
      `SELECT t.status::text,
              t."heartbeatAt" AS "heartbeatAt",
              t."leaseExpiresAt" AS "turnLeaseExpiresAt",
              j.status::text AS "watchdogStatus",
              j."availableAt" AS "watchdogAvailableAt",
              j."leaseOwner" AS "watchdogLeaseOwner",
              j."leaseExpiresAt" AS "watchdogLeaseExpiresAt",
              j."lastError" AS "watchdogLastError"
       FROM aria_conversation_turns t
       LEFT JOIN canonical_job_outbox j
         ON j."aggregateId"=t.id
        AND j."idempotencyKey"=('aria-turn-watchdog:' || t.id)
       WHERE t.id=$1`,
      [turnId],
    );
    return result.rows[0];
  }

  async function readLeaseMatches(
    turnId: string,
    heartbeatAt: Date,
    leaseExpiresAt: Date,
  ) {
    const result = await pool.query(
      `SELECT t."heartbeatAt"=$2::timestamp AS "heartbeatMatches",
              t."leaseExpiresAt"=$3::timestamp AS "turnLeaseMatches",
              j."availableAt"=$3::timestamp AS "watchdogLeaseMatches"
       FROM aria_conversation_turns t
       JOIN canonical_job_outbox j ON j."aggregateId"=t.id
       WHERE t.id=$1`,
      [turnId, heartbeatAt.toISOString(), leaseExpiresAt.toISOString()],
    );
    return result.rows[0];
  }

  it('HEARTBEAT_RENEWS_TURN_AND_WATCHDOG_TO_THE_SAME_LEASE', async () => {
    const { reserved, claimed } = await reserveAndClaim('Renouvelle le lease');
    const now = new Date('2026-08-31T08:00:10.000Z');
    const leaseExpiresAt = new Date('2026-08-31T08:00:40.000Z');

    await expect(heartbeatAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken!,
      now,
      leaseExpiresAt,
    })).resolves.toEqual({ disposition: 'RENEWED' });

    const state = await readLeaseState(reserved.turnId);
    expect(state).toMatchObject({
      status: 'RUNNING',
      watchdogStatus: 'PENDING',
      watchdogLeaseOwner: null,
      watchdogLeaseExpiresAt: null,
      watchdogLastError: null,
    });
    await expect(readLeaseMatches(reserved.turnId, now, leaseExpiresAt)).resolves.toEqual({
      heartbeatMatches: true,
      turnLeaseMatches: true,
      watchdogLeaseMatches: true,
    });
  });

  it('HEARTBEAT_RETURNS_LEASE_LOST_WITHOUT_WRITES_FOR_UNKNOWN_TURN', async () => {
    await expect(heartbeatAriaConversationTurn({
      turnId: randomUUID(),
      conversationId: randomUUID(),
      executionToken: randomUUID(),
      now: new Date('2026-08-31T08:01:00.000Z'),
      leaseExpiresAt: new Date('2026-08-31T08:01:30.000Z'),
    })).resolves.toEqual({ disposition: 'LEASE_LOST' });
  });

  it('HEARTBEAT_RETURNS_LEASE_LOST_FOR_WRONG_CONVERSATION', async () => {
    const { reserved, claimed } = await reserveAndClaim('Mauvaise conversation');
    const before = await readLeaseState(reserved.turnId);
    await expect(heartbeatAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: randomUUID(),
      executionToken: claimed.executionToken!,
      now: new Date('2026-08-31T08:02:00.000Z'),
      leaseExpiresAt: new Date('2026-08-31T08:02:30.000Z'),
    })).resolves.toEqual({ disposition: 'LEASE_LOST' });
    expect(await readLeaseState(reserved.turnId)).toEqual(before);
  });

  it('HEARTBEAT_RETURNS_LEASE_LOST_FOR_STALE_EXECUTION_TOKEN', async () => {
    const { reserved } = await reserveAndClaim('Jeton périmé');
    const before = await readLeaseState(reserved.turnId);
    await expect(heartbeatAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: randomUUID(),
      now: new Date('2026-08-31T08:03:00.000Z'),
      leaseExpiresAt: new Date('2026-08-31T08:03:30.000Z'),
    })).resolves.toEqual({ disposition: 'LEASE_LOST' });
    expect(await readLeaseState(reserved.turnId)).toEqual(before);
  });

  it('HEARTBEAT_RETURNS_LEASE_LOST_FOR_TERMINAL_TURN', async () => {
    const { reserved, claimed } = await reserveAndClaim('Turn terminal');
    await pool.query(
      `UPDATE aria_conversation_turns
       SET status='ERROR', "completedAt"='2026-08-31T08:04:00.000Z'::timestamptz
       WHERE id=$1`,
      [reserved.turnId],
    );
    const before = await readLeaseState(reserved.turnId);
    await expect(heartbeatAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken!,
      now: new Date('2026-08-31T08:04:10.000Z'),
      leaseExpiresAt: new Date('2026-08-31T08:04:40.000Z'),
    })).resolves.toEqual({ disposition: 'LEASE_LOST' });
    expect(await readLeaseState(reserved.turnId)).toEqual(before);
  });

  it('HEARTBEAT_OBSERVES_PERSISTED_CANCELLATION_WITHOUT_RENEWING', async () => {
    const { reserved, claimed, clientRequestId } = await reserveAndClaim('Annulation observée');
    await cancelAriaConversationTurn({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      turnId: reserved.turnId,
      clientRequestId,
      now: new Date('2026-08-31T08:05:00.000Z'),
    });
    const before = await readLeaseState(reserved.turnId);
    await expect(heartbeatAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken!,
      now: new Date('2026-08-31T08:05:10.000Z'),
      leaseExpiresAt: new Date('2026-08-31T08:05:40.000Z'),
    })).resolves.toEqual({ disposition: 'CANCELLATION_REQUESTED' });
    expect(await readLeaseState(reserved.turnId)).toEqual(before);
  });

  it('HEARTBEAT_FAILS_CLOSED_WHEN_WATCHDOG_IS_MISSING', async () => {
    const { reserved, claimed } = await reserveAndClaim('Watchdog absent');
    await pool.query('DELETE FROM canonical_job_outbox WHERE "aggregateId"=$1', [reserved.turnId]);
    const before = await readLeaseState(reserved.turnId);
    await expect(heartbeatAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken!,
      now: new Date('2026-08-31T08:06:10.000Z'),
      leaseExpiresAt: new Date('2026-08-31T08:06:40.000Z'),
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_WATCHDOG_UNAVAILABLE' },
    });
    expect(await readLeaseState(reserved.turnId)).toEqual(before);
  });

  it.each(['COMPLETED', 'CANCELLED', 'FAILED', 'AMBIGUOUS', 'FAILED_FINAL'] as const)(
    'HEARTBEAT_FAILS_CLOSED_WHEN_WATCHDOG_IS_%s',
    async (watchdogStatus) => {
      const { reserved, claimed } = await reserveAndClaim(`Watchdog terminal ${watchdogStatus}`);
      await pool.query(
        `UPDATE canonical_job_outbox
         SET status=$2::"CanonicalOutboxStatus", "lastError"='terminal audit'
         WHERE "aggregateId"=$1`,
        [reserved.turnId, watchdogStatus],
      );
      const before = await readLeaseState(reserved.turnId);
      await expect(heartbeatAriaConversationTurn({
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
        executionToken: claimed.executionToken!,
        now: new Date('2026-08-31T08:07:10.000Z'),
        leaseExpiresAt: new Date('2026-08-31T08:07:40.000Z'),
      })).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: 'TURN_WATCHDOG_UNAVAILABLE' },
      });
      expect(await readLeaseState(reserved.turnId)).toEqual(before);
    },
  );

  it.each(['LEASED', 'RETRY_SCHEDULED'] as const)(
    'HEARTBEAT_RECLAIMS_A_%s_ACTIVE_WATCHDOG',
    async (watchdogStatus) => {
      const { reserved, claimed } = await reserveAndClaim(`Watchdog actif ${watchdogStatus}`);
      await pool.query(
        `UPDATE canonical_job_outbox
         SET status=$2::"CanonicalOutboxStatus", "leaseOwner"='old-worker',
             "leaseExpiresAt"='2026-08-31T08:08:00.000Z'::timestamptz,
             "lastError"='retryable'
         WHERE "aggregateId"=$1`,
        [reserved.turnId, watchdogStatus],
      );
      const now = new Date('2026-08-31T08:08:10.000Z');
      const leaseExpiresAt = new Date('2026-08-31T08:08:40.000Z');
      await expect(heartbeatAriaConversationTurn({
        turnId: reserved.turnId,
        conversationId: reserved.conversationId,
        executionToken: claimed.executionToken!,
        now,
        leaseExpiresAt,
      })).resolves.toEqual({ disposition: 'RENEWED' });
      expect(await readLeaseState(reserved.turnId)).toMatchObject({
        watchdogStatus: 'PENDING',
        watchdogLeaseOwner: null,
        watchdogLeaseExpiresAt: null,
        watchdogLastError: null,
      });
      await expect(readLeaseMatches(reserved.turnId, now, leaseExpiresAt)).resolves.toEqual({
        heartbeatMatches: true,
        turnLeaseMatches: true,
        watchdogLeaseMatches: true,
      });
    },
  );
});
