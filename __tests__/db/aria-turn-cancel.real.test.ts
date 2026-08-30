/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  buildAriaConversationContext,
  cancelAriaConversationTurn,
  checkpointAriaTurnRetrieval,
  claimAriaConversationTurn,
  finalizeAriaConversationTurn,
  reserveAriaConversationTurn,
} from '@/lib/aria/application/conversation/public';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const citation = {
  id: 'hit-1',
  resourceId: 'resource-1', resourceVersionId: 'version-1', contentSha256: 'a'.repeat(64),
  chunkId: 'chunk-1', locator: { page: 2 }, corpusId: 'maths-premiere',
  corpusVersionId: 'corpus-version-1', manifestSha256: 'b'.repeat(64),
  sourceTitle: 'Programme', sourceDocument: 'programme.pdf', sourceLocation: 'Page 2',
  courseKey: 'eds-maths-premiere', provenance: 'OFFICIEL_MEN', snippet: 'Extrait',
};
const evidence = {
  schemaVersion: 1 as const, manifestSha256: citation.manifestSha256, corpusId: citation.corpusId,
  corpusVersionId: citation.corpusVersionId,
  hits: [{ resourceId: citation.resourceId, resourceVersionId: citation.resourceVersionId,
    contentSha256: citation.contentSha256, chunkId: citation.chunkId, locator: citation.locator }],
};

describe('ARIA explicit Turn cancellation on PostgreSQL', () => {
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

  it('cancels PENDING atomically, completes watchdog and never mirrors status onto the user message', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const reserved = await reserveAriaConversationTurn({ context, clientRequestId, message: 'Annule avant claim' });
    const cancelled = await cancelAriaConversationTurn({
      context, turnId: reserved.turnId, clientRequestId,
    });
    expect(cancelled).toMatchObject({ disposition: 'CANCELLED', status: 'CANCELLED' });

    const state = await pool.query(
      `SELECT t.status::text, t."cancellationRequestedByActorId",
              u.status AS user_status, a.status AS assistant_status,
              j.status::text AS watchdog_status
       FROM aria_conversation_turns t
       JOIN aria_messages u ON u."turnId"=t.id AND u."turnRole"='USER'
       JOIN aria_messages a ON a."turnId"=t.id AND a."turnRole"='ASSISTANT'
       JOIN canonical_job_outbox j ON j."aggregateId"=t.id WHERE t.id=$1`,
      [reserved.turnId],
    );
    expect(state.rows).toEqual([expect.objectContaining({
      status: 'CANCELLED', cancellationRequestedByActorId: ids.studentUser,
      user_status: 'COMPLETED', assistant_status: 'CANCELLED', watchdog_status: 'COMPLETED',
    })]);
  });

  it('THREAD_CANCEL_PERSISTED_ERROR', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const reserved = await reserveAriaConversationTurn({ context, clientRequestId, message: 'Annule pendant le stream' });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    await checkpointAriaTurnRetrieval({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      executionToken: claimed.executionToken, ragStatus: 'SUCCESS', retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      retrievalEvidence: evidence, policyVersion: 'aria-retrieval-v1',
    });
    const requested = await cancelAriaConversationTurn({ context, turnId: reserved.turnId, clientRequestId });
    expect(requested.disposition).toBe('CANCELLATION_REQUESTED');
    await finalizeAriaConversationTurn({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
      status: 'CANCELLED', content: 'Sortie partielle', ragStatus: 'SUCCESS',
      retrievalEvidence: evidence, citations: [citation], executionMetadata: { reasonCode: 'USER_CANCELLED' },
    });

    const state = await pool.query(
      `SELECT status::text, "retrievalEvidence", "ragStatus"
       FROM aria_conversation_turns WHERE id=$1`,
      [reserved.turnId],
    );
    expect(state.rows).toEqual([expect.objectContaining({
      status: 'CANCELLED', ragStatus: 'SUCCESS', retrievalEvidence: evidence,
    })]);
    expect(state.rows[0].status).not.toBe('ERROR');
  });
});
