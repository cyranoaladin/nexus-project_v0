/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  backfillAriaFeedbackProfiles,
  rollbackAriaFeedbackProfileBackfill,
} from '@/scripts/aria/backfill-feedback-profile';
import {
  getAriaLearningProfileForActor,
  replaceAriaLearningProfileForActor,
} from '@/lib/aria/application/profile/public';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('ARIA feedback/profile backfill and profile persistence on PostgreSQL', () => {
  let pool: Pool;
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    userA: randomUUID(),
    studentA: randomUUID(),
    userB: randomUUID(),
    studentB: randomUUID(),
    conversation: randomUUID(),
    feedbackInsertMessage: randomUUID(),
    feedbackEqualMessage: randomUUID(),
    feedbackConflictMessage: randomUUID(),
    equalFeedback: randomUUID(),
    conflictFeedback: randomUUID(),
    profileA: randomUUID(),
    profileB: randomUUID(),
    runId: randomUUID(),
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl, max: 4 });
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
       ($1, $2, 'PARENT', NOW()),
       ($3, $4, 'ELEVE', NOW()),
       ($5, $6, 'ELEVE', NOW())`,
      [
        ids.parentUser, `parent-${ids.parentUser}@invalid.test`,
        ids.userA, `student-${ids.userA}@invalid.test`,
        ids.userB, `student-${ids.userB}@invalid.test`,
      ],
    );
    await pool.query('INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)', [ids.parent, ids.parentUser]);
    await pool.query(
      `INSERT INTO students
       (id, "parentId", "userId", "gradeLevel", "academicTrack", "updatedAt") VALUES
       ($1, $2, $3, 'TERMINALE', 'EDS_GENERALE', NOW()),
       ($4, $2, $5, 'TERMINALE', 'EDS_GENERALE', NOW())`,
      [ids.studentA, ids.parent, ids.userA, ids.studentB, ids.userB],
    );
    await pool.query(
      `INSERT INTO student_academic_enrollments
       (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt") VALUES
       ($1, $2, 'eds-maths-terminale', 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW()),
       ($3, $4, 'eds-nsi-terminale', 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
      [randomUUID(), ids.studentA, randomUUID(), ids.studentB],
    );
    await pool.query(
      `INSERT INTO aria_conversations
       (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $2, 'eds-maths-terminale', 'ACTIVE', NOW())`,
      [ids.conversation, ids.studentA],
    );
    await pool.query(
      `INSERT INTO aria_messages
       (id, "conversationId", role, content, status, feedback, "createdAt") VALUES
       ($1, $4, 'assistant', 'insert', 'COMPLETED', TRUE, NOW()),
       ($2, $4, 'assistant', 'equal', 'COMPLETED', FALSE, NOW()),
       ($3, $4, 'assistant', 'conflict', 'COMPLETED', TRUE, NOW())`,
      [ids.feedbackInsertMessage, ids.feedbackEqualMessage, ids.feedbackConflictMessage, ids.conversation],
    );
    await pool.query(
      `INSERT INTO aria_feedbacks
       (id, "messageId", "studentId", useful, "createdAt", "updatedAt") VALUES
       ($1, $2, $3, FALSE, NOW(), NOW()),
       ($4, $5, $3, FALSE, NOW(), NOW())`,
      [
        ids.equalFeedback, ids.feedbackEqualMessage, ids.studentA,
        ids.conflictFeedback, ids.feedbackConflictMessage,
      ],
    );
    await pool.query(
      `INSERT INTO aria_learning_profiles
       (id, "studentId", "selectedCourseKeys", "uiPreferences", "preferencesVersion",
        "pinnedCourseKeys", "focusedCourseKey", "courseOrder", "showCitations", "createdAt", "updatedAt") VALUES
       ($1, $2, '[]'::jsonb, '{}'::jsonb, 1, '[]'::jsonb, NULL, '[]'::jsonb, TRUE, NOW(), NOW()),
       ($3, $4, '["eds-nsi-terminale"]'::jsonb, '{"theme":"dark"}'::jsonb,
        1, '[]'::jsonb, NULL, '[]'::jsonb, TRUE, NOW(), NOW())`,
      [ids.profileA, ids.studentA, ids.profileB, ids.studentB],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[ids.userA, ids.userB, ids.parentUser]]);
    await pool.end();
  });

  it('dry-runs, applies exact classifications, preserves conflicts and never infers pins', async () => {
    const options = {
      runId: ids.runId,
      sourceDigest: '4'.repeat(64),
    };
    await expect(backfillAriaFeedbackProfiles(pool, {
      ...options, mode: 'DRY_RUN',
    })).resolves.toEqual({
      feedback: { scanned: 3, deterministic: 2, manualReview: 1, mutated: 0 },
      profiles: { scanned: 2, deterministic: 1, manualReview: 1, mutated: 0 },
    });
    await expect(backfillAriaFeedbackProfiles(pool, {
      ...options, mode: 'APPLY',
    })).resolves.toEqual({
      feedback: { scanned: 3, deterministic: 2, manualReview: 1, mutated: 1 },
      profiles: { scanned: 2, deterministic: 1, manualReview: 1, mutated: 0 },
    });

    const canonical = await pool.query(
      `SELECT "messageId", useful FROM aria_feedbacks
       WHERE "messageId" = ANY($1::text[]) ORDER BY "messageId"`,
      [[ids.feedbackInsertMessage, ids.feedbackEqualMessage, ids.feedbackConflictMessage]],
    );
    expect(new Map(canonical.rows.map((row) => [row.messageId, row.useful]))).toEqual(new Map([
      [ids.feedbackInsertMessage, true],
      [ids.feedbackEqualMessage, false],
      [ids.feedbackConflictMessage, false],
    ]));
    const profiles = await pool.query(
      `SELECT "studentId", "selectedCourseKeys", "pinnedCourseKeys"
       FROM aria_learning_profiles WHERE "studentId" = ANY($1::text[]) ORDER BY "studentId"`,
      [[ids.studentA, ids.studentB]],
    );
    expect(profiles.rows.find((row) => row.studentId === ids.studentB)).toMatchObject({
      selectedCourseKeys: ['eds-nsi-terminale'],
      pinnedCourseKeys: [],
    });
    const audit = await pool.query(
      `SELECT "sourceType", classification::text, count(*)::int AS count
       FROM aria_data_migration_row_audits WHERE "runId" = $1
       GROUP BY "sourceType", classification ORDER BY "sourceType", classification`,
      [ids.runId],
    );
    expect(audit.rows).toEqual([
      { sourceType: 'ARIA_LEARNING_PROFILE', classification: 'DETERMINISTIC_BACKFILL', count: 1 },
      { sourceType: 'ARIA_LEARNING_PROFILE', classification: 'MANUAL_REVIEW_REQUIRED', count: 1 },
      { sourceType: 'ARIA_MESSAGE_FEEDBACK', classification: 'DETERMINISTIC_BACKFILL', count: 2 },
      { sourceType: 'ARIA_MESSAGE_FEEDBACK', classification: 'MANUAL_REVIEW_REQUIRED', count: 1 },
    ]);
  });

  it('is rerunnable and rolls back only the canonical feedback it inserted', async () => {
    const rerun = await backfillAriaFeedbackProfiles(pool, {
      runId: ids.runId,
      sourceDigest: '4'.repeat(64),
      mode: 'APPLY',
    });
    expect(rerun.feedback.mutated).toBe(0);
    const rollback = await rollbackAriaFeedbackProfileBackfill(pool, ids.runId);
    expect(rollback).toEqual({ feedbackDeleted: 1, profilesRestored: 0 });
    const rows = await pool.query(
      'SELECT "messageId" FROM aria_feedbacks WHERE "messageId" = ANY($1::text[])',
      [[ids.feedbackInsertMessage, ids.feedbackEqualMessage, ids.feedbackConflictMessage]],
    );
    expect(rows.rows.map((row) => row.messageId).sort()).toEqual([
      ids.feedbackConflictMessage,
      ids.feedbackEqualMessage,
    ].sort());
  });

  it('persists and reads complete preferences while leaving legacy selection untouched', async () => {
    const updated = await replaceAriaLearningProfileForActor({
      actor: { userId: ids.userB, role: 'ELEVE' },
      preferences: {
        version: 1,
        pinnedCourseKeys: ['eds-nsi-terminale'],
        focusedCourseKey: 'eds-nsi-terminale',
        courseOrder: ['eds-nsi-terminale'],
        showCitations: false,
      },
    });
    expect(updated.preferences).toMatchObject({
      version: 1,
      pinnedCourseKeys: ['eds-nsi-terminale'],
      showCitations: false,
    });
    await expect(getAriaLearningProfileForActor({
      actor: { userId: ids.userB, role: 'ELEVE' },
    })).resolves.toEqual(updated);
    const legacy = await pool.query(
      'SELECT "selectedCourseKeys", "uiPreferences" FROM aria_learning_profiles WHERE "studentId" = $1',
      [ids.studentB],
    );
    expect(legacy.rows).toEqual([{
      selectedCourseKeys: ['eds-nsi-terminale'],
      uiPreferences: { theme: 'dark' },
    }]);
  });
});
