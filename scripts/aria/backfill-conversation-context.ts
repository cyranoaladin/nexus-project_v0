import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  classifyLegacyConversationContextWithEvidence,
  stableLegacyFingerprint,
  type LegacyContextEvidenceContract,
  type LegacyConversationContextRow,
} from './audit-legacy-data';
import {
  createAriaBackfillSnapshot,
  parseAriaBackfillSourceSnapshot,
  type AriaBackfillSourceSnapshot,
} from './backfill-snapshot';

export type LegacyContextEvidence = LegacyContextEvidenceContract;

export interface ConversationContextBackfillOptions {
  readonly runId: string;
  readonly mode: 'DRY_RUN' | 'APPLY';
  readonly sourceDigest: string;
  readonly prerequisiteRunId?: string;
  readonly evidence: LegacyContextEvidence;
}

export interface ConversationContextBackfillReport {
  readonly scanned: number;
  readonly deterministic: number;
  readonly archived: number;
  readonly manualReview: number;
  readonly mutated: number;
  readonly sourceDigest: string;
  readonly sourceSnapshot: AriaBackfillSourceSnapshot;
}

export interface ConversationContextBackfillPlan {
  readonly decisions: readonly Readonly<{
    row: LegacyConversationContextRow;
    decision: ReturnType<typeof classifyLegacyConversationContextWithEvidence>['decision'];
    consultedEvidence: ReturnType<typeof classifyLegacyConversationContextWithEvidence>['consultedEvidence'];
  }>[];
  readonly report: ConversationContextBackfillReport;
  readonly sourceDigest: string;
  readonly sourceSnapshot: AriaBackfillSourceSnapshot;
}

export function planConversationContextBackfill(
  rows: readonly LegacyConversationContextRow[],
  evidence: LegacyContextEvidence,
): ConversationContextBackfillPlan {
  const decisions = rows.map((row) => {
    const selectedRow = Object.freeze({ ...row });
    const result = classifyLegacyConversationContextWithEvidence(selectedRow, evidence);
    return Object.freeze({
      row: selectedRow,
      decision: Object.freeze({ ...result.decision }),
      consultedEvidence: result.consultedEvidence,
    });
  });
  const deterministic = decisions.filter(
    ({ decision }) => decision.classification === 'DETERMINISTIC_BACKFILL',
  ).length;
  const archived = decisions.filter(
    ({ decision }) => decision.classification === 'ARCHIVED_NON_RESUMABLE',
  ).length;
  const manualReview = decisions.filter(
    ({ decision }) => decision.classification === 'MANUAL_REVIEW_REQUIRED',
  ).length;
  const counts = Object.freeze({
    scanned: decisions.length,
    deterministic,
    archived,
    manualReview,
  });
  const snapshot = createAriaBackfillSnapshot({
    target: 'conversation-context',
    plannerVersion: 1,
    inputs: {
      classifierContract: { version: 1 },
    },
    units: decisions.map(({ row, decision, consultedEvidence }) => ({
      row,
      decision,
      consultedEvidence,
    })),
    report: counts,
  });
  const report = Object.freeze({
    ...counts,
    mutated: 0,
    sourceDigest: snapshot.sourceDigest,
    sourceSnapshot: snapshot.sourceSnapshot,
  });
  return Object.freeze({
    decisions: Object.freeze(decisions),
    report,
    sourceDigest: snapshot.sourceDigest,
    sourceSnapshot: snapshot.sourceSnapshot,
  });
}

