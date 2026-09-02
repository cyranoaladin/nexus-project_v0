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
  resourceId: '62c11386-3035-543b-a393-f025e5261312',
  resourceVersionId: '1ba3d1cd-8fc0-510a-9bcd-d5807cd4036a',
  contentSha256: '80b8ef1440548faeb5861adc764e6c9740cc2d2c806685287b72eabb5aeeea73',
  chunkId: 'chunk-1', locator: { page: 2 }, corpusId: 'maths-premiere',
  corpusVersionId: 'corpus-version-1', manifestSha256: 'b'.repeat(64),
  sourceTitle: 'Faux ministère', sourceDocument: '/srv/private/student@example.test.pdf',
  sourceLocation: '/home/private/programme.pdf', courseKey: 'eds-maths-premiere',
  provenance: 'FORGED_OFFICIAL', url: 'https://attacker.example.test/programme.pdf', snippet: 'Extrait',
};
const evidence = {
  schemaVersion: 1 as const, manifestSha256: citation.manifestSha256, corpusId: citation.corpusId,
  corpusVersionId: citation.corpusVersionId,
  hits: [{ resourceId: citation.resourceId, resourceVersionId: citation.resourceVersionId,
    contentSha256: citation.contentSha256, chunkId: citation.chunkId, locator: citation.locator }],
};
const conflictingCitation = {
  ...citation,
  id: 'hit-2',
  chunkId: 'chunk-2',
  locator: { page: 3 },
};
const conflictingEvidence = {
  ...evidence,
  hits: [{
    resourceId: conflictingCitation.resourceId,
    resourceVersionId: conflictingCitation.resourceVersionId,
    contentSha256: conflictingCitation.contentSha256,
    chunkId: conflictingCitation.chunkId,
    locator: conflictingCitation.locator,
  }],
};
const crossCourseCitation = {
  ...citation,
  resourceId: '0af21d67-1c3b-5a8a-8eed-38d23ecb1600',
  resourceVersionId: '73f3c1b9-a95f-586f-bfb6-00f2ecf68e82',
  contentSha256: '7ca9a32e1823be6c1120cb0417324c3cb01688d1d194c7614a88ea851ccc60b0',
  courseKey: 'eds-nsi-premiere',
};
const crossCourseEvidence = {
  ...evidence,
  hits: [{
    resourceId: crossCourseCitation.resourceId,
    resourceVersionId: crossCourseCitation.resourceVersionId,
    contentSha256: crossCourseCitation.contentSha256,
    chunkId: crossCourseCitation.chunkId,
    locator: crossCourseCitation.locator,
  }],
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

  async function reserveAndClaim(message: string) {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context,
      clientRequestId: randomUUID(),
      message,
    });
    const claimed = await claimAriaConversationTurn({
      context,
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    return { context, reserved, claimed };
  }

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
    await expect(pool.query(
      `SELECT "sourceTitle", "sourceDocument", "sourceLocation", provenance, url
       FROM aria_message_citations WHERE "messageId" = $1`,
      [reserved.assistantMessageId],
    )).resolves.toMatchObject({
      rows: [{
        sourceTitle: 'Programme officiel — Spécialité Mathématiques Première (2019)',
        sourceDocument: 'BO spécial n° 1 du 22 janvier 2019 — NOR MENE1901632A',
        sourceLocation: 'Page 2',
        provenance: 'OFFICIEL_MEN',
        url: 'https://www.education.gouv.fr/bo/19/Special1/MENE1901632A.htm',
      }],
    });
    const history = await listAriaConversationMessages({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      conversationId: reserved.conversationId,
      limit: 20,
    });
    expect(history.messages.find(({ messageId }) => messageId === reserved.assistantMessageId))
      .toMatchObject({
        citations: [{
          traceability: 'CANONICAL',
          resourceId: citation.resourceId,
          resourceVersionId: citation.resourceVersionId,
          contentSha256: citation.contentSha256,
          chunkId: citation.chunkId,
          sourceTitle: 'Programme officiel — Spécialité Mathématiques Première (2019)',
          sourceDocument: 'BO spécial n° 1 du 22 janvier 2019 — NOR MENE1901632A',
          sourceLocation: 'Page 2',
          provenance: 'OFFICIEL_MEN',
        }],
      });
  });

  it('D005 ARIA-B-R062 rolls back all TX2 writes when citation persistence fails and leaves the Turn recoverable', async () => {
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

  it('rejects matched cross-course citation evidence and leaves the Maths Turn RUNNING', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Citation NSI interdite',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    await checkpointAriaTurnRetrieval({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      executionToken: claimed.executionToken, ragStatus: 'SUCCESS',
      retrievalPolicy: { kind: 'GROUNDED_REQUIRED' }, retrievalEvidence: crossCourseEvidence,
      policyVersion: 'aria-retrieval-v1',
    });

    await expect(finalizeAriaConversationTurn({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
      status: 'COMPLETED', content: 'Ne doit pas persister', ragStatus: 'SUCCESS',
      retrievalEvidence: crossCourseEvidence, citations: [crossCourseCitation], executionMetadata: {},
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_CITATION_COURSE_MISMATCH' },
    });
    await expect(pool.query(
      `SELECT t.status::text, a.content,
              (SELECT count(*)::int FROM aria_message_citations c WHERE c."messageId" = a.id) AS citations
       FROM aria_conversation_turns t
       JOIN aria_messages a ON a."turnId" = t.id AND a."turnRole" = 'ASSISTANT'
       WHERE t.id = $1`,
      [reserved.turnId],
    )).resolves.toMatchObject({
      rows: [{ status: 'RUNNING', content: '', citations: 0 }],
    });
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

  it('LOAD_TURN_RESULT_REJECTS_UNKNOWN_PERSISTED_RAG_STATUS', async () => {
    const { reserved, claimed } = await reserveAndClaim('Replay au statut RAG corrompu');
    await checkpointAriaTurnRetrieval({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken!,
      ragStatus: 'NOT_CONFIGURED',
      retrievalPolicy: { kind: 'GENERAL_CHAT' },
      retrievalEvidence: { schemaVersion: 1, hits: [] },
      policyVersion: 'aria-retrieval-v1',
    });
    await finalizeAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId,
      executionToken: claimed.executionToken!,
      status: 'COMPLETED',
      content: 'Réponse terminale',
      ragStatus: 'NOT_CONFIGURED',
      retrievalEvidence: { schemaVersion: 1, hits: [] },
      citations: [],
      executionMetadata: {},
    });
    await pool.query(
      'UPDATE aria_conversation_turns SET "ragStatus"=$2 WHERE id=$1',
      [reserved.turnId, 'PRIVATE_PROVIDER_DETAIL'],
    );

    await expect(prismaAriaConversationRepository.loadTurnResult({
      turnId: reserved.turnId,
      actorUserId: ids.studentUser,
      subjectStudentId: ids.student,
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'PERSISTED_TURN_RESULT_INVALID' },
    });
  });

  it('fails closed instead of fabricating canonical identity for a legacy citation replay', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Replay citation legacy',
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
    await finalizeAriaConversationTurn({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
      status: 'COMPLETED', content: 'Réponse historique', ragStatus: 'SUCCESS',
      retrievalEvidence: evidence, citations: [citation], executionMetadata: {},
    });
    await pool.query(
      `UPDATE aria_message_citations
       SET "resourceId" = NULL, "resourceVersionId" = NULL, "contentSha256" = NULL,
           "chunkId" = NULL, locator = NULL, "corpusId" = NULL,
           "corpusVersionId" = NULL, "manifestSha256" = NULL
       WHERE "messageId" = $1`,
      [reserved.assistantMessageId],
    );

    await expect(prismaAriaConversationRepository.loadTurnResult({
      turnId: reserved.turnId,
      actorUserId: ids.studentUser,
      subjectStudentId: ids.student,
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'LEGACY_CITATION_IDENTITY_UNRESOLVED' },
    });
    await expect(listAriaConversationMessages({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      conversationId: reserved.conversationId,
      limit: 20,
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID' },
    });
    await expect(pool.query(
      'SELECT count(*)::int AS count FROM aria_message_citations WHERE "messageId" = $1',
      [reserved.assistantMessageId],
    )).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it('fails closed when a persisted citation is detached from the Turn retrieval evidence', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Replay citation détachée',
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
    await finalizeAriaConversationTurn({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
      status: 'COMPLETED', content: 'Réponse historique', ragStatus: 'SUCCESS',
      retrievalEvidence: evidence, citations: [citation], executionMetadata: {},
    });
    await pool.query(
      `UPDATE aria_conversation_turns
       SET "retrievalEvidence" = jsonb_set("retrievalEvidence", '{hits,0,chunkId}', '"other-chunk"')
       WHERE id = $1`,
      [reserved.turnId],
    );

    await expect(prismaAriaConversationRepository.loadTurnResult({
      turnId: reserved.turnId,
      actorUserId: ids.studentUser,
      subjectStudentId: ids.student,
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID' },
    });
  });

  it('ARIA-B-R064 rejects a stale execution token without mutating the Turn or assistant message', async () => {
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

  it('rejects a retrieval checkpoint after the execution fence is lost', async () => {
    const { reserved } = await reserveAndClaim('Checkpoint avec token périmé');

    await expect(checkpointAriaTurnRetrieval({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: 'stale-retrieval-token',
      ragStatus: 'SUCCESS',
      retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      retrievalEvidence: evidence,
      policyVersion: 'aria-retrieval-v1',
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_RETRIEVAL_CHECKPOINT_FENCE_LOST' },
    });
    await expect(pool.query(
      `SELECT status::text, "retrievalEvidence", "ragStatus", "retrievalPolicy"
       FROM aria_conversation_turns WHERE id = $1`,
      [reserved.turnId],
    )).resolves.toMatchObject({
      rows: [{
        status: 'RUNNING', retrievalEvidence: null, ragStatus: null, retrievalPolicy: null,
      }],
    });
  });

  it('rejects finalization if the persisted conversation lost its canonical course', async () => {
    const { reserved, claimed } = await reserveAndClaim('Conversation sans cours à finaliser');
    await pool.query(
      `UPDATE aria_conversations
       SET "contextState" = 'LEGACY_CONTEXT_UNRESOLVED', "courseKey" = NULL
       WHERE id = $1`,
      [reserved.conversationId],
    );

    await expect(finalizeAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId,
      executionToken: claimed.executionToken!,
      status: 'ERROR',
      content: '',
      ragStatus: 'NOT_CONFIGURED',
      retrievalEvidence: { schemaVersion: 1, hits: [] },
      citations: [],
      executionMetadata: { reasonCode: 'CONTEXT_INVALID' },
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_CITATION_COURSE_MISMATCH' },
    });
    await expect(pool.query(
      `SELECT t.status::text, a.content, a.status AS assistant_status
       FROM aria_conversation_turns t JOIN aria_messages a
       ON a."turnId" = t.id AND a."turnRole" = 'ASSISTANT' WHERE t.id = $1`,
      [reserved.turnId],
    )).resolves.toMatchObject({
      rows: [{ status: 'RUNNING', content: '', assistant_status: 'STREAMING' }],
    });
  });

  it('rolls back terminal state and citations when the assistant placeholder is missing', async () => {
    const { reserved, claimed } = await reserveAndClaim('Placeholder supprimé avant TX2');
    await checkpointAriaTurnRetrieval({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken!,
      ragStatus: 'SUCCESS',
      retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      retrievalEvidence: evidence,
      policyVersion: 'aria-retrieval-v1',
    });
    await pool.query('DELETE FROM aria_messages WHERE id = $1', [reserved.assistantMessageId]);

    await expect(finalizeAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId,
      executionToken: claimed.executionToken!,
      status: 'COMPLETED',
      content: 'Ne doit pas persister',
      ragStatus: 'SUCCESS',
      retrievalEvidence: evidence,
      citations: [citation],
      executionMetadata: {},
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_ASSISTANT_MESSAGE_MISSING' },
    });
    await expect(pool.query(
      `SELECT status::text, "retrievalEvidence" FROM aria_conversation_turns WHERE id = $1`,
      [reserved.turnId],
    )).resolves.toMatchObject({ rows: [{ status: 'RUNNING', retrievalEvidence: evidence }] });
    await expect(pool.query(
      `SELECT COUNT(*)::integer AS count FROM aria_message_citations WHERE "messageId" = $1`,
      [reserved.assistantMessageId],
    )).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });

  it('rolls back every TX2 write when the autonomous recovery watchdog is missing', async () => {
    const { reserved, claimed } = await reserveAndClaim('Watchdog supprimé avant TX2');
    await checkpointAriaTurnRetrieval({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken!,
      ragStatus: 'SUCCESS',
      retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      retrievalEvidence: evidence,
      policyVersion: 'aria-retrieval-v1',
    });
    await pool.query(
      `DELETE FROM canonical_job_outbox WHERE "idempotencyKey" = $1`,
      [`aria-turn-watchdog:${reserved.turnId}`],
    );

    await expect(finalizeAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId,
      executionToken: claimed.executionToken!,
      status: 'ERROR',
      content: 'Ne doit pas persister sans recovery',
      ragStatus: 'SUCCESS',
      retrievalEvidence: evidence,
      citations: [citation],
      executionMetadata: { reasonCode: 'MODEL_UNAVAILABLE' },
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_WATCHDOG_MISSING' },
    });
    await expect(pool.query(
      `SELECT t.status::text, a.status AS assistant_status, a.content,
              (SELECT COUNT(*)::integer FROM aria_message_citations c
               WHERE c."messageId" = a.id) AS citations
       FROM aria_conversation_turns t JOIN aria_messages a
       ON a."turnId" = t.id AND a."turnRole" = 'ASSISTANT' WHERE t.id = $1`,
      [reserved.turnId],
    )).resolves.toMatchObject({
      rows: [{ status: 'RUNNING', assistant_status: 'STREAMING', content: '', citations: 0 }],
    });
  });

  it('makes the first retrieval checkpoint immutable while allowing an identical retry', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Checkpoint immuable',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    const checkpoint = {
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken,
      ragStatus: 'SUCCESS' as const,
      retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      retrievalEvidence: evidence,
      policyVersion: 'aria-retrieval-v1',
    };
    await checkpointAriaTurnRetrieval(checkpoint);
    await checkpointAriaTurnRetrieval(checkpoint);

    await expect(checkpointAriaTurnRetrieval({
      ...checkpoint,
      retrievalEvidence: conflictingEvidence,
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_RETRIEVAL_CHECKPOINT_CONFLICT' },
    });
    await expect(pool.query(
      `SELECT "retrievalEvidence", "ragStatus", "retrievalPolicy", "policyVersion"
       FROM aria_conversation_turns WHERE id = $1`,
      [reserved.turnId],
    )).resolves.toMatchObject({
      rows: [{
        retrievalEvidence: evidence,
        ragStatus: 'SUCCESS',
        retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
        policyVersion: 'aria-retrieval-v1',
      }],
    });
  });

  it.each(['COMPLETED', 'ERROR', 'CANCELLED'] as const)(
    'rejects %s finalization that replaces the checkpointed retrieval provenance',
    async (status) => {
      const context = await buildAriaConversationContext({
        actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
      });
      const clientRequestId = randomUUID();
      const reserved = await reserveAriaConversationTurn({
        context, clientRequestId, message: `Finalisation ${status} avec preuve conflictuelle`,
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
      if (status === 'CANCELLED') {
        await cancelAriaConversationTurn({
          actor: { userId: ids.studentUser, role: 'ELEVE' },
          turnId: reserved.turnId,
          clientRequestId,
        });
      }

      await expect(finalizeAriaConversationTurn({
        turnId: reserved.turnId, conversationId: reserved.conversationId,
        assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
        status, content: 'Ne doit pas être persisté', ragStatus: 'SUCCESS',
        retrievalEvidence: conflictingEvidence, citations: [conflictingCitation],
        executionMetadata: {},
      })).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: 'CITATION_NOT_RETRIEVED_BY_TURN' },
      });
      await expect(pool.query(
        `SELECT status::text, "retrievalEvidence", "ragStatus", "retrievalPolicy"
         FROM aria_conversation_turns WHERE id = $1`,
        [reserved.turnId],
      )).resolves.toMatchObject({
        rows: [{
          status: 'RUNNING', retrievalEvidence: evidence, ragStatus: 'SUCCESS',
          retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
        }],
      });
    },
  );

  it('rejects a terminal RAG status that differs from the checkpointed status', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Status RAG immuable',
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
      status: 'ERROR', content: '', ragStatus: 'NO_RESULTS',
      retrievalEvidence: evidence, citations: [], executionMetadata: {},
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_RETRIEVAL_AUDIT_MISMATCH' },
    });
    await expect(pool.query(
      'SELECT status::text, "retrievalEvidence", "ragStatus" FROM aria_conversation_turns WHERE id = $1',
      [reserved.turnId],
    )).resolves.toMatchObject({
      rows: [{ status: 'RUNNING', retrievalEvidence: evidence, ragStatus: 'SUCCESS' }],
    });
  });

  it('rejects a successful finalization when retrieval was never checkpointed', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Succès sans retrieval interdit',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');

    await expect(finalizeAriaConversationTurn({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
      status: 'COMPLETED', content: 'Faux succès', ragStatus: 'SUCCESS',
      retrievalEvidence: { schemaVersion: 1, hits: [] }, citations: [], executionMetadata: {},
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_RETRIEVAL_AUDIT_MISMATCH' },
    });
    await expect(pool.query(
      'SELECT status::text, "retrievalEvidence", "ragStatus" FROM aria_conversation_turns WHERE id = $1',
      [reserved.turnId],
    )).resolves.toMatchObject({
      rows: [{ status: 'RUNNING', retrievalEvidence: null, ragStatus: null }],
    });
  });

  it('allows only a fail-closed pre-retrieval ERROR without a checkpoint', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Erreur avant retrieval',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');

    await finalizeAriaConversationTurn({
      turnId: reserved.turnId, conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId, executionToken: claimed.executionToken,
      status: 'ERROR', content: '', ragStatus: 'NOT_CONFIGURED',
      retrievalEvidence: { schemaVersion: 1, hits: [] }, citations: [],
      executionMetadata: { reasonCode: 'PRE_POLICY_FAILURE' },
    });
    await expect(pool.query(
      'SELECT status::text, "retrievalEvidence", "ragStatus" FROM aria_conversation_turns WHERE id = $1',
      [reserved.turnId],
    )).resolves.toMatchObject({
      rows: [{
        status: 'ERROR', retrievalEvidence: { schemaVersion: 1, hits: [] },
        ragStatus: 'NOT_CONFIGURED',
      }],
    });
  });

  it('serializes concurrent first checkpoints and preserves exactly one provenance winner', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Course checkpoints différents',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    const base = {
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken,
      ragStatus: 'SUCCESS' as const,
      retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      policyVersion: 'aria-retrieval-v1',
    };

    const settled = await Promise.allSettled([
      checkpointAriaTurnRetrieval({ ...base, retrievalEvidence: evidence }),
      checkpointAriaTurnRetrieval({ ...base, retrievalEvidence: conflictingEvidence }),
    ]);
    expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(settled.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: {
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: 'TURN_RETRIEVAL_CHECKPOINT_CONFLICT' },
      },
    });
    const persisted = await pool.query(
      'SELECT "retrievalEvidence" FROM aria_conversation_turns WHERE id = $1',
      [reserved.turnId],
    );
    expect([evidence, conflictingEvidence]).toContainEqual(persisted.rows[0].retrievalEvidence);
  });

  it('treats concurrent identical first checkpoints as idempotent', async () => {
    const context = await buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' }, courseKey: 'eds-maths-premiere',
    });
    const reserved = await reserveAriaConversationTurn({
      context, clientRequestId: randomUUID(), message: 'Course checkpoints identiques',
    });
    const claimed = await claimAriaConversationTurn({
      context, turnId: reserved.turnId, conversationId: reserved.conversationId,
    });
    if (!claimed.executionToken) throw new Error('ARIA_TEST_CLAIM_TOKEN_REQUIRED');
    const checkpoint = {
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken,
      ragStatus: 'SUCCESS' as const,
      retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      retrievalEvidence: evidence,
      policyVersion: 'aria-retrieval-v1',
    };

    await expect(Promise.all([
      checkpointAriaTurnRetrieval(checkpoint),
      checkpointAriaTurnRetrieval(checkpoint),
    ])).resolves.toEqual([undefined, undefined]);
    await expect(pool.query(
      'SELECT "retrievalEvidence" FROM aria_conversation_turns WHERE id = $1',
      [reserved.turnId],
    )).resolves.toMatchObject({ rows: [{ retrievalEvidence: evidence }] });
  });
});
