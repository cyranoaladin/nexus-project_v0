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
import { listAriaConversationMessages } from '@/lib/aria/application/history/public';
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
const citation = {
  id: 'hit-1',
  resourceId: '62c11386-3035-543b-a393-f025e5261312',
  resourceVersionId: '1ba3d1cd-8fc0-510a-9bcd-d5807cd4036a',
  contentSha256: '80b8ef1440548faeb5861adc764e6c9740cc2d2c806685287b72eabb5aeeea73',
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
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      turnId: reserved.turnId,
      clientRequestId,
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

    const history = await listAriaConversationMessages({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      conversationId: reserved.conversationId,
      limit: 20,
    });
    expect(history.messages.map(({ role, status }) => ({ role, status }))).toEqual([
      { role: 'user', status: 'COMPLETED' },
      { role: 'assistant', status: 'CANCELLED' },
    ]);
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
    const requested = await cancelAriaConversationTurn({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      turnId: reserved.turnId,
      clientRequestId,
    });
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

  it('fails closed when another authenticated actor tries to cancel the Turn', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const clientRequestId = randomUUID();
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId, message: 'Ne peut être annulé que par son acteur',
    });

    await expect(cancelAriaConversationTurn({
      actor: { userId: randomUUID(), role: 'ELEVE' },
      turnId: reserved.turnId,
      clientRequestId,
    })).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND', status: 404 });
  });

  it('rejects a direct CANCELLED finalization without a persisted cancellation request', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Annulation non demandée',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    await checkpointAriaTurnRetrieval({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      executionToken: claimed.executionToken, ragStatus: 'SUCCESS',
      retrievalPolicy: { kind: 'GROUNDED_REQUIRED' }, retrievalEvidence: evidence,
      policyVersion: 'aria-retrieval-v1',
    });

    await expect(finalizeAriaConversationTurn({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
      status: 'CANCELLED', content: 'Ne doit pas être annulé', ragStatus: 'SUCCESS',
      retrievalEvidence: evidence, citations: [citation], executionMetadata: {},
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_CANCELLATION_NOT_REQUESTED' },
    });
    await expect(pool.query(
      `SELECT status::text, "cancellationRequestedAt", "retrievalEvidence"
       FROM aria_conversation_turns WHERE id = $1`,
      [reserved.turnId],
    )).resolves.toMatchObject({
      rows: [{ status: 'RUNNING', cancellationRequestedAt: null, retrievalEvidence: evidence }],
    });
  });
});
