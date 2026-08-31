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
const canonicalCitation = {
  id: 'replay-hit-1',
  resourceId: '62c11386-3035-543b-a393-f025e5261312',
  resourceVersionId: '1ba3d1cd-8fc0-510a-9bcd-d5807cd4036a',
  contentSha256: '80b8ef1440548faeb5861adc764e6c9740cc2d2c806685287b72eabb5aeeea73',
  chunkId: 'replay-chunk-1',
  locator: { section: 'introduction' },
  corpusId: 'maths-premiere',
  corpusVersionId: 'corpus-version-1',
  manifestSha256: 'b'.repeat(64),
  sourceTitle: 'Valeur client non fiable',
  sourceDocument: '/srv/private/student@example.test.pdf',
  sourceLocation: '/home/private/programme.pdf',
  courseKey: 'eds-maths-premiere',
  provenance: 'FORGED_OFFICIAL',
  url: 'https://attacker.example.test/programme.pdf',
  snippet: 'Extrait',
};
const canonicalEvidence = {
  schemaVersion: 1 as const,
  manifestSha256: canonicalCitation.manifestSha256,
  corpusId: canonicalCitation.corpusId,
  corpusVersionId: canonicalCitation.corpusVersionId,
  hits: [{
    resourceId: canonicalCitation.resourceId,
    resourceVersionId: canonicalCitation.resourceVersionId,
    contentSha256: canonicalCitation.contentSha256,
    chunkId: canonicalCitation.chunkId,
    locator: canonicalCitation.locator,
  }],
};

