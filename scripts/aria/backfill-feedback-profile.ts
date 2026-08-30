import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { stableLegacyFingerprint } from './audit-legacy-data';
import { assertDisposableAriaBackfillTarget } from './run-backfills';

interface LegacyFeedbackRow {
  readonly messageId: string;
  readonly studentId: string;
  readonly feedback: boolean;
  readonly canonicalId: string | null;
  readonly canonicalUseful: boolean | null;
}

interface LegacyProfileRow {
  readonly profileId: string;
  readonly selectedCourseKeys: unknown;
  readonly uiPreferences: unknown;
}

export interface AriaFeedbackProfileBackfillOptions {
  readonly runId: string;
  readonly sourceDigest: string;
  readonly mode: 'DRY_RUN' | 'APPLY';
}

interface BackfillSectionReport {
  readonly scanned: number;
  readonly deterministic: number;
  readonly manualReview: number;
  readonly mutated: number;
}

export interface AriaFeedbackProfileBackfillReport {
  readonly feedback: BackfillSectionReport;
  readonly profiles: BackfillSectionReport;
}

function isEmptyStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

async function executeBackfill(
  client: PoolClient,
  options: AriaFeedbackProfileBackfillOptions,
): Promise<AriaFeedbackProfileBackfillReport> {
  if (!/^[0-9a-f]{64}$/.test(options.sourceDigest)) {
    throw new Error('ARIA_FEEDBACK_PROFILE_SOURCE_DIGEST_INVALID');
  }
  const feedbackRows = await client.query<LegacyFeedbackRow>(
    `SELECT message.id AS "messageId", conversation."studentId", message.feedback,
            canonical.id AS "canonicalId", canonical.useful AS "canonicalUseful"
     FROM aria_messages message
     JOIN aria_conversations conversation ON conversation.id = message."conversationId"
     LEFT JOIN aria_feedbacks canonical
       ON canonical."messageId" = message.id
      AND canonical."studentId" = conversation."studentId"
     WHERE message.feedback IS NOT NULL
     ORDER BY message.id
     FOR UPDATE OF message`,
  );
  const profileRows = await client.query<LegacyProfileRow>(
    `SELECT id AS "profileId", "selectedCourseKeys", "uiPreferences"
     FROM aria_learning_profiles ORDER BY id FOR UPDATE`,
  );
  const feedbackDecisions = feedbackRows.rows.map((row) => ({
    row,
    classification: row.canonicalId && row.canonicalUseful !== row.feedback
      ? 'MANUAL_REVIEW_REQUIRED' as const
      : 'DETERMINISTIC_BACKFILL' as const,
  }));
  const profileDecisions = profileRows.rows.map((row) => ({
    row,
    classification: isEmptyStringArray(row.selectedCourseKeys)
      ? 'DETERMINISTIC_BACKFILL' as const
      : 'MANUAL_REVIEW_REQUIRED' as const,
  }));
  const initialReport: AriaFeedbackProfileBackfillReport = {
    feedback: {
      scanned: feedbackDecisions.length,
      deterministic: feedbackDecisions.filter(({ classification }) =>
        classification === 'DETERMINISTIC_BACKFILL').length,
      manualReview: feedbackDecisions.filter(({ classification }) =>
        classification === 'MANUAL_REVIEW_REQUIRED').length,
      mutated: 0,
    },
    profiles: {
      scanned: profileDecisions.length,
      deterministic: profileDecisions.filter(({ classification }) =>
        classification === 'DETERMINISTIC_BACKFILL').length,
      manualReview: profileDecisions.filter(({ classification }) =>
        classification === 'MANUAL_REVIEW_REQUIRED').length,
      mutated: 0,
    },
  };
  if (options.mode === 'DRY_RUN') return initialReport;

  const run = await client.query<{ id: string }>(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status)
     VALUES ($1, 'aria-feedback-profile-v1', 'APPLY', $2::jsonb, $3, 'RUNNING')
     ON CONFLICT ("migrationName", "sourceDigest", mode)
     DO UPDATE SET status = 'RUNNING', "completedAt" = NULL
     RETURNING id`,
    [
      options.runId,
      JSON.stringify({ sourceTypes: ['ARIA_MESSAGE_FEEDBACK', 'ARIA_LEARNING_PROFILE'], version: 1 }),
      options.sourceDigest,
    ],
  );
  const runId = run.rows[0].id;
  let feedbackMutated = 0;

  for (const { row, classification } of feedbackDecisions) {
    let targetId = row.canonicalId;
    let created = false;
    if (classification === 'DETERMINISTIC_BACKFILL' && !row.canonicalId) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO aria_feedbacks
          (id, "messageId", "studentId", useful, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT ("messageId", "studentId") DO NOTHING
         RETURNING id`,
        [randomUUID(), row.messageId, row.studentId, row.feedback],
      );
      if (inserted.rowCount === 1) {
        targetId = inserted.rows[0].id;
        created = true;
        feedbackMutated += 1;
      } else {
        const canonical = await client.query<{ id: string; useful: boolean }>(
          `SELECT id, useful FROM aria_feedbacks
           WHERE "messageId" = $1 AND "studentId" = $2`,
          [row.messageId, row.studentId],
        );
        if (canonical.rowCount !== 1 || canonical.rows[0].useful !== row.feedback) {
          throw new Error('ARIA_FEEDBACK_BACKFILL_CONCURRENT_CONFLICT');
        }
        targetId = canonical.rows[0].id;
      }
    }
    await client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage")
       VALUES ($1, $2, 'ARIA_MESSAGE_FEEDBACK', $3, $4, $5,
               $6, $7, $8::jsonb, $9::jsonb)
       ON CONFLICT ("runId", "sourceType", "sourceId") DO NOTHING`,
      [
        randomUUID(), runId, row.messageId,
        stableLegacyFingerprint({ feedback: row.feedback }), classification,
        targetId ? 'aria_feedbacks' : null, targetId,
        targetId ? JSON.stringify({ created }) : null,
        JSON.stringify({ feedback: row.feedback }),
      ],
    );
  }

  for (const { row, classification } of profileDecisions) {
    await client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage")
       VALUES ($1, $2, 'ARIA_LEARNING_PROFILE', $3, $4, $5,
               'aria_learning_profiles', $3, $6::jsonb, $7::jsonb)
       ON CONFLICT ("runId", "sourceType", "sourceId") DO NOTHING`,
      [
        randomUUID(), runId, row.profileId,
        stableLegacyFingerprint({
          selectedCourseKeys: row.selectedCourseKeys,
          uiPreferences: row.uiPreferences,
        }),
        classification,
        JSON.stringify({ canonicalPreferencesMutated: false }),
        JSON.stringify({
          selectedCourseKeys: row.selectedCourseKeys,
          uiPreferences: row.uiPreferences,
        }),
      ],
    );
  }

  const scanned = initialReport.feedback.scanned + initialReport.profiles.scanned;
  const deterministic = initialReport.feedback.deterministic + initialReport.profiles.deterministic;
  const manualReview = initialReport.feedback.manualReview + initialReport.profiles.manualReview;
  await client.query(
    `UPDATE aria_data_migration_runs
     SET status = 'COMPLETED', "scannedCount" = $2, "deterministicCount" = $3,
         "archivedCount" = 0, "manualReviewCount" = $4, "mutatedCount" = $5,
         "completedAt" = NOW()
     WHERE id = $1`,
    [runId, scanned, deterministic, manualReview, feedbackMutated],
  );
  return {
    feedback: { ...initialReport.feedback, mutated: feedbackMutated },
    profiles: initialReport.profiles,
  };
}

