/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  backfillAriaFeedbackProfiles,
  rollbackAriaFeedbackProfileBackfill,
  type AriaFeedbackProfileBackfillReport,
} from '@/scripts/aria/backfill-feedback-profile';
import { stableLegacyFingerprint } from '@/scripts/aria/audit-legacy-data';
import {
  getAriaLearningProfileForActor,
  replaceAriaLearningProfileForActor,
} from '@/lib/aria/application/profile/public';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

async function waitForDatabaseCondition(
  condition: () => Promise<boolean>,
  timeoutMs = 2_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}

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
    feedbackDriftMessage: randomUUID(),
    equalFeedback: randomUUID(),
    conflictFeedback: randomUUID(),
    profileA: randomUUID(),
    profileB: randomUUID(),
    runId: randomUUID(),
    driftRunId: randomUUID(),
    driftAuditRunId: randomUUID(),
    driftDetectionRunId: randomUUID(),
    driftDetectionAuditRunId: randomUUID(),
  };

  async function sealDryRun(
    runId: string,
    report: AriaFeedbackProfileBackfillReport,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "archivedCount", "manualReviewCount",
         "mutatedCount", "completedAt")
       VALUES ($1, 'aria-feedback-profile-v1', 'DRY_RUN', $2::jsonb, $3, 'COMPLETED',
               $4, $5, 0, $6, 0, NOW())`,
      [
        runId,
        JSON.stringify(report.sourceSnapshot),
        report.sourceDigest,
        report.feedback.scanned + report.profiles.scanned,
        report.feedback.deterministic + report.profiles.deterministic,
        report.feedback.manualReview + report.profiles.manualReview,
      ],
    );
  }

  interface ForgedB4Audit {
    readonly sourceType: 'ARIA_MESSAGE_FEEDBACK' | 'ARIA_LEARNING_PROFILE';
    readonly sourceId: string;
    readonly sourceFingerprint: string;
    readonly classification: 'DETERMINISTIC_BACKFILL' | 'MANUAL_REVIEW_REQUIRED';
    readonly targetTable: string | null;
    readonly targetId: string | null;
    readonly targetKey: unknown;
    readonly beforeImage: unknown;
  }

  async function expectForgedB4TerminalRejected(input: Readonly<{
    audits: readonly ForgedB4Audit[];
    scannedCount?: number;
    deterministicCount?: number;
    manualReviewCount?: number;
    mutatedCount?: number;
    setup?: (client: import('pg').PoolClient) => Promise<void>;
  }>): Promise<void> {
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const sourceDigest = randomUUID().replaceAll('-', '').repeat(2);
    const scannedCount = input.scannedCount ?? input.audits.length;
    const deterministicCount = input.deterministicCount
      ?? input.audits.filter(({ classification }) =>
        classification === 'DETERMINISTIC_BACKFILL').length;
    const manualReviewCount = input.manualReviewCount
      ?? input.audits.filter(({ classification }) =>
        classification === 'MANUAL_REVIEW_REQUIRED').length;
    const sourceSnapshot = {
      schemaVersion: 1,
      target: 'feedback-profile',
      plannerVersion: 1,
      inputDigests: { feedbackProfileContract: 'a'.repeat(64) },
      unitsSha256: 'b'.repeat(64),
      report: {
        scanned: scannedCount,
        deterministic: deterministicCount,
        archived: 0,
        manualReview: manualReviewCount,
      },
      sourceSnapshotSha256: sourceDigest,
    };
    const client = await pool.connect();
    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "scannedCount", "deterministicCount", "archivedCount", "manualReviewCount",
           "mutatedCount", "completedAt")
         VALUES ($1, 'aria-feedback-profile-v1', 'DRY_RUN', $2::jsonb, $3, 'COMPLETED',
                 $4, $5, 0, $6, 0, NOW())`,
        [
          prerequisiteRunId,
          JSON.stringify(sourceSnapshot),
          sourceDigest,
          scannedCount,
          deterministicCount,
          manualReviewCount,
        ],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId")
         VALUES ($1, 'aria-feedback-profile-v1', 'APPLY', $2::jsonb, $3,
                 'RUNNING', $4)`,
        [runId, JSON.stringify(sourceSnapshot), sourceDigest, prerequisiteRunId],
      );
      await input.setup?.(client);
      for (const audit of input.audits) {
        await client.query(
          `INSERT INTO aria_data_migration_row_audits
            (id, "runId", "sourceType", "sourceId", "sourceFingerprint",
             classification, "targetTable", "targetId", "targetKey", "beforeImage")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)`,
          [
            randomUUID(),
            runId,
            audit.sourceType,
            audit.sourceId,
            audit.sourceFingerprint,
            audit.classification,
            audit.targetTable,
            audit.targetId,
            JSON.stringify(audit.targetKey),
            JSON.stringify(audit.beforeImage),
          ],
        );
      }
      const outcome = await client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = $2,
             "deterministicCount" = $3, "archivedCount" = 0,
             "manualReviewCount" = $4, "mutatedCount" = $5,
             "completedAt" = NOW()
         WHERE id = $1 AND status = 'RUNNING'`,
        [
          runId,
          scannedCount,
          deterministicCount,
          manualReviewCount,
          input.mutatedCount ?? 0,
        ],
      ).then(() => 'RESOLVED', (error: Error) => error.message);
      expect(outcome).toContain('APPLY terminal evidence does not match row audits');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

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

  it('B4_TERMINAL_REJECTS_MISSING_OR_WRONG_SOURCE_TYPE_AUDITS', async () => {
    await expectForgedB4TerminalRejected({
      audits: [],
      scannedCount: 1,
      deterministicCount: 1,
    });
    await expectForgedB4TerminalRejected({
      audits: [{
        sourceType: 'ARIA_LEARNING_PROFILE',
        sourceId: ids.feedbackEqualMessage,
        sourceFingerprint: stableLegacyFingerprint({
          messageId: ids.feedbackEqualMessage,
          conversationId: ids.conversation,
          studentId: ids.studentA,
          feedback: false,
        }),
        classification: 'DETERMINISTIC_BACKFILL',
        targetTable: 'aria_learning_profiles',
        targetId: ids.profileA,
        targetKey: {
          action: 'CANONICAL_NOOP',
          reasonCode: 'LEGACY_EMPTY_CANONICAL_VALID',
        },
        beforeImage: {},
      }],
    });
  });

  it('B4_TERMINAL_REJECTS_FORGED_FEEDBACK_TARGET_OWNERSHIP_VALUE_OR_FINGERPRINT', async () => {
    const validSourceFingerprint = stableLegacyFingerprint({
      messageId: ids.feedbackEqualMessage,
      conversationId: ids.conversation,
      studentId: ids.studentA,
      feedback: false,
    });
    const matchingTargetKey = {
      action: 'CANONICAL_NOOP',
      afterFingerprint: null,
      created: false,
      reasonCode: 'TARGET_MATCHES',
    };
    await expectForgedB4TerminalRejected({
      audits: [{
        sourceType: 'ARIA_MESSAGE_FEEDBACK',
        sourceId: ids.feedbackEqualMessage,
        sourceFingerprint: 'f'.repeat(64),
        classification: 'DETERMINISTIC_BACKFILL',
        targetTable: 'aria_feedbacks',
        targetId: ids.equalFeedback,
        targetKey: matchingTargetKey,
        beforeImage: { feedback: false },
      }],
    });

    const foreignFeedbackId = randomUUID();
    await expectForgedB4TerminalRejected({
      setup: async (client) => {
        await client.query(
          `INSERT INTO aria_feedbacks
            (id, "messageId", "studentId", useful, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, FALSE, NOW(), NOW())`,
          [foreignFeedbackId, ids.feedbackEqualMessage, ids.studentB],
        );
      },
      audits: [{
        sourceType: 'ARIA_MESSAGE_FEEDBACK',
        sourceId: ids.feedbackEqualMessage,
        sourceFingerprint: validSourceFingerprint,
        classification: 'DETERMINISTIC_BACKFILL',
        targetTable: 'aria_feedbacks',
        targetId: foreignFeedbackId,
        targetKey: matchingTargetKey,
        beforeImage: { feedback: false },
      }],
    });

    await expectForgedB4TerminalRejected({
      audits: [{
        sourceType: 'ARIA_MESSAGE_FEEDBACK',
        sourceId: ids.feedbackConflictMessage,
        sourceFingerprint: stableLegacyFingerprint({
          messageId: ids.feedbackConflictMessage,
          conversationId: ids.conversation,
          studentId: ids.studentA,
          feedback: true,
        }),
        classification: 'DETERMINISTIC_BACKFILL',
        targetTable: 'aria_feedbacks',
        targetId: ids.conflictFeedback,
        targetKey: matchingTargetKey,
        beforeImage: { feedback: true },
      }],
    });
  });

  it('B4_TERMINAL_REJECTS_FORGED_PROFILE_TARGET_OR_SOURCE_FINGERPRINT', async () => {
    const validSourceFingerprint = stableLegacyFingerprint({
      profileId: ids.profileA,
      studentId: ids.studentA,
      selectedCourseKeys: [],
      uiPreferences: {},
    });
    const targetKey = {
      action: 'CANONICAL_NOOP',
      reasonCode: 'LEGACY_EMPTY_CANONICAL_VALID',
    };
    await expectForgedB4TerminalRejected({
      audits: [{
        sourceType: 'ARIA_LEARNING_PROFILE',
        sourceId: ids.profileA,
        sourceFingerprint: validSourceFingerprint,
        classification: 'DETERMINISTIC_BACKFILL',
        targetTable: 'aria_learning_profiles',
        targetId: ids.profileB,
        targetKey,
        beforeImage: {},
      }],
    });
    await expectForgedB4TerminalRejected({
      audits: [{
        sourceType: 'ARIA_LEARNING_PROFILE',
        sourceId: ids.profileA,
        sourceFingerprint: 'e'.repeat(64),
        classification: 'DETERMINISTIC_BACKFILL',
        targetTable: 'aria_learning_profiles',
        targetId: ids.profileA,
        targetKey,
        beforeImage: {},
      }],
    });
  });

  it.each([
    ['exponent numbers', { large: 1e21, small: 1e-7 }],
    ['Unicode keys ordered by JavaScript UTF-16', Object.fromEntries(
      ['\u{10000}', '\uE000'].sort().map((key, index) => [key, index + 1]),
    )],
  ] as const)(
    'B4_PROFILE_SOURCE_FINGERPRINT_SQL_MATCHES_NODE_FOR_%s',
    async (_label, uiPreferences) => {
      const source = {
        profileId: ids.profileA,
        studentId: ids.studentA,
        selectedCourseKeys: [],
        uiPreferences,
      };
      const sourceCanonicalJson = JSON.stringify(source);
      const result = await pool.query<{
        fingerprint: string;
        payloadMatches: boolean;
      }>(
        `SELECT
           aria_profile_legacy_source_sha256($1::text) AS fingerprint,
           aria_profile_legacy_source_payload_valid(
             $1::text, $2, $3, $4::jsonb, $5::jsonb
           ) AS "payloadMatches"`,
        [
          sourceCanonicalJson,
          source.profileId,
          source.studentId,
          JSON.stringify(source.selectedCourseKeys),
          JSON.stringify(source.uiPreferences),
        ],
      );
      expect(result.rows).toEqual([{
        fingerprint: stableLegacyFingerprint(source),
        payloadMatches: true,
      }]);
    },
  );

  it('B4_TERMINAL_REJECTS_COUNT_AND_MUTATED_COUNT_DIVERGENCE', async () => {
    await expectForgedB4TerminalRejected({
      audits: [{
        sourceType: 'ARIA_MESSAGE_FEEDBACK',
        sourceId: ids.feedbackEqualMessage,
        sourceFingerprint: stableLegacyFingerprint({
          messageId: ids.feedbackEqualMessage,
          conversationId: ids.conversation,
          studentId: ids.studentA,
          feedback: false,
        }),
        classification: 'DETERMINISTIC_BACKFILL',
        targetTable: 'aria_feedbacks',
        targetId: ids.equalFeedback,
        targetKey: {
          action: 'CANONICAL_NOOP',
          afterFingerprint: null,
          created: false,
          reasonCode: 'TARGET_MATCHES',
        },
        beforeImage: { feedback: false },
      }],
      mutatedCount: 1,
    });
  });

  it('B4_APPLY_REJECTS_SAME_COUNT_SOURCE_SNAPSHOT_DRIFT', async () => {
    const dryRun = await backfillAriaFeedbackProfiles(pool, {
      runId: ids.driftDetectionRunId,
      sourceDigest: '4'.repeat(64),
      mode: 'DRY_RUN',
    });
    await sealDryRun(ids.driftDetectionAuditRunId, dryRun);
    await pool.query(
      'UPDATE aria_messages SET feedback = TRUE WHERE id = $1',
      [ids.feedbackEqualMessage],
    );
    await pool.query(
      'UPDATE aria_feedbacks SET useful = TRUE WHERE id = $1',
      [ids.equalFeedback],
    );
    const outcome = await backfillAriaFeedbackProfiles(pool, {
      runId: ids.driftDetectionRunId,
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: ids.driftDetectionAuditRunId,
      mode: 'APPLY',
    }).then(() => 'RESOLVED', (error: Error) => error.message);
    await pool.query(
      'UPDATE aria_messages SET feedback = FALSE WHERE id = $1',
      [ids.feedbackEqualMessage],
    );
    await pool.query(
      'UPDATE aria_feedbacks SET useful = FALSE WHERE id = $1',
      [ids.equalFeedback],
    );
    if (outcome === 'RESOLVED') {
      await rollbackAriaFeedbackProfileBackfill(pool, ids.driftDetectionRunId);
    }

    expect(outcome).toBe('ARIA_FEEDBACK_PROFILE_SOURCE_SNAPSHOT_MISMATCH');
    await expect(pool.query(
      `SELECT COUNT(*)::integer AS count FROM aria_data_migration_runs
       WHERE id = $1 AND mode = 'APPLY'`,
      [ids.driftDetectionRunId],
    )).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });

  it('D019 dry-runs, applies exact classifications, preserves conflicts and never infers pins', async () => {
    const dryRun = await backfillAriaFeedbackProfiles(pool, {
      runId: ids.runId, sourceDigest: '4'.repeat(64), mode: 'DRY_RUN',
    });
    expect(dryRun).toMatchObject({
      feedback: { scanned: 3, deterministic: 2, manualReview: 1, mutated: 0 },
      profiles: { scanned: 2, deterministic: 1, manualReview: 1, mutated: 0 },
    });
    expect(dryRun.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(dryRun.sourceSnapshot).toMatchObject({
      target: 'feedback-profile',
      report: { scanned: 5, deterministic: 3, manualReview: 2, archived: 0 },
    });
    const applied = await backfillAriaFeedbackProfiles(pool, {
      runId: ids.runId,
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: ids.driftDetectionAuditRunId,
      mode: 'APPLY',
    });
    expect(applied).toMatchObject({
      feedback: { scanned: 3, deterministic: 2, manualReview: 1, mutated: 1 },
      profiles: { scanned: 2, deterministic: 1, manualReview: 1, mutated: 0 },
    });
    expect(applied.sourceDigest).toBe(dryRun.sourceDigest);
    expect(applied.sourceSnapshot).toEqual(dryRun.sourceSnapshot);

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

  it('B4_COMPLETED_ROW_AUDIT_IS_IMMUTABLE', async () => {
    const audit = await pool.query<{ id: string; sourceFingerprint: string }>(
      `SELECT id, "sourceFingerprint" FROM aria_data_migration_row_audits
       WHERE "runId" = $1 ORDER BY id LIMIT 1`,
      [ids.runId],
    );
    const row = audit.rows[0];
    const changed = '0'.repeat(64);
    const client = await pool.connect();
    await client.query('BEGIN');
    const updateOutcome = await client.query(
      'UPDATE aria_data_migration_row_audits SET "sourceFingerprint" = $2 WHERE id = $1',
      [row.id, changed],
    ).then(() => 'RESOLVED', (error: { code?: string }) => error.code ?? 'REJECTED');
    await client.query('ROLLBACK');

    await client.query('BEGIN');
    const deleteOutcome = await client.query(
      'DELETE FROM aria_data_migration_row_audits WHERE id = $1',
      [row.id],
    ).then(() => 'RESOLVED', (error: { code?: string }) => error.code ?? 'REJECTED');
    await client.query('ROLLBACK');
    client.release();
    expect(updateOutcome).not.toBe('RESOLVED');
    expect(deleteOutcome).not.toBe('RESOLVED');
    await expect(pool.query(
      'SELECT "sourceFingerprint" FROM aria_data_migration_row_audits WHERE id = $1',
      [row.id],
    )).resolves.toMatchObject({ rows: [{ sourceFingerprint: row.sourceFingerprint }] });
  });

  it('B4_TERMINAL_RUN_CANNOT_REOPEN_OR_CHANGE_SEALED_EVIDENCE', async () => {
    const original = await pool.query<{
      status: string;
      sourceDigest: string;
      scannedCount: number;
    }>(
      `SELECT status::text, "sourceDigest", "scannedCount"
       FROM aria_data_migration_runs WHERE id = $1`,
      [ids.runId],
    );
    const client = await pool.connect();
    await client.query('BEGIN');
    const reopenOutcome = await client.query(
      `UPDATE aria_data_migration_runs SET status = 'RUNNING' WHERE id = $1`,
      [ids.runId],
    ).then(() => 'RESOLVED', (error: { code?: string }) => error.code ?? 'REJECTED');
    await client.query('ROLLBACK');

    await client.query('BEGIN');
    const evidenceOutcome = await client.query(
      `UPDATE aria_data_migration_runs
       SET "sourceDigest" = $2, "scannedCount" = "scannedCount" + 1
       WHERE id = $1`,
      [ids.runId, 'f'.repeat(64)],
    ).then(() => 'RESOLVED', (error: { code?: string }) => error.code ?? 'REJECTED');
    await client.query('ROLLBACK');
    client.release();

    expect(reopenOutcome).not.toBe('RESOLVED');
    expect(evidenceOutcome).not.toBe('RESOLVED');
    await expect(pool.query(
      `SELECT status::text, "sourceDigest", "scannedCount"
       FROM aria_data_migration_runs WHERE id = $1`,
      [ids.runId],
    )).resolves.toMatchObject({ rows: [original.rows[0]] });
  });

  it('B4_ROW_AUDIT_IS_INSERT_ONLY_WHILE_RUN_IS_RUNNING', async () => {
    const runId = randomUUID();
    const auditId = randomUUID();
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status)
       VALUES ($1, $2, 'DRY_RUN', '{}'::jsonb, $3, 'RUNNING')`,
      [runId, `aria-test-insert-only-${runId}`, runId.replaceAll('-', '').repeat(2)],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint",
         classification, "beforeImage")
       VALUES ($1, $2, 'ARIA_MESSAGE_FEEDBACK', $3, $4,
               'DETERMINISTIC_BACKFILL', '{"feedback":true}'::jsonb)`,
      [auditId, runId, randomUUID(), 'a'.repeat(64)],
    );

    const client = await pool.connect();
    await client.query('BEGIN');
    const updateOutcome = await client.query(
      `UPDATE aria_data_migration_row_audits
       SET "sourceFingerprint" = $2 WHERE id = $1`,
      [auditId, 'b'.repeat(64)],
    ).then(() => 'RESOLVED', (error: { code?: string }) => error.code ?? 'REJECTED');
    await client.query('ROLLBACK');
    await client.query('BEGIN');
    const deleteOutcome = await client.query(
      'DELETE FROM aria_data_migration_row_audits WHERE id = $1',
      [auditId],
    ).then(() => 'RESOLVED', (error: { code?: string }) => error.code ?? 'REJECTED');
    await client.query('ROLLBACK');
    client.release();

    expect(updateOutcome).not.toBe('RESOLVED');
    expect(deleteOutcome).not.toBe('RESOLVED');
    await expect(pool.query(
      'SELECT "sourceFingerprint" FROM aria_data_migration_row_audits WHERE id = $1',
      [auditId],
    )).resolves.toMatchObject({ rows: [{ sourceFingerprint: 'a'.repeat(64) }] });
  });

  it('B4_AUDIT_INSERT_SERIALIZES_WITH_TERMINAL_FINALIZATION', async () => {
    const runId = randomUUID();
    const auditId = randomUUID();
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status)
       VALUES ($1, $2, 'DRY_RUN', '{}'::jsonb, $3, 'RUNNING')`,
      [runId, `aria-test-terminal-race-${runId}`, runId.replaceAll('-', '').repeat(2)],
    );
    const finalizer = await pool.connect();
    const auditor = await pool.connect();
    let finalizerCommitted = false;
    let auditInsert: Promise<unknown> | undefined;
    try {
      await finalizer.query('BEGIN');
      await finalizer.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "completedAt" = NOW() WHERE id = $1`,
        [runId],
      );
      auditInsert = auditor.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint",
           classification, "beforeImage")
         VALUES ($1, $2, 'ARIA_MESSAGE_FEEDBACK', $3, $4,
                 'DETERMINISTIC_BACKFILL', '{"feedback":true}'::jsonb)`,
        [auditId, runId, randomUUID(), 'c'.repeat(64)],
      );
      const beforeCommit = await Promise.race([
        auditInsert.then(() => 'RESOLVED', () => 'REJECTED'),
        new Promise<'PENDING'>((resolve) => setTimeout(() => resolve('PENDING'), 50)),
      ]);
      expect(beforeCommit).toBe('PENDING');
      await finalizer.query('COMMIT');
      finalizerCommitted = true;
      await expect(auditInsert).rejects.toThrow('terminal ARIA migration audit evidence is immutable');
    } finally {
      if (!finalizerCommitted) await finalizer.query('ROLLBACK');
      await Promise.allSettled([auditInsert].filter(Boolean));
      finalizer.release();
      auditor.release();
    }
    await expect(pool.query(
      'SELECT COUNT(*)::integer AS count FROM aria_data_migration_row_audits WHERE id = $1',
      [auditId],
    )).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });

  it('replays the persisted seal after source drift and rolls back only its canonical feedback', async () => {
    const persisted = await pool.query<{ sourceDigest: string }>(
      'SELECT "sourceDigest" FROM aria_data_migration_runs WHERE id = $1',
      [ids.runId],
    );
    const rerunSourceDigest = persisted.rows[0].sourceDigest;
    await pool.query(
      'UPDATE aria_messages SET feedback = FALSE WHERE id = $1',
      [ids.feedbackInsertMessage],
    );
    const rerun = await backfillAriaFeedbackProfiles(pool, {
      runId: ids.runId,
      sourceDigest: rerunSourceDigest,
      prerequisiteRunId: ids.driftDetectionAuditRunId,
      mode: 'APPLY',
    });
    expect(rerun).toMatchObject({
      feedback: { scanned: 3, deterministic: 2, manualReview: 1, mutated: 1 },
      profiles: { scanned: 2, deterministic: 1, manualReview: 1, mutated: 0 },
    });
    expect(rerun.sourceSnapshot.report).toEqual({
      scanned: 5, deterministic: 3, archived: 0, manualReview: 2,
    });
    await pool.query(
      'UPDATE aria_messages SET feedback = TRUE WHERE id = $1',
      [ids.feedbackInsertMessage],
    );
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

  it('B4_ROLLBACK_PRESERVES_CANONICAL_FEEDBACK_UPDATED_AFTER_APPLY', async () => {
    await pool.query(
      `INSERT INTO aria_messages
       (id, "conversationId", role, content, status, feedback, "createdAt")
       VALUES ($1, $2, 'assistant', 'drift', 'COMPLETED', TRUE, NOW())`,
      [ids.feedbackDriftMessage, ids.conversation],
    );
    const dryRun = await backfillAriaFeedbackProfiles(pool, {
      runId: ids.driftRunId,
      sourceDigest: '5'.repeat(64),
      mode: 'DRY_RUN',
    });
    await sealDryRun(ids.driftAuditRunId, dryRun);
    const applied = await backfillAriaFeedbackProfiles(pool, {
      runId: ids.driftRunId,
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: ids.driftAuditRunId,
      mode: 'APPLY',
    });
    expect(applied.sourceDigest).toBe(dryRun.sourceDigest);
    await pool.query(
      `UPDATE aria_feedbacks SET reason = 'student-updated', "updatedAt" = NOW()
       WHERE "messageId" = $1`,
      [ids.feedbackDriftMessage],
    );

    await expect(rollbackAriaFeedbackProfileBackfill(pool, ids.driftRunId))
      .rejects.toThrow('ARIA_FEEDBACK_PROFILE_ROLLBACK_FINGERPRINT_CONFLICT');
    await expect(pool.query(
      'SELECT useful, reason FROM aria_feedbacks WHERE "messageId" = $1',
      [ids.feedbackDriftMessage],
    )).resolves.toMatchObject({
      rowCount: 1,
      rows: [{ useful: true, reason: 'student-updated' }],
    });
    await expect(pool.query(
      'SELECT status::text FROM aria_data_migration_runs WHERE id = $1',
      [ids.driftRunId],
    )).resolves.toMatchObject({ rows: [{ status: 'COMPLETED' }] });
  });

  it('B4_ROLLBACK_REJECTS_FOREIGN_OR_DRY_RUN_IDENTITY', async () => {
    const foreignIds = [randomUUID(), randomUUID()];
    const foreignDigests = foreignIds.map((id) => id.replaceAll('-', '').repeat(2));
    const foreignPrerequisiteId = randomUUID();
    await pool.query(
      `INSERT INTO aria_data_migration_runs
       (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status, "completedAt")
       VALUES
        ($1, 'aria-feedback-profile-v1', 'DRY_RUN', '{}'::jsonb, $2, 'COMPLETED', NOW()),
        ($3, 'aria-entitlements-v1', 'DRY_RUN', '{}'::jsonb, $4, 'COMPLETED', NOW())`,
      [
        foreignIds[0], foreignDigests[0], foreignPrerequisiteId, foreignDigests[1],
      ],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-entitlements-v1', 'APPLY', '{}'::jsonb, $2,
               'RUNNING', $3)`,
      [foreignIds[1], foreignDigests[1], foreignPrerequisiteId],
    );
    for (const runId of foreignIds) {
      const outcome = await rollbackAriaFeedbackProfileBackfill(pool, runId)
        .then(() => 'RESOLVED', (error: Error) => error.message);
      if (outcome === 'RESOLVED') {
        await pool.query(
          `UPDATE aria_data_migration_runs SET status = 'COMPLETED' WHERE id = $1`,
          [runId],
        );
      }
      expect(outcome).toBe('ARIA_FEEDBACK_PROFILE_ROLLBACK_RUN_NOT_COMPLETED');
    }
    await expect(pool.query(
      'SELECT id, status::text FROM aria_data_migration_runs WHERE id = ANY($1::text[]) ORDER BY id',
      [foreignIds],
    )).resolves.toMatchObject({
      rows: [
        { id: foreignIds[0], status: 'COMPLETED' },
        { id: foreignIds[1], status: 'RUNNING' },
      ].sort((left, right) => left.id.localeCompare(right.id)),
    });
  });

  it('B4_REAL_PG_IDENTICAL_WRITER_AND_SAME_DIGEST_APPLY_CONVERGE_ON_ONE_SEALED_RUN', async () => {
    const messageId = randomUUID();
    const runId = randomUUID();
    const auditRunId = randomUUID();
    const advisoryKey = 4_204_001;
    await pool.query(
      `INSERT INTO aria_messages
       (id, "conversationId", role, content, status, feedback, "createdAt")
       VALUES ($1, $2, 'assistant', 'identical race', 'COMPLETED', TRUE, NOW())`,
      [messageId, ids.conversation],
    );
    const dryRun = await backfillAriaFeedbackProfiles(pool, {
      runId, sourceDigest: 'a'.repeat(64), mode: 'DRY_RUN',
    });
    await sealDryRun(auditRunId, dryRun);
    await pool.query(
      `CREATE FUNCTION aria_test_pause_feedback_backfill_insert() RETURNS trigger
       LANGUAGE plpgsql AS $function$
       BEGIN
         IF current_setting('application_name') = 'aria-b4-worker'
            AND NEW."messageId" = TG_ARGV[0] THEN
           PERFORM pg_advisory_xact_lock(TG_ARGV[1]::bigint);
         END IF;
         RETURN NEW;
       END
       $function$`,
    );
    await pool.query(
      `CREATE TRIGGER aria_test_pause_feedback_backfill_insert
       BEFORE INSERT ON aria_feedbacks FOR EACH ROW
       EXECUTE FUNCTION aria_test_pause_feedback_backfill_insert('${messageId}', '${advisoryKey}')`,
    );
    const workerPool = new Pool({
      connectionString: databaseUrl,
      max: 2,
      application_name: 'aria-b4-worker',
    });
    await expect(workerPool.query<{ applicationName: string }>(
      `SELECT current_setting('application_name') AS "applicationName"`,
    )).resolves.toMatchObject({ rows: [{ applicationName: 'aria-b4-worker' }] });
    const blocker = await pool.connect();
    let barrierReleased = false;
    let first: ReturnType<typeof backfillAriaFeedbackProfiles> | undefined;
    let second: ReturnType<typeof backfillAriaFeedbackProfiles> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT pg_advisory_xact_lock($1)', [advisoryKey]);
      const options = {
        runId,
        sourceDigest: dryRun.sourceDigest,
        prerequisiteRunId: auditRunId,
        mode: 'APPLY' as const,
      };
      first = backfillAriaFeedbackProfiles(workerPool, options);
      const reachedBarrier = await waitForDatabaseCondition(async () => {
        const waiting = await blocker.query(
          `SELECT 1 FROM pg_stat_activity
           WHERE application_name = 'aria-b4-worker' AND wait_event = 'advisory'`,
        );
        return (waiting.rowCount ?? 0) > 0;
      });
      if (!reachedBarrier) {
        const outcome = await Promise.race([
          first.then(() => 'resolved', (error: Error) => `rejected:${error.message}`),
          new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 20)),
        ]);
        const activity = await blocker.query(
          `SELECT application_name, state, "wait_event_type", wait_event, left(query, 160) AS query
           FROM pg_stat_activity WHERE datname = current_database() ORDER BY pid`,
        );
        throw new Error(`ARIA_TEST_B4_INSERT_BARRIER_NOT_REACHED:${outcome}:${JSON.stringify(activity.rows)}`);
      }
      second = backfillAriaFeedbackProfiles(workerPool, options);
      await blocker.query('COMMIT');
      barrierReleased = true;
      const reports = await Promise.all([first, second]);
      expect(reports[1]).toEqual(reports[0]);
      expect(reports[0].sourceDigest).toBe(dryRun.sourceDigest);
    } finally {
      if (!barrierReleased) await blocker.query('ROLLBACK');
      await Promise.allSettled([first, second].filter(Boolean));
      blocker.release();
      await workerPool.end();
      await pool.query('DROP TRIGGER IF EXISTS aria_test_pause_feedback_backfill_insert ON aria_feedbacks');
      await pool.query('DROP FUNCTION IF EXISTS aria_test_pause_feedback_backfill_insert()');
    }
    await expect(pool.query(
      `SELECT COUNT(*)::integer AS count FROM aria_feedbacks WHERE "messageId" = $1`,
      [messageId],
    )).resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(pool.query(
      `SELECT COUNT(*)::integer AS count FROM aria_data_migration_runs
       WHERE id = $1 AND status = 'COMPLETED'`,
      [runId],
    )).resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(pool.query(
      `SELECT "targetKey"->>'created' AS created
       FROM aria_data_migration_row_audits
       WHERE "runId" = $1 AND "sourceId" = $2`,
      [runId, messageId],
    )).resolves.toMatchObject({ rows: [{ created: 'true' }] });
  });

  it('B4_REAL_PG_CANONICAL_WRITER_SERIALIZES_AND_INVALIDATES_IDENTICAL_OR_OPPOSITE_AUDIT', async () => {
    for (const useful of [true, false]) {
      const messageId = randomUUID();
      const runId = randomUUID();
      const auditRunId = randomUUID();
      await pool.query(
        `INSERT INTO aria_messages
         (id, "conversationId", role, content, status, feedback, "createdAt")
         VALUES ($1, $2, 'assistant', 'canonical writer race', 'COMPLETED', TRUE, NOW())`,
        [messageId, ids.conversation],
      );
      const dryRun = await backfillAriaFeedbackProfiles(pool, {
        runId, sourceDigest: 'b'.repeat(64), mode: 'DRY_RUN',
      });
      await sealDryRun(auditRunId, dryRun);
      const workerPool = new Pool({
        connectionString: databaseUrl,
        max: 1,
        application_name: 'aria-b4-worker',
      });
      await expect(workerPool.query<{ applicationName: string }>(
        `SELECT current_setting('application_name') AS "applicationName"`,
      )).resolves.toMatchObject({ rows: [{ applicationName: 'aria-b4-worker' }] });
      const concurrent = await pool.connect();
      let committed = false;
      let apply: ReturnType<typeof backfillAriaFeedbackProfiles> | undefined;
      try {
        await concurrent.query('BEGIN');
        await concurrent.query(
          `INSERT INTO aria_feedbacks
           (id, "messageId", "studentId", useful, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [randomUUID(), messageId, ids.studentA, useful],
        );
        apply = backfillAriaFeedbackProfiles(workerPool, {
          runId,
          sourceDigest: dryRun.sourceDigest,
          prerequisiteRunId: auditRunId,
          mode: 'APPLY',
        });
        const reachedWriterLock = await waitForDatabaseCondition(async () => {
          const waiting = await concurrent.query(
            `SELECT 1 FROM pg_stat_activity
             WHERE application_name = 'aria-b4-worker' AND "wait_event_type" = 'Lock'`,
          );
          return (waiting.rowCount ?? 0) > 0;
        });
        if (!reachedWriterLock) {
          const outcome = await Promise.race([
            apply.then(() => 'resolved', (error: Error) => `rejected:${error.message}`),
            new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 20)),
          ]);
          const activity = await concurrent.query(
            `SELECT application_name, state, "wait_event_type", wait_event, left(query, 160) AS query
             FROM pg_stat_activity WHERE datname = current_database() ORDER BY pid`,
          );
          throw new Error(`ARIA_TEST_B4_WRITER_LOCK_NOT_REACHED:${outcome}:${JSON.stringify(activity.rows)}`);
        }
        await concurrent.query('COMMIT');
        committed = true;
        await expect(apply).rejects.toThrow('ARIA_FEEDBACK_PROFILE_SOURCE_SNAPSHOT_MISMATCH');
      } finally {
        if (!committed) await concurrent.query('ROLLBACK');
        await Promise.allSettled([apply].filter(Boolean));
        concurrent.release();
        await workerPool.end();
      }
      await expect(pool.query(
        `SELECT useful FROM aria_feedbacks WHERE "messageId" = $1`,
        [messageId],
      )).resolves.toMatchObject({ rows: [{ useful }] });
      await expect(pool.query(
        'SELECT COUNT(*)::integer AS count FROM aria_data_migration_runs WHERE id = $1',
        [runId],
      )).resolves.toMatchObject({ rows: [{ count: 0 }] });
      await expect(pool.query(
        'SELECT COUNT(*)::integer AS count FROM aria_data_migration_row_audits WHERE "runId" = $1',
        [runId],
      )).resolves.toMatchObject({ rows: [{ count: 0 }] });
    }
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