async function loadContextPrerequisite(
  client: PoolClient,
  options: ConversationContextBackfillOptions,
): Promise<AriaBackfillSourceSnapshot> {
  if (!options.prerequisiteRunId) {
    throw new Error('ARIA_CONVERSATION_CONTEXT_SOURCE_SNAPSHOT_MISMATCH');
  }
  const result = await client.query<{
    status: string;
    sourceDigest: string;
    sourceSnapshot: unknown;
  }>(
    `SELECT status::text, "sourceDigest", "sourceSnapshot"
     FROM aria_data_migration_runs
     WHERE id = $1 AND "migrationName" = 'aria-conversation-context-v1'
       AND mode = 'DRY_RUN'
     FOR UPDATE`,
    [options.prerequisiteRunId],
  );
  const row = result.rows[0];
  if (
    result.rowCount !== 1
    || !row
    || row.status !== 'COMPLETED'
    || row.sourceDigest !== options.sourceDigest
  ) {
    throw new Error('ARIA_CONVERSATION_CONTEXT_SOURCE_SNAPSHOT_MISMATCH');
  }
  try {
    const snapshot = parseAriaBackfillSourceSnapshot(row.sourceSnapshot, 'conversation-context');
    if (snapshot.sourceSnapshotSha256 !== options.sourceDigest) throw new Error();
    return snapshot;
  } catch {
    throw new Error('ARIA_CONVERSATION_CONTEXT_SOURCE_SNAPSHOT_MISMATCH');
  }
}

