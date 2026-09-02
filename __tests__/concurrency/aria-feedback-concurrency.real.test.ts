/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { recordAriaFeedbackForActor } from '@/lib/aria/application/feedback/public';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('ARIA feedback concurrency on PostgreSQL', () => {
  let pool: Pool;
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    studentUser: randomUUID(),
    student: randomUUID(),
    conversation: randomUUID(),
    message: randomUUID(),
    userMessage: randomUUID(),
    systemMessage: randomUUID(),
    runningTurn: randomUUID(),
    runningAssistant: randomUUID(),
    completedTurn: randomUUID(),
    completedAssistant: randomUUID(),
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl, max: 4 });
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
       ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
      [ids.parentUser, `parent-${ids.parentUser}@invalid.test`, ids.studentUser, `student-${ids.studentUser}@invalid.test`],
    );
    await pool.query('INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)', [ids.parent, ids.parentUser]);
    await pool.query(
      `INSERT INTO students
       (id, "parentId", "userId", "gradeLevel", "academicTrack", "updatedAt")
       VALUES ($1, $2, $3, 'TERMINALE', 'EDS_GENERALE', NOW())`,
      [ids.student, ids.parent, ids.studentUser],
    );
    await pool.query(
      `INSERT INTO aria_conversations
       (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $2, 'eds-maths-terminale', 'ACTIVE', NOW())`,
      [ids.conversation, ids.student],
    );
    await pool.query(
      `INSERT INTO aria_messages (id, "conversationId", role, content, status, "createdAt")
       VALUES ($1, $2, 'assistant', 'Réponse', 'COMPLETED', NOW()),
              ($3, $2, 'user', 'Question', 'COMPLETED', NOW()),
              ($4, $2, 'system', 'Interne', 'COMPLETED', NOW())`,
      [ids.message, ids.conversation, ids.userMessage, ids.systemMessage],
    );
    await pool.query(
      `INSERT INTO aria_conversation_turns
       (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
        "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
        "executionToken", "heartbeatAt", "leaseExpiresAt", "startedAt", "completedAt",
        "createdAt", "updatedAt") VALUES
       ($1, $3, $4, $5, 'CONVERSATION', $6, $7, 1, 'RUNNING', '{}',
        'feedback-test-running', NOW(), NOW() + INTERVAL '1 minute', NOW(), NULL, NOW(), NOW()),
       ($2, $3, $4, $5, 'CONVERSATION', $8, $9, 2, 'COMPLETED', '{}',
        NULL, NULL, NULL, NOW(), NOW(), NOW(), NOW())`,
      [
        ids.runningTurn, ids.completedTurn, ids.conversation, ids.student, ids.studentUser,
        randomUUID(), 'a'.repeat(64), randomUUID(), 'b'.repeat(64),
      ],
    );
    await pool.query(
      `INSERT INTO aria_messages
       (id, "conversationId", role, content, status, "turnId", "turnRole", "createdAt") VALUES
       ($1, $3, 'assistant', 'Réponse active', 'STREAMING', $4, 'ASSISTANT', NOW()),
       ($2, $3, 'assistant', 'Réponse terminale', 'COMPLETED', $5, 'ASSISTANT', NOW())`,
      [
        ids.runningAssistant, ids.completedAssistant, ids.conversation,
        ids.runningTurn, ids.completedTurn,
      ],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM aria_conversations WHERE id = $1', [ids.conversation]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[ids.studentUser, ids.parentUser]]);
    await pool.end();
  });

  it('D015 ARIA-B-R070 serializes duplicate same-value upserts into one canonical row', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => recordAriaFeedbackForActor({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      messageId: ids.message,
      useful: true,
      reason: 'Clair',
    })));

    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    const rows = await pool.query(
      'SELECT useful, reason FROM aria_feedbacks WHERE "messageId" = $1',
      [ids.message],
    );
    expect(rows.rows).toEqual([{ useful: true, reason: 'Clair' }]);
  });

  it('rejects user, system and non-terminal assistant messages while accepting a completed assistant Turn', async () => {
    for (const messageId of [ids.userMessage, ids.systemMessage, ids.runningAssistant]) {
      await expect(recordAriaFeedbackForActor({
        actor: { userId: ids.studentUser, role: 'ELEVE' },
        messageId,
        useful: true,
      })).rejects.toMatchObject({ code: 'NOT_ENTITLED' });
    }
    const forbiddenRows = await pool.query(
      `SELECT count(*)::int AS count FROM aria_feedbacks
       WHERE "messageId" = ANY($1::text[])`,
      [[ids.userMessage, ids.systemMessage, ids.runningAssistant]],
    );
    expect(forbiddenRows.rows).toEqual([{ count: 0 }]);

    await expect(recordAriaFeedbackForActor({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      messageId: ids.completedAssistant,
      useful: true,
    })).resolves.toMatchObject({
      messageId: ids.completedAssistant,
      useful: true,
    });
  });

  it('uses LAST_COMMITTED_WRITE_WINS for opposite concurrent votes without duplicate state', async () => {
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await first.query('BEGIN');
      await first.query(
        `INSERT INTO aria_feedbacks
         (id, "messageId", "studentId", useful, reason, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, TRUE, 'first', NOW(), NOW())
         ON CONFLICT ("messageId", "studentId") DO UPDATE
           SET useful = EXCLUDED.useful, reason = EXCLUDED.reason, "updatedAt" = NOW()`,
        [randomUUID(), ids.message, ids.student],
      );

      const secondWrite = second.query(
        `INSERT INTO aria_feedbacks
         (id, "messageId", "studentId", useful, reason, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, FALSE, 'second', NOW(), NOW())
         ON CONFLICT ("messageId", "studentId") DO UPDATE
           SET useful = EXCLUDED.useful, reason = EXCLUDED.reason, "updatedAt" = NOW()
         RETURNING useful, reason`,
        [randomUUID(), ids.message, ids.student],
      );
      await first.query('COMMIT');
      const persistedByLastCommit = await secondWrite;
      await second.query('COMMIT');

      expect(persistedByLastCommit.rows).toEqual([{ useful: false, reason: 'second' }]);
      const canonical = await pool.query(
        'SELECT useful, reason FROM aria_feedbacks WHERE "messageId" = $1',
        [ids.message],
      );
      expect(canonical.rows).toEqual([{ useful: false, reason: 'second' }]);
      expect(canonical.rowCount).toBe(1);
    } finally {
      first.release();
      second.release();
    }
  });

  it('never mutates the legacy AriaMessage.feedback field', async () => {
    await recordAriaFeedbackForActor({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      messageId: ids.message,
      useful: true,
    });
    const legacy = await pool.query('SELECT feedback FROM aria_messages WHERE id = $1', [ids.message]);
    expect(legacy.rows).toEqual([{ feedback: null }]);
  });
});
