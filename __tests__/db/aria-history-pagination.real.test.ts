/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  listAriaConversationMessages,
  listAriaConversations,
} from '@/lib/aria/application/history/public';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const courseKey = 'eds-maths-premiere';

describe('ARIA cursor history on PostgreSQL', () => {
  let pool: Pool;
  let owner: AriaRealDbFixtureIds;
  let other: AriaRealDbFixtureIds;
  const activeIds = ['history-conversation-a', 'history-conversation-b', 'history-conversation-c'];
  const legacyId = 'history-conversation-legacy';
  const sharedTimestamp = new Date('2026-08-30T14:00:00.000Z');

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    owner = await seedAriaRealDbFixture(pool, courseKey);
    other = await seedAriaRealDbFixture(pool, courseKey);
    for (const id of activeIds) {
      await pool.query(
        `INSERT INTO aria_conversations
         (id, "studentId", "courseKey", "contextState", title, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'ACTIVE', $1, $4, $4)`,
        [id, owner.student, courseKey, sharedTimestamp],
      );
    }
    await pool.query(
      `INSERT INTO aria_conversations
       (id, "studentId", "courseKey", "contextState", title, "createdAt", "updatedAt")
       VALUES ($1, $2, NULL, 'LEGACY_CONTEXT_UNRESOLVED', 'Legacy', $3, $3)`,
      [legacyId, owner.student, sharedTimestamp],
    );
    await pool.query(
      `INSERT INTO aria_conversation_turns
       (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
        "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
        "pedagogicalMode", "updatedAt")
       VALUES ('history-active-turn', $1, $2, $3, 'CONVERSATION',
        '00000000-0000-4000-8000-000000000091', $4, 1, 'PENDING', '{}'::jsonb,
        'METHODOLOGY', $5)`,
      [activeIds[0], owner.student, owner.studentUser, 'a'.repeat(64), sharedTimestamp],
    );
    for (let index = 1; index <= 5; index += 1) {
      await pool.query(
        `INSERT INTO aria_messages
         (id, "conversationId", role, content, status, "createdAt")
         VALUES ($1, $2, $3, $4, 'COMPLETED', $5)`,
        [
          `history-message-${index}`,
          activeIds[0],
          index % 2 === 0 ? 'assistant' : 'user',
          `message-${index}`,
          sharedTimestamp,
        ],
      );
    }
    await pool.query(
      `INSERT INTO aria_message_citations
       (id, "messageId", "sourceTitle", "sourceDocument", "courseKey", provenance)
       VALUES ($1, 'history-message-2', 'Archive papier', 'legacy.pdf', $2, 'NEXUS_METHODE')`,
      [randomUUID(), courseKey],
    );
    await pool.query(
      `INSERT INTO aria_messages
       (id, "conversationId", role, content, status, "createdAt")
       VALUES ($1, $2, 'user', 'legacy-readable', 'COMPLETED', $3)`,
      [randomUUID(), legacyId, sharedTimestamp],
    );
  });

  afterAll(async () => {
    await cleanupAriaRealDbFixture(pool, owner);
    await cleanupAriaRealDbFixture(pool, other);
    await pool.end();
  });

  it('D009 ARIA-B-R022 paginates equal-timestamp conversations with an id tie-breaker and no loss or duplicate', async () => {
    const first = await listAriaConversations({
      actor: { userId: owner.studentUser, role: 'ELEVE' },
      courseKey,
      contextState: 'ACTIVE',
      limit: 2,
    });
    expect(first.conversations.map(({ id }) => id)).toEqual([
      'history-conversation-c', 'history-conversation-b',
    ]);
    expect(first.nextCursor).not.toBeNull();

    const second = await listAriaConversations({
      actor: { userId: owner.studentUser, role: 'ELEVE' },
      courseKey,
      contextState: 'ACTIVE',
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    });
    expect(second.conversations.map(({ id }) => id)).toEqual(['history-conversation-a']);
    expect(second.nextCursor).toBeNull();
  });

  it('returns newest message pages in chronological order without tie loss', async () => {
    const first = await listAriaConversationMessages({
      actor: { userId: owner.studentUser, role: 'ELEVE' },
      conversationId: activeIds[0],
      limit: 2,
    });
    expect(first.messages.map(({ messageId }) => messageId)).toEqual([
      'history-message-4', 'history-message-5',
    ]);
    expect(first.conversation.activeTurn).toEqual({
      turnId: 'history-active-turn',
      clientRequestId: '00000000-0000-4000-8000-000000000091',
      status: 'PENDING',
      pedagogicalMode: 'METHODOLOGY',
    });
    const second = await listAriaConversationMessages({
      actor: { userId: owner.studentUser, role: 'ELEVE' },
      conversationId: activeIds[0],
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    });
    expect(second.messages.map(({ messageId }) => messageId)).toEqual([
      'history-message-2', 'history-message-3',
    ]);
    const third = await listAriaConversationMessages({
      actor: { userId: owner.studentUser, role: 'ELEVE' },
      conversationId: activeIds[0],
      cursor: second.nextCursor ?? undefined,
      limit: 2,
    });
    expect(third.messages.map(({ messageId }) => messageId)).toEqual(['history-message-1']);
    expect(new Set([
      ...first.messages, ...second.messages, ...third.messages,
    ].map(({ messageId }) => messageId)).size).toBe(5);
  });

  it('preserves an all-null legacy citation as explicit display-only history', async () => {
    const history = await listAriaConversationMessages({
      actor: { userId: owner.studentUser, role: 'ELEVE' },
      conversationId: activeIds[0],
      limit: 10,
    });
    const legacyCitation = history.messages
      .find(({ messageId }) => messageId === 'history-message-2')?.citations[0];

    expect(legacyCitation).toMatchObject({
      traceability: 'LEGACY_UNTRACEABLE',
      courseKey: null,
      sourceTitle: 'Référence historique',
      sourceDocument: 'Provenance non vérifiable',
      sourceLocation: null,
      provenance: 'LEGACY_UNVERIFIED',
      url: null,
      resourceId: null,
      resourceVersionId: null,
      contentSha256: null,
      chunkId: null,
      locator: null,
      corpusId: null,
      corpusVersionId: null,
      manifestSha256: null,
    });
    await expect(pool.query(
      `SELECT count(*)::int AS count FROM aria_message_citations
       WHERE "messageId" = 'history-message-2'`,
    )).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it('rejects a cross-course legacy citation when the active conversation course is known', async () => {
    await pool.query(
      `UPDATE aria_message_citations SET "courseKey" = 'eds-nsi-premiere'
       WHERE "messageId" = 'history-message-2'`,
    );
    try {
      await expect(listAriaConversationMessages({
        actor: { userId: owner.studentUser, role: 'ELEVE' },
        conversationId: activeIds[0],
        limit: 10,
      })).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID' },
      });
    } finally {
      await pool.query(
        `UPDATE aria_message_citations SET "courseKey" = $1
         WHERE "messageId" = 'history-message-2'`,
        [courseKey],
      );
    }
  });

  it('THREAD_LEGACY_HISTORY_NULL_COURSE keeps nullable legacy rows readable but non-resumable', async () => {
    const legacy = await listAriaConversations({
      actor: { userId: owner.studentUser, role: 'ELEVE' },
      contextState: 'LEGACY_CONTEXT_UNRESOLVED',
      limit: 20,
    });
    expect(legacy.conversations).toEqual([
      expect.objectContaining({
        id: legacyId,
        courseKey: null,
        contextState: 'LEGACY_CONTEXT_UNRESOLVED',
        resumable: false,
      }),
    ]);
    const messages = await listAriaConversationMessages({
      actor: { userId: owner.studentUser, role: 'ELEVE' },
      conversationId: legacyId,
      limit: 20,
    });
    expect(messages.conversation).toEqual({
      id: legacyId,
      courseKey: null,
      contextState: 'LEGACY_CONTEXT_UNRESOLVED',
      resumable: false,
      activeTurn: null,
    });
    expect(messages.messages.map(({ content }) => content)).toEqual(['legacy-readable']);
  });

  it('fails closed when an authenticated student reads another student conversation', async () => {
    await expect(listAriaConversationMessages({
      actor: { userId: other.studentUser, role: 'ELEVE' },
      conversationId: activeIds[0],
      limit: 20,
    })).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND', status: 404 });
  });
});