async function replayCompletedContextRun(
  client: PoolClient,
  options: ConversationContextBackfillOptions,
): Promise<ConversationContextBackfillReport | null> {
  const result = await client.query<{
    status: string;
    prerequisiteRunId: string | null;
    sourceDigest: string;
    sourceSnapshot: unknown;
    scannedCount: number;
    deterministicCount: number;
    archivedCount: number;
    manualReviewCount: number;
    mutatedCount: number;
  }>(
    `SELECT status::text, "prerequisiteRunId", "sourceDigest", "sourceSnapshot",
            "scannedCount", "deterministicCount", "archivedCount",
            "manualReviewCount", "mutatedCount"
     FROM aria_data_migration_runs
     WHERE id = $1 AND "migrationName" = 'aria-conversation-context-v1'
       AND mode = 'APPLY'
     FOR UPDATE`,
    [options.runId],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  if (
    result.rowCount !== 1
    || !row
    || row.status !== 'COMPLETED'
    || row.prerequisiteRunId !== options.prerequisiteRunId
    || row.sourceDigest !== options.sourceDigest
  ) {
    throw new Error('ARIA_CONVERSATION_CONTEXT_BACKFILL_RUN_NOT_REPLAYABLE');
  }
  const prerequisite = await loadContextPrerequisite(client, options);
  try {
    const snapshot = parseAriaBackfillSourceSnapshot(row.sourceSnapshot, 'conversation-context');
    if (snapshot.sourceSnapshotSha256 !== prerequisite.sourceSnapshotSha256) throw new Error();
    return {
      scanned: row.scannedCount,
      deterministic: row.deterministicCount,
      archived: row.archivedCount,
      manualReview: row.manualReviewCount,
      mutated: row.mutatedCount,
      sourceDigest: row.sourceDigest,
      sourceSnapshot: snapshot,
    };
  } catch {
    throw new Error('ARIA_CONVERSATION_CONTEXT_BACKFILL_RUN_NOT_REPLAYABLE');
  }
}

export async function backfillConversationContexts(
  client: PoolClient,
  options: ConversationContextBackfillOptions,
): Promise<ConversationContextBackfillReport> {
  if (options.mode === 'APPLY') {
    const replay = await replayCompletedContextRun(client, options);
    if (replay) return replay;
  }
  const result = await client.query<LegacyConversationContextRow>(
    `SELECT id, "studentId", subject::text, "skillId", "resourceId", "courseKey",
            "contextState"::text
     FROM aria_conversations
     WHERE "contextState" = 'LEGACY_CONTEXT_UNRESOLVED'
     ORDER BY id
     FOR UPDATE`,
  );
  const plan = planConversationContextBackfill(result.rows, options.evidence);
  const { decisions } = plan;
  const { deterministic, archived, manualReview } = plan.report;

  if (options.mode === 'DRY_RUN') {
    return plan.report;
  }

  const replayAfterSourceLock = await replayCompletedContextRun(client, options);
  if (replayAfterSourceLock) return replayAfterSourceLock;
  const prerequisite = await loadContextPrerequisite(client, options);
  if (
    options.sourceDigest !== plan.sourceDigest
    || prerequisite.sourceSnapshotSha256 !== plan.sourceSnapshot.sourceSnapshotSha256
  ) {
    throw new Error('ARIA_CONVERSATION_CONTEXT_SOURCE_SNAPSHOT_MISMATCH');
  }

  const run = await client.query<{ id: string }>(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
       "prerequisiteRunId", "startedAt")
     VALUES ($1, 'aria-conversation-context-v1', 'APPLY', $2::jsonb, $3,
             'RUNNING', $4, NOW())
     ON CONFLICT ("migrationName", "sourceDigest", mode) DO NOTHING
     RETURNING id`,
    [
      options.runId,
      JSON.stringify(plan.sourceSnapshot),
      plan.sourceDigest,
      options.prerequisiteRunId,
    ],
  );
  if (run.rowCount === 0) {
    const replay = await replayCompletedContextRun(client, options);
    if (!replay) throw new Error('ARIA_CONVERSATION_CONTEXT_BACKFILL_RUN_NOT_REPLAYABLE');
    return replay;
  }
  const runId = run.rows[0].id;

  let mutated = 0;
  for (const { row, decision } of decisions) {
    const beforeImage = {
      contextState: row.contextState,
      courseKey: row.courseKey,
      resourceId: row.resourceId,
      skillId: row.skillId,
      subject: row.subject,
    };
    const sourceFingerprint = stableLegacyFingerprint({
      id: row.id,
      studentId: row.studentId,
      ...beforeImage,
    });
    let targetId: string | null = null;
    if (decision.classification === 'DETERMINISTIC_BACKFILL' && decision.courseKey) {
      const update = await client.query<{ id: string }>(
        `UPDATE aria_conversations
         SET "courseKey" = $2, "contextState" = 'ACTIVE',
             "contextMigrationRunId" = $3, "updatedAt" = NOW()
         WHERE id = $1 AND "courseKey" IS NULL
           AND "contextState" = 'LEGACY_CONTEXT_UNRESOLVED'
         RETURNING id`,
        [row.id, decision.courseKey, runId],
      );
      if (update.rowCount !== 1 || update.rows[0]?.id !== row.id) {
        throw new Error('ARIA_CONVERSATION_CONTEXT_BACKFILL_UPDATE_CONFLICT');
      }
      mutated += 1;
      targetId = row.id;
    }
    const auditInsertion = await client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage", "createdAt")
       VALUES ($1, $2, 'ARIA_CONVERSATION', $3, $4, $5,
               $6, $7, $8::jsonb, $9::jsonb, NOW())`,
      [
        randomUUID(),
        runId,
        row.id,
        sourceFingerprint,
        decision.classification,
        targetId ? 'aria_conversations' : null,
        targetId,
        JSON.stringify({ courseKey: decision.courseKey, reasonCode: decision.reasonCode }),
        JSON.stringify(beforeImage),
      ],
    );
    if (auditInsertion.rowCount !== 1) {
      throw new Error('ARIA_CONVERSATION_CONTEXT_BACKFILL_AUDIT_INSERT_CONFLICT');
    }
  }

  const terminal = await client.query(
    `UPDATE aria_data_migration_runs
     SET status = 'COMPLETED', "scannedCount" = $2,
         "deterministicCount" = $3, "archivedCount" = $4,
         "manualReviewCount" = $5, "mutatedCount" = $6,
         "completedAt" = NOW()
     WHERE id = $1 AND status = 'RUNNING'`,
    [runId, decisions.length, deterministic, archived, manualReview, mutated],
  );
  if (terminal.rowCount !== 1) {
    throw new Error('ARIA_CONVERSATION_CONTEXT_BACKFILL_TERMINAL_CONFLICT');
  }
  return {
    ...plan.report,
    mutated,
  };
}
