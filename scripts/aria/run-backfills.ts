import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { stableLegacyFingerprint } from './audit-legacy-data';
import { backfillConversationContexts, type LegacyContextEvidence } from './backfill-conversation-context';
import { backfillConversationTurns } from './backfill-conversation-turns';
import { backfillAriaEntitlements } from './backfill-entitlements';
import { backfillAriaFeedbackProfiles } from './backfill-feedback-profile';
import { assertDisposableAriaBackfillTarget } from './backfill-safety';

export { assertDisposableAriaBackfillTarget } from './backfill-safety';

interface SerializedEvidence {
  readonly skillCourseCandidates: Record<string, readonly string[]>;
  readonly resourceCourseCandidates: Record<string, readonly string[]>;
  readonly academicSubjectCandidates: Record<string, readonly string[]>;
}

export interface LegacyBackfillRollbackReport {
  readonly turnsDeleted: number;
  readonly contextsRestored: number;
}

interface ContextRollbackAudit {
  readonly sourceId: string;
  readonly sourceFingerprint: string;
  readonly targetKey: { courseKey?: string | null } | null;
  readonly beforeImage: {
    contextState: string;
    courseKey: string | null;
    resourceId: string | null;
    skillId: string | null;
    subject: string | null;
  };
}

export async function rollbackLegacyBackfill(
  client: PoolClient,
  runId: string,
): Promise<LegacyBackfillRollbackReport> {
  const run = await client.query<{ status: string }>(
    'SELECT status FROM aria_data_migration_runs WHERE id = $1 FOR UPDATE',
    [runId],
  );
  if (run.rowCount !== 1 || run.rows[0].status !== 'COMPLETED') {
    throw new Error('ARIA_BACKFILL_ROLLBACK_RUN_NOT_COMPLETED');
  }

  const turns = await client.query<{ id: string; sourceFingerprint: string }>(
    `SELECT t.id, a."sourceFingerprint"
     FROM aria_conversation_turns t
     JOIN aria_data_migration_row_audits a
       ON a."runId" = t."migrationRunId"
      AND a."targetId" = t.id
      AND a."sourceType" = 'ARIA_MESSAGE_GROUP'
     WHERE t."migrationRunId" = $1
     ORDER BY t.id
     FOR UPDATE OF t`,
    [runId],
  );
  let turnsDeleted = 0;
  for (const turn of turns.rows) {
    const messages = await client.query<{
      id: string;
      conversationId: string;
      role: string;
      status: string;
    }>(
      `SELECT id, "conversationId", role, status
       FROM aria_messages WHERE "turnId" = $1 ORDER BY "createdAt", id FOR UPDATE`,
      [turn.id],
    );
    const fingerprint = stableLegacyFingerprint({
      conversationId: messages.rows[0]?.conversationId,
      messageIds: messages.rows.map(({ id }) => id),
      roles: messages.rows.map(({ role }) => role),
      statuses: messages.rows.map(({ status }) => status),
    });
    if (messages.rowCount !== 2 || fingerprint !== turn.sourceFingerprint) {
      throw new Error('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
    }
    await client.query(
      'UPDATE aria_messages SET "turnId" = NULL, "turnRole" = NULL WHERE "turnId" = $1',
      [turn.id],
    );
    const deletion = await client.query(
      'DELETE FROM aria_conversation_turns WHERE id = $1 AND "migrationRunId" = $2',
      [turn.id, runId],
    );
    turnsDeleted += deletion.rowCount ?? 0;
  }

  const contextAudits = await client.query<ContextRollbackAudit>(
    `SELECT "sourceId", "sourceFingerprint", "targetKey", "beforeImage"
     FROM aria_data_migration_row_audits
     WHERE "runId" = $1 AND "sourceType" = 'ARIA_CONVERSATION'
       AND classification = 'DETERMINISTIC_BACKFILL' AND "targetId" IS NOT NULL
     ORDER BY "sourceId"`,
    [runId],
  );
  let contextsRestored = 0;
  for (const audit of contextAudits.rows) {
    const current = await client.query<{
      id: string;
      studentId: string;
      subject: string | null;
      skillId: string | null;
      resourceId: string | null;
      courseKey: string | null;
      contextState: string;
      contextMigrationRunId: string | null;
    }>(
      `SELECT id, "studentId", subject::text, "skillId", "resourceId", "courseKey",
              "contextState"::text, "contextMigrationRunId"
       FROM aria_conversations WHERE id = $1 FOR UPDATE`,
      [audit.sourceId],
    );
    const row = current.rows[0];
    const sourceFingerprint = row && stableLegacyFingerprint({
      id: row.id,
      studentId: row.studentId,
      contextState: audit.beforeImage.contextState,
      courseKey: audit.beforeImage.courseKey,
      resourceId: row.resourceId,
      skillId: row.skillId,
      subject: row.subject,
    });
    if (
      !row
      || row.contextMigrationRunId !== runId
      || row.courseKey !== audit.targetKey?.courseKey
      || sourceFingerprint !== audit.sourceFingerprint
    ) {
      throw new Error('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
    }
    const restoration = await client.query(
      `UPDATE aria_conversations
       SET "courseKey" = $2, "contextState" = $3::"AriaConversationContextState",
           "contextMigrationRunId" = NULL, "updatedAt" = NOW()
       WHERE id = $1 AND "contextMigrationRunId" = $4`,
      [audit.sourceId, audit.beforeImage.courseKey, audit.beforeImage.contextState, runId],
    );
    contextsRestored += restoration.rowCount ?? 0;
  }

  await client.query(
    `UPDATE aria_data_migration_runs
     SET status = 'ROLLED_BACK', "completedAt" = NOW()
     WHERE id = $1 AND status = 'COMPLETED'`,
    [runId],
  );
  return { turnsDeleted, contextsRestored };
}

function evidenceFromFile(path: string): LegacyContextEvidence {
  const value = JSON.parse(readFileSync(path, 'utf8')) as SerializedEvidence;
  return {
    skillCourseCandidates: new Map(Object.entries(value.skillCourseCandidates)),
    resourceCourseCandidates: new Map(Object.entries(value.resourceCourseCandidates)),
    academicSubjectCandidates: new Map(Object.entries(value.academicSubjectCandidates)),
  };
}

async function main(): Promise<void> {
  const target = process.argv[2];
  const apply = process.argv.includes('--apply');
  const audit = process.argv.includes('--audit');
  const evidenceIndex = process.argv.indexOf('--evidence');
  const digestIndex = process.argv.indexOf('--source-digest');
  const nowIndex = process.argv.indexOf('--now');
  const evidencePath = evidenceIndex >= 0 ? process.argv[evidenceIndex + 1] : undefined;
  const sourceDigest = digestIndex >= 0 ? process.argv[digestIndex + 1] : undefined;
  const nowValue = nowIndex >= 0 ? process.argv[nowIndex + 1] : undefined;
  const databaseUrl = process.env.DATABASE_URL;
  if (
    !databaseUrl
    || apply === audit
    || !['conversation-context', 'conversation-turns', 'entitlements', 'feedback-profile'].includes(target)
    || !sourceDigest?.match(/^[0-9a-f]{64}$/)
    || (target === 'conversation-context' && !evidencePath)
  ) {
    throw new Error('ARIA_BACKFILL_INPUT_REQUIRED');
  }
  if (apply && process.env.ARIA_BACKFILL_APPLY_AUTHORIZATION !== 'M1_EXPLICIT_APPLY') {
    throw new Error('ARIA_BACKFILL_APPLY_NOT_AUTHORIZED');
  }
  assertDisposableAriaBackfillTarget(
    databaseUrl,
    process.env.NEXUS_DISPOSABLE_POSTGRES,
  );

  const mode = apply ? 'APPLY' as const : 'DRY_RUN' as const;
  const runId = `${target}-${sourceDigest.slice(0, 24)}`;
  const pool = new Pool({ connectionString: databaseUrl });
  if (target === 'entitlements') {
    const now = new Date(nowValue ?? '');
    if (!Number.isFinite(now.getTime())) throw new Error('ARIA_BACKFILL_NOW_REQUIRED');
    const report = await backfillAriaEntitlements(pool, { runId, mode, sourceDigest, now });
    await pool.end();
    process.stdout.write(`${JSON.stringify({ mode, report, target })}\n`);
    return;
  }
  if (target === 'feedback-profile') {
    const report = await backfillAriaFeedbackProfiles(pool, { runId, mode, sourceDigest });
    await pool.end();
    process.stdout.write(`${JSON.stringify({ mode, report, target })}\n`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const report = target === 'conversation-context'
      ? await backfillConversationContexts(client, {
        runId,
        mode,
        sourceDigest,
        evidence: evidenceFromFile(evidencePath as string),
      })
      : await backfillConversationTurns(client, { runId, mode, sourceDigest });
    if (apply) await client.query('COMMIT');
    else await client.query('ROLLBACK');
    process.stdout.write(`${JSON.stringify({ mode, report, target })}\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  void main();
}