export async function backfillAriaFeedbackProfiles(
  pool: Pool,
  options: AriaFeedbackProfileBackfillOptions,
): Promise<AriaFeedbackProfileBackfillReport> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const report = await executeBackfill(client, options);
    if (options.mode === 'APPLY') await client.query('COMMIT');
    else await client.query('ROLLBACK');
    return report;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function rollbackAriaFeedbackProfileBackfill(
  pool: Pool,
  runId: string,
): Promise<{ readonly feedbackDeleted: number; readonly profilesRestored: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = await client.query<{ status: string }>(
      'SELECT status::text FROM aria_data_migration_runs WHERE id = $1 FOR UPDATE',
      [runId],
    );
    if (run.rowCount !== 1 || run.rows[0].status !== 'COMPLETED') {
      throw new Error('ARIA_FEEDBACK_PROFILE_ROLLBACK_RUN_NOT_COMPLETED');
    }
    const audits = await client.query<{
      sourceId: string;
      targetId: string;
      sourceFingerprint: string;
      beforeImage: { feedback: boolean };
    }>(
      `SELECT "sourceId", "targetId", "sourceFingerprint", "beforeImage"
       FROM aria_data_migration_row_audits
       WHERE "runId" = $1 AND "sourceType" = 'ARIA_MESSAGE_FEEDBACK'
         AND classification = 'DETERMINISTIC_BACKFILL'
         AND "targetKey"->>'created' = 'true'
       ORDER BY "sourceId" FOR UPDATE`,
      [runId],
    );
    let feedbackDeleted = 0;
    for (const audit of audits.rows) {
      const source = await client.query<{ feedback: boolean; useful: boolean }>(
        `SELECT message.feedback, canonical.useful
         FROM aria_messages message
         JOIN aria_feedbacks canonical ON canonical.id = $2 AND canonical."messageId" = message.id
         WHERE message.id = $1 FOR UPDATE OF message, canonical`,
        [audit.sourceId, audit.targetId],
      );
      if (
        source.rowCount !== 1
        || stableLegacyFingerprint({ feedback: source.rows[0].feedback }) !== audit.sourceFingerprint
        || source.rows[0].useful !== audit.beforeImage.feedback
      ) {
        throw new Error('ARIA_FEEDBACK_PROFILE_ROLLBACK_FINGERPRINT_CONFLICT');
      }
      const deletion = await client.query(
        'DELETE FROM aria_feedbacks WHERE id = $1 AND "messageId" = $2',
        [audit.targetId, audit.sourceId],
      );
      feedbackDeleted += deletion.rowCount ?? 0;
    }
    await client.query(
      `UPDATE aria_data_migration_runs SET status = 'ROLLED_BACK', "completedAt" = NOW()
       WHERE id = $1 AND status = 'COMPLETED'`,
      [runId],
    );
    await client.query('COMMIT');
    return { feedbackDeleted, profilesRestored: 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const apply = process.argv.includes('--apply');
  const digestIndex = process.argv.indexOf('--source-digest');
  const sourceDigest = digestIndex >= 0 ? process.argv[digestIndex + 1] : undefined;
  if (!databaseUrl || !sourceDigest || !/^[0-9a-f]{64}$/.test(sourceDigest)) {
    throw new Error('ARIA_FEEDBACK_PROFILE_BACKFILL_INPUT_REQUIRED');
  }
  if (apply && process.env.ARIA_BACKFILL_APPLY_AUTHORIZATION !== 'M1_EXPLICIT_APPLY') {
    throw new Error('ARIA_BACKFILL_APPLY_NOT_AUTHORIZED');
  }
  assertDisposableAriaBackfillTarget(databaseUrl, process.env.NEXUS_DISPOSABLE_POSTGRES);
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const report = await backfillAriaFeedbackProfiles(pool, {
      runId: `feedback-profile-${sourceDigest.slice(0, 20)}`,
      sourceDigest,
      mode: apply ? 'APPLY' : 'DRY_RUN',
    });
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) void main();