describe('ARIA persisted Turn replay on PostgreSQL', () => {
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
    return { reserved, claimed };
  }

  async function finalizeWithoutRag(
    message: string,
    executionMetadata: Readonly<Record<string, unknown>> = {},
  ) {
    const { reserved, claimed } = await reserveAndClaim(message);
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
      status: 'ERROR',
      content: 'Résultat terminal persistant',
      ragStatus: 'NOT_CONFIGURED',
      retrievalEvidence: { schemaVersion: 1, hits: [] },
      citations: [],
      executionMetadata,
    });
    return reserved;
  }

  async function finalizeWithCitation(message: string) {
    const { reserved, claimed } = await reserveAndClaim(message);
    await checkpointAriaTurnRetrieval({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      executionToken: claimed.executionToken!,
      ragStatus: 'SUCCESS',
      retrievalPolicy: { kind: 'GROUNDED_REQUIRED' },
      retrievalEvidence: canonicalEvidence,
      policyVersion: 'aria-retrieval-v1',
    });
    await finalizeAriaConversationTurn({
      turnId: reserved.turnId,
      conversationId: reserved.conversationId,
      assistantMessageId: reserved.assistantMessageId,
      executionToken: claimed.executionToken!,
      status: 'COMPLETED',
      content: 'Résultat cité',
      ragStatus: 'SUCCESS',
      retrievalEvidence: canonicalEvidence,
      citations: [canonicalCitation],
      executionMetadata: {},
    });
    return reserved;
  }

  const load = (turnId: string, actorUserId = ids.studentUser, subjectStudentId = ids.student) =>
    prismaAriaConversationRepository.loadTurnResult({ turnId, actorUserId, subjectStudentId });

  it('LOAD_TURN_RESULT_DENIES_WRONG_ACTOR_AND_WRONG_SUBJECT', async () => {
    const reserved = await finalizeWithoutRag('Ownership replay');
    await expect(load(reserved.turnId, randomUUID(), ids.student)).rejects.toMatchObject({
      code: 'CONVERSATION_NOT_FOUND',
    });
    await expect(load(reserved.turnId, ids.studentUser, randomUUID())).rejects.toMatchObject({
      code: 'CONVERSATION_NOT_FOUND',
    });
  });

  it('LOAD_TURN_RESULT_REJECTS_NON_TERMINAL_TURN', async () => {
    const { reserved } = await reserveAndClaim('Replay interdit pendant RUNNING');
    await expect(load(reserved.turnId)).rejects.toMatchObject({
      code: 'CONVERSATION_NOT_FOUND',
    });
  });

  it('LOAD_TURN_RESULT_FAILS_CLOSED_AFTER_TERMINAL_ASSISTANT_DELETION', async () => {
    const reserved = await finalizeWithoutRag('Assistant terminal manquant');
    await pool.query('DELETE FROM aria_messages WHERE id=$1', [reserved.assistantMessageId]);

    await expect(load(reserved.turnId)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'TURN_ASSISTANT_MESSAGE_MISSING' },
    });
  });

  it('LOAD_TURN_RESULT_FAILS_CLOSED_WHEN_PARENT_CONVERSATION_LOSES_COURSE', async () => {
    const reserved = await finalizeWithoutRag('Conversation sans cours');
    await pool.query(
      `UPDATE aria_conversations
       SET "courseKey"=NULL, "contextState"='LEGACY_CONTEXT_UNRESOLVED'
       WHERE id=$1`,
      [reserved.conversationId],
    );
    await expect(load(reserved.turnId)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });

  it('LOAD_TURN_RESULT_READS_CANONICAL_FAILURE_CODE', async () => {
    const reserved = await finalizeWithoutRag('Code canonique', {
      failureCode: 'MODEL_TIMEOUT',
      reasonCode: 'MODEL_UNAVAILABLE',
    });
    await expect(load(reserved.turnId)).resolves.toMatchObject({ failureCode: 'MODEL_TIMEOUT' });
  });

  it('LOAD_TURN_RESULT_READS_LEGACY_REASON_CODE', async () => {
    const reserved = await finalizeWithoutRag('Code legacy', { reasonCode: 'MODEL_UNAVAILABLE' });
    await expect(load(reserved.turnId)).resolves.toMatchObject({ failureCode: 'MODEL_UNAVAILABLE' });
  });

  it.each([
    ['null', null],
    ['array', ['MODEL_TIMEOUT']],
    ['primitive', 'MODEL_TIMEOUT'],
    ['unknown code', { failureCode: 'PRIVATE_PROVIDER_FAILURE' }],
  ])('LOAD_TURN_RESULT_IGNORES_MALFORMED_FAILURE_METADATA_%s', async (_label, metadata) => {
    const reserved = await finalizeWithoutRag(`Metadata malformée ${_label}`);
    await pool.query(
      'UPDATE aria_conversation_turns SET "executionMetadata"=$2::jsonb WHERE id=$1',
      [reserved.turnId, JSON.stringify(metadata)],
    );
    await expect(load(reserved.turnId)).resolves.toEqual(expect.not.objectContaining({
      failureCode: expect.anything(),
    }));
  });

  it('LOAD_TURN_RESULT_REPLAYS_CANONICAL_CITATION_WITH_NULL_SOURCE_LOCATION', async () => {
    const reserved = await finalizeWithCitation('Citation sans page');
    await expect(pool.query(
      'SELECT "sourceLocation" FROM aria_message_citations WHERE "messageId"=$1',
      [reserved.assistantMessageId],
    )).resolves.toMatchObject({ rows: [{ sourceLocation: null }] });

    const result = await load(reserved.turnId);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      resourceVersionId: canonicalCitation.resourceVersionId,
      sourceLocation: undefined,
    });
  });

  it('LOAD_TURN_RESULT_REDERIVES_CANONICAL_URL_WHEN_LEGACY_COLUMN_IS_NULL', async () => {
    const reserved = await finalizeWithCitation('Citation URL à reconstruire');
    await pool.query(
      'UPDATE aria_message_citations SET url=NULL WHERE "messageId"=$1',
      [reserved.assistantMessageId],
    );
    await expect(load(reserved.turnId)).resolves.toMatchObject({
      citations: [{
        resourceVersionId: canonicalCitation.resourceVersionId,
        url: 'https://www.education.gouv.fr/bo/19/Special1/MENE1901632A.htm',
      }],
    });
  });

  it('POSTGRES_REJECTS_PARTIALLY_NULL_CANONICAL_CITATION_IDENTITY', async () => {
    const reserved = await finalizeWithCitation('Citation atomique');
    await expect(pool.query(
      'UPDATE aria_message_citations SET "resourceVersionId"=NULL WHERE "messageId"=$1',
      [reserved.assistantMessageId],
    )).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(
      `SELECT "resourceId", "resourceVersionId", "contentSha256", "chunkId",
              locator, "corpusId", "corpusVersionId", "manifestSha256"
       FROM aria_message_citations WHERE "messageId"=$1`,
      [reserved.assistantMessageId],
    )).resolves.toMatchObject({
      rows: [{
        resourceId: canonicalCitation.resourceId,
        resourceVersionId: canonicalCitation.resourceVersionId,
        contentSha256: canonicalCitation.contentSha256,
        chunkId: canonicalCitation.chunkId,
        locator: canonicalCitation.locator,
        corpusId: canonicalCitation.corpusId,
        corpusVersionId: canonicalCitation.corpusVersionId,
        manifestSha256: canonicalCitation.manifestSha256,
      }],
    });
  });
});
