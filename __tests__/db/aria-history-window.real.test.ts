/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DEFAULT_ARIA_HISTORY_BUDGET, selectAriaPromptHistory } from '@/lib/aria/domain/conversation/history-budget';
import { prismaAriaConversationRepository } from '@/lib/aria/infrastructure/prisma/conversation-repository';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('THREAD_HISTORY_NEWEST_MESSAGES', () => {
  let pool: Pool;
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    studentUser: randomUUID(),
    student: randomUUID(),
    conversation: randomUUID(),
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
       ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
      [ids.parentUser, `parent-${ids.parentUser}@invalid.test`, ids.studentUser, `student-${ids.studentUser}@invalid.test`],
    );
    await pool.query('INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)', [ids.parent, ids.parentUser]);
    await pool.query(
      `INSERT INTO students
       (id, "parentId", "userId", "gradeLevel", "academicTrack", "updatedAt")
       VALUES ($1, $2, $3, 'PREMIERE', 'EDS_GENERALE', NOW())`,
      [ids.student, ids.parent, ids.studentUser],
    );
    await pool.query(
      `INSERT INTO aria_conversations
       (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'ACTIVE', NOW())`,
      [ids.conversation, ids.student],
    );

    for (let sequence = 1; sequence <= 8; sequence += 1) {
      const turnId = randomUUID();
      const createdAt = `2026-08-30T10:${sequence.toString().padStart(2, '0')}:00.000Z`;
      await pool.query(
        `INSERT INTO aria_conversation_turns
         (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
          "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
          "completedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'CONVERSATION', $5, $6, $7, 'COMPLETED', '{}', $8, $8, $8)`,
        [
          turnId,
          ids.conversation,
          ids.student,
          ids.studentUser,
          randomUUID(),
          sequence.toString(16).padStart(64, '0'),
          sequence,
          createdAt,
        ],
      );
      await pool.query(
        `INSERT INTO aria_messages
         (id, "conversationId", role, content, status, "turnId", "turnRole", "createdAt") VALUES
         ($1, $3, 'user', $4, 'COMPLETED', $2, 'USER', $6),
         ($5, $3, 'assistant', $7, 'COMPLETED', $2, 'ASSISTANT', $6)`,
        [
          randomUUID(),
          turnId,
          ids.conversation,
          `U${sequence}-message court`,
          randomUUID(),
          createdAt,
          `A${sequence}-réponse courte`,
        ],
      );
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM aria_conversations WHERE id = $1', [ids.conversation]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[ids.studentUser, ids.parentUser]]);
    await pool.end();
  });

  it('returns the budgeted newest complete pairs in chronological prompt order', async () => {
    const newestFirst = await prismaAriaConversationRepository.loadRecentCompletedTurns({
      conversationId: ids.conversation,
      subjectStudentId: ids.student,
      maxTurns: DEFAULT_ARIA_HISTORY_BUDGET.maxCandidateTurns,
    });
    const messages = selectAriaPromptHistory(newestFirst, DEFAULT_ARIA_HISTORY_BUDGET);

    expect(messages).toHaveLength(10);
    expect(messages.map((message) => message.content.slice(0, 2))).toEqual([
      'U4', 'A4', 'U5', 'A5', 'U6', 'A6', 'U7', 'A7', 'U8', 'A8',
    ]);
  });
});
