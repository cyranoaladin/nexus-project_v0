/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  buildAriaConversationContext,
  checkpointAriaTurnRetrieval,
  claimAriaConversationTurn,
  finalizeAriaConversationTurn,
  reserveAriaConversationTurn,
} from '@/lib/aria/application/conversation/public';
import { prismaAriaConversationRepository } from '@/lib/aria/infrastructure/prisma/conversation-repository';
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

describe('ARIA Turn TX2 finalization on PostgreSQL', () => {
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

  it('atomically finalizes RUNNING→COMPLETED, citations and watchdog while user stays COMPLETED', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Finalise ce Turn',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    await checkpointAriaTurnRetrieval({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      executionToken: claimed.executionToken, ragStatus: 'SUCCESS', retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      retrievalEvidence: evidence, policyVersion: 'aria-retrieval-v1',
    });
    await finalizeAriaConversationTurn({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
      status: 'COMPLETED', content: 'Réponse finale', ragStatus: 'SUCCESS',
      retrievalEvidence: evidence, citations: [citation], executionMetadata: { latencyMs: 12 },
    });

    const state = await pool.query(
      `SELECT t.status::text, t."retrievalEvidence", t."ragStatus",
              u.status AS user_status, a.status AS assistant_status, a.content,
              j.status::text AS watchdog_status,
              (SELECT count(*)::int FROM aria_message_citations c WHERE c."messageId" = a.id) AS citations
       FROM aria_conversation_turns t
       JOIN aria_messages u ON u."turnId" = t.id AND u."turnRole" = 'USER'
       JOIN aria_messages a ON a."turnId" = t.id AND a."turnRole" = 'ASSISTANT'
       JOIN canonical_job_outbox j ON j."aggregateId" = t.id
       WHERE t.id = $1`,
      [reserved.turnId],
    );
    expect(state.rows).toEqual([expect.objectContaining({
      status: 'COMPLETED', ragStatus: 'SUCCESS', user_status: 'COMPLETED',
      assistant_status: 'COMPLETED', content: 'Réponse finale', watchdog_status: 'COMPLETED', citations: 1,
    })]);
    expect(state.rows[0].retrievalEvidence).toEqual(evidence);
  });

  it('rolls back all TX2 writes when citation persistence fails and leaves the Turn recoverable', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'TX2 rollback',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    await checkpointAriaTurnRetrieval({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      executionToken: claimed.executionToken, ragStatus: 'SUCCESS', retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      retrievalEvidence: evidence, policyVersion: 'aria-retrieval-v1',
    });
    await pool.query(`
      CREATE OR REPLACE FUNCTION aria_test_reject_citation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'ARIA_TEST_CITATION_FAILURE'; END $$;
      CREATE TRIGGER aria_test_reject_citation BEFORE INSERT ON aria_message_citations
      FOR EACH ROW EXECUTE FUNCTION aria_test_reject_citation();
    `);
    try {
      await expect(finalizeAriaConversationTurn({
        turnId: reserved.turnId, conversationId: reserved.conversationId,
        assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
        status: 'COMPLETED', content: 'Ne doit pas rester', ragStatus: 'SUCCESS',
        retrievalEvidence: evidence, citations: [citation], executionMetadata: {},
      })).rejects.toThrow('ARIA_TEST_CITATION_FAILURE');
    } finally {
      await pool.query(`
        DROP TRIGGER aria_test_reject_citation ON aria_message_citations;
        DROP FUNCTION aria_test_reject_citation();
      `);
    }
    const state = await pool.query(
      `SELECT t.status::text AS turn_status, a.status AS assistant_status,
              a.content, j.status::text AS watchdog_status
       FROM aria_conversation_turns t
       JOIN aria_messages a ON a."turnId" = t.id AND a."turnRole" = 'ASSISTANT'
       JOIN canonical_job_outbox j ON j."aggregateId" = t.id WHERE t.id = $1`,
      [reserved.turnId],
    );
    expect(state.rows).toEqual([{
      turn_status: 'RUNNING', assistant_status: 'STREAMING',
      content: '', watchdog_status: 'PENDING',
    }]);
  });

  it('keeps partial output and retrieval provenance auditable on ERROR', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Erreur après retrieval',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    await checkpointAriaTurnRetrieval({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      executionToken: claimed.executionToken, ragStatus: 'SUCCESS', retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      retrievalEvidence: evidence, policyVersion: 'aria-retrieval-v1',
    });
    await finalizeAriaConversationTurn({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
      status: 'ERROR', content: 'Sortie partielle avant erreur', ragStatus: 'SUCCESS',
      retrievalEvidence: evidence, citations: [citation], executionMetadata: { reasonCode: 'MODEL_UNAVAILABLE' },
    });
    const state = await pool.query(
      `SELECT t.status::text, t."retrievalEvidence", a.status AS assistant_status, a.content
       FROM aria_conversation_turns t JOIN aria_messages a
       ON a."turnId"=t.id AND a."turnRole"='ASSISTANT' WHERE t.id=$1`,
      [reserved.turnId],
    );
    expect(state.rows).toEqual([expect.objectContaining({
      status: 'ERROR', retrievalEvidence: evidence, assistant_status: 'ERROR',
      content: 'Sortie partielle avant erreur',
    })]);
    await expect(prismaAriaConversationRepository.loadTurnResult({
      turnId: reserved.turnId,
      actorUserId: ids.studentUser,
      subjectStudentId: ids.student,
    })).resolves.toMatchObject({
      status: 'ERROR',
      ragStatus: 'SUCCESS',
      failureCode: 'MODEL_UNAVAILABLE',
      content: 'Sortie partielle avant erreur',
    });
  });

  it('rejects a stale execution token without mutating the Turn or assistant message', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Token périmé',
    });
    await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    await expect(finalizeAriaConversationTurn({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: 'stale-token',
      status: 'ERROR', content: 'Ne doit pas être écrit', ragStatus: 'NOT_CONFIGURED',
      retrievalEvidence: { schemaVersion: 1, hits: [] }, citations: [], executionMetadata: {},
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_FINALIZATION_FENCE_LOST' },
    });
    const state = await pool.query(
      `SELECT t.status::text, a.status AS assistant_status, a.content
       FROM aria_conversation_turns t JOIN aria_messages a
       ON a."turnId"=t.id AND a."turnRole"='ASSISTANT' WHERE t.id=$1`,
      [reserved.turnId],
    );
    expect(state.rows).toEqual([{ status: 'RUNNING', assistant_status: 'STREAMING', content: '' }]);
  });
});
