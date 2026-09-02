/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  buildAriaConversationContext,
  cancelAriaConversationTurn,
  checkpointAriaTurnRetrieval,
  claimAriaConversationTurn,
  reserveAriaConversationTurn,
} from '@/lib/aria/application/conversation/public';
import { drainAriaTurnRecoveryOutbox } from '@/lib/aria/infrastructure/jobs/recovery-worker';
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
const now = new Date('2026-08-30T15:00:00.000Z');
const evidence = {
  schemaVersion: 1 as const,
  manifestSha256: 'b'.repeat(64),
  corpusId: 'maths-premiere',
  corpusVersionId: 'corpus-version-1',
  hits: [{
    resourceId: 'resource-1', resourceVersionId: 'version-1', contentSha256: 'a'.repeat(64),
    chunkId: 'chunk-1', locator: { page: 2 },
  }],
};

describe('ARIA autonomous Turn recovery on PostgreSQL', () => {
  let pool: Pool;
  let ids: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl, max: 6 });
    ids = await seedAriaRealDbFixture(pool);
  });
  afterAll(async () => {
    await cleanupAriaRealDbFixture(pool, ids);
    await pool.end();
  });

  async function reserve(message: string) {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const turn = await reserveAriaConversationTurn({ context, clientRequestId, message, now });
    return { context, clientRequestId, turn };
  }

  it('D011 ARIA-B-R072 recovers stale RUNNING without a subsequent student request and preserves retrieval evidence', async () => {
    const { context, turn } = await reserve('Crash après retrieval');
    const claimed = await claimAriaConversationTurn({
      context, turnId: turn.turnId, conversationId: turn.conversationId, now,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    await checkpointAriaTurnRetrieval({
      turnId: turn.turnId, conversationId: turn.conversationId,
      executionToken: claimed.executionToken, ragStatus: 'SUCCESS',
      retrievalPolicy: { kind: 'GROUNDED_REQUIRED' }, retrievalEvidence: evidence,
      policyVersion: 'aria-retrieval-v1',
    });
    await pool.query(
      `UPDATE aria_conversation_turns
       SET "heartbeatAt"=$2::timestamptz - INTERVAL '2 minutes',
           "leaseExpiresAt"=$2::timestamptz - INTERVAL '1 minute'
       WHERE id=$1`,
      [turn.turnId, now],
    );
    await pool.query(
      `UPDATE canonical_job_outbox SET "availableAt"=$2::timestamptz - INTERVAL '1 minute'
       WHERE "aggregateId"=$1`,
      [turn.turnId, now],
    );

    await expect(drainAriaTurnRecoveryOutbox({ owner: 'worker-a', now })).resolves.toMatchObject({
      claimed: 1, recovered: 1,
    });
    const state = await pool.query(
      `SELECT t.status::text, t."retrievalEvidence", t."executionMetadata",
              u.status AS user_status, a.status AS assistant_status, j.status::text AS job_status
       FROM aria_conversation_turns t
       JOIN aria_messages u ON u."turnId"=t.id AND u."turnRole"='USER'
       JOIN aria_messages a ON a."turnId"=t.id AND a."turnRole"='ASSISTANT'
       JOIN canonical_job_outbox j ON j."aggregateId"=t.id WHERE t.id=$1`,
      [turn.turnId],
    );
    expect(state.rows).toEqual([expect.objectContaining({
      status: 'ERROR', retrievalEvidence: evidence,
      executionMetadata: expect.objectContaining({ reasonCode: 'EXECUTION_INTERRUPTED' }),
      user_status: 'COMPLETED', assistant_status: 'ERROR', job_status: 'COMPLETED',
    })]);
  });

  it('D012 ARIA-B-R073 recovers a stale PENDING reservation without a subsequent request', async () => {
    const { turn } = await reserve('Crash avant claim');
    await pool.query(
      `UPDATE canonical_job_outbox SET "availableAt"=$2::timestamptz - INTERVAL '1 minute'
       WHERE "aggregateId"=$1`,
      [turn.turnId, now],
    );
    await drainAriaTurnRecoveryOutbox({ owner: 'worker-pending', now });
    const state = await pool.query(
      `SELECT status::text, "executionMetadata" FROM aria_conversation_turns WHERE id=$1`,
      [turn.turnId],
    );
    expect(state.rows).toEqual([expect.objectContaining({
      status: 'ERROR',
      executionMetadata: expect.objectContaining({ reasonCode: 'EXECUTION_INTERRUPTED' }),
    })]);
  });

  it('ARIA-B-R074 reschedules a watchdog when a concurrent heartbeat is still fresh', async () => {
    const { context, turn } = await reserve('Heartbeat récent');
    await claimAriaConversationTurn({
      context, turnId: turn.turnId, conversationId: turn.conversationId, now,
    });
    const freshLease = new Date(now.getTime() + 30_000);
    await pool.query(
      `UPDATE aria_conversation_turns SET "heartbeatAt"=$2, "leaseExpiresAt"=$3 WHERE id=$1`,
      [turn.turnId, now, freshLease],
    );
    await pool.query(
      `UPDATE canonical_job_outbox SET "availableAt"=$2::timestamptz - INTERVAL '1 second'
       WHERE "aggregateId"=$1`,
      [turn.turnId, now],
    );

    await expect(drainAriaTurnRecoveryOutbox({ owner: 'worker-fresh', now })).resolves.toMatchObject({
      claimed: 1, rescheduled: 1, recovered: 0,
    });
    const state = await pool.query(
      `SELECT t.status::text, j.status::text AS job_status, j."availableAt"
       FROM aria_conversation_turns t JOIN canonical_job_outbox j ON j."aggregateId"=t.id
       WHERE t.id=$1`,
      [turn.turnId],
    );
    expect(state.rows[0]).toMatchObject({ status: 'RUNNING', job_status: 'PENDING' });
    expect(state.rows[0].availableAt).toEqual(freshLease);
  });

  it('makes a persisted cancellation win recovery over ERROR', async () => {
    const { context, clientRequestId, turn } = await reserve('Annulation inter-process');
    await claimAriaConversationTurn({
      context, turnId: turn.turnId, conversationId: turn.conversationId, now,
    });
    await cancelAriaConversationTurn({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      turnId: turn.turnId,
      clientRequestId,
      now,
    });
    await pool.query(
      `UPDATE aria_conversation_turns
       SET "heartbeatAt"=$2::timestamptz - INTERVAL '2 minutes',
           "leaseExpiresAt"=$2::timestamptz - INTERVAL '1 minute' WHERE id=$1`,
      [turn.turnId, now],
    );
    await pool.query(
      `UPDATE canonical_job_outbox SET "availableAt"=$2::timestamptz - INTERVAL '1 minute'
       WHERE "aggregateId"=$1`,
      [turn.turnId, now],
    );

    await drainAriaTurnRecoveryOutbox({ owner: 'worker-cancel', now });
    const state = await pool.query('SELECT status::text FROM aria_conversation_turns WHERE id=$1', [turn.turnId]);
    expect(state.rows).toEqual([{ status: 'CANCELLED' }]);
  });

  it('recovers a PENDING row with a persisted cancellation request as CANCELLED', async () => {
    const { turn } = await reserve('Annulation avant claim interrompue');
    await pool.query(
      `UPDATE aria_conversation_turns
       SET "cancellationRequestedAt"=$2, "cancellationRequestedByActorId"=$3
       WHERE id=$1`,
      [turn.turnId, now, ids.studentUser],
    );
    await pool.query(
      `UPDATE canonical_job_outbox SET "availableAt"=$2::timestamptz - INTERVAL '1 minute'
       WHERE "aggregateId"=$1`,
      [turn.turnId, now],
    );
    await drainAriaTurnRecoveryOutbox({ owner: 'worker-pending-cancel', now });
    const state = await pool.query(
      `SELECT t.status::text, a.status AS assistant_status
       FROM aria_conversation_turns t JOIN aria_messages a
       ON a."turnId"=t.id AND a."turnRole"='ASSISTANT' WHERE t.id=$1`,
      [turn.turnId],
    );
    expect(state.rows).toEqual([{ status: 'CANCELLED', assistant_status: 'CANCELLED' }]);
  });

  it('D013 ARIA-B-R075 keeps a malformed active watchdog retryable even beyond an alert threshold', async () => {
    const { turn } = await reserve('Payload corrompu');
    await pool.query(
      `UPDATE canonical_job_outbox
       SET payload='{"bad":true}'::jsonb, "attemptCount"=100,
           "availableAt"=$2::timestamptz - INTERVAL '1 minute'
       WHERE "aggregateId"=$1`,
      [turn.turnId, now],
    );
    await expect(drainAriaTurnRecoveryOutbox({ owner: 'worker-retry', now })).resolves.toMatchObject({
      claimed: 1, retried: 1,
    });
    const job = await pool.query(
      `SELECT status::text, "attemptCount", "leaseOwner" FROM canonical_job_outbox WHERE "aggregateId"=$1`,
      [turn.turnId],
    );
    expect(job.rows).toEqual([expect.objectContaining({
      status: 'RETRY_SCHEDULED', attemptCount: 101, leaseOwner: null,
    })]);
  });
});
