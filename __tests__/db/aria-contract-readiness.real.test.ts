/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { evaluateAriaContractReadiness } from '@/scripts/aria/verify-contract-readiness';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('ARIA M2 contract readiness', () => {
  let pool: Pool;

  beforeAll(() => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('keeps ARIA_LEGACY_SCHEMA_DEBT blocked until data and writer guards are all clean', async () => {
    const ids = {
      parentUser: randomUUID(), parent: randomUUID(), studentUser: randomUUID(),
      student: randomUUID(), conversation: randomUUID(), message: randomUUID(), profile: randomUUID(),
    };
    await pool.query('BEGIN');
    try {
      await pool.query(
        `INSERT INTO users (id, email, role, "updatedAt") VALUES
          ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
        [
          ids.parentUser, `m2-parent-${ids.parentUser}@invalid.test`,
          ids.studentUser, `m2-student-${ids.studentUser}@invalid.test`,
        ],
      );
      await pool.query('INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)', [ids.parent, ids.parentUser]);
      await pool.query(
        `INSERT INTO students (id, "parentId", "userId", "gradeLevel", "updatedAt")
         VALUES ($1, $2, $3, 'PREMIERE', NOW())`,
        [ids.student, ids.parent, ids.studentUser],
      );
      await pool.query(
        `INSERT INTO aria_conversations
          (id, "studentId", subject, "courseKey", "contextState", "updatedAt")
         VALUES ($1, $2, 'MATHEMATIQUES', NULL, 'LEGACY_CONTEXT_UNRESOLVED', NOW())`,
        [ids.conversation, ids.student],
      );
      await pool.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, feedback, "createdAt")
         VALUES ($1, $2, 'assistant', 'legacy', 'COMPLETED', true, NOW())`,
        [ids.message, ids.conversation],
      );
      await pool.query(
        `INSERT INTO aria_learning_profiles
          (id, "studentId", "selectedCourseKeys", "uiPreferences", "createdAt", "updatedAt")
         VALUES ($1, $2, '{"legacy":"malformed-selection"}'::jsonb, '{}'::jsonb, NOW(), NOW())`,
        [ids.profile, ids.student],
      );

      await expect(evaluateAriaContractReadiness(pool, { legacyWritersDrained: false }))
        .resolves.toEqual({
          debt: 'ARIA_LEGACY_SCHEMA_DEBT',
          ready: false,
          blockers: {
            activeTurns: 0,
            legacyMessageFeedback: 1,
            legacyMessagesWithoutTurn: 1,
            legacyProfilesWithSelection: 1,
            nullableConversationCourseKey: 1,
            unresolvedConversationContext: 1,
            legacyWritersNotDrained: 1,
            manualAdjudicationContractMissing: 1,
          },
          blockerCount: 7,
        });
    } finally {
      await pool.query('ROLLBACK');
    }
  });

  it('keeps M2 blocked on a clean M1 database until approved row adjudication exists', async () => {
    await expect(evaluateAriaContractReadiness(pool, { legacyWritersDrained: true }))
      .resolves.toMatchObject({
        debt: 'ARIA_LEGACY_SCHEMA_DEBT',
        ready: false,
        blockers: { manualAdjudicationContractMissing: 1 },
        blockerCount: 1,
      });
  });
});
