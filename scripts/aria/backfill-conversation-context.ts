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
  type AriaBackfillSourceSnapshot,
} from './backfill-snapshot';

export type LegacyContextEvidence = LegacyContextEvidenceContract;

export interface ConversationContextBackfillOptions {
  readonly runId: string;
  readonly mode: 'DRY_RUN' | 'APPLY';
  readonly sourceDigest: string;
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

function sourceSnapshot(options: ConversationContextBackfillOptions): object {
  return {
    evidenceDigest: options.sourceDigest,
    sourceTypes: ['conversation', 'skill', 'resource', 'academic-map'],
    version: 1,
  };
}

export async function backfillConversationContexts(
  client: PoolClient,
  options: ConversationContextBackfillOptions,
): Promise<ConversationContextBackfillReport> {
  const result = await client.query<LegacyConversationContextRow>(
    `SELECT id, "studentId", subject::text, "skillId", "resourceId", "courseKey",
            "contextState"::text
     FROM aria_conversations
     WHERE "contextState" = 'LEGACY_CONTEXT_UNRESOLVED'
     ORDER BY id`,
  );
  const plan = planConversationContextBackfill(result.rows, options.evidence);
  const { decisions } = plan;
  const { deterministic, archived, manualReview } = plan.report;

  if (options.mode === 'DRY_RUN') {
    return plan.report;
  }

  await client.query(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
       "startedAt")
     VALUES ($1, 'aria-conversation-context-v1', 'APPLY', $2::jsonb, $3, 'RUNNING', NOW())
     ON CONFLICT (id) DO NOTHING`,
    [options.runId, JSON.stringify(sourceSnapshot(options)), options.sourceDigest],
  );

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
        [row.id, decision.courseKey, options.runId],
      );
      if (update.rowCount === 1) {
        mutated += 1;
        targetId = row.id;
      }
    }
    await client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage", "createdAt")
       VALUES ($1, $2, 'ARIA_CONVERSATION', $3, $4, $5,
               $6, $7, $8::jsonb, $9::jsonb, NOW())
       ON CONFLICT ("runId", "sourceType", "sourceId") DO NOTHING`,
      [
        randomUUID(),
        options.runId,
        row.id,
        sourceFingerprint,
        decision.classification,
        targetId ? 'aria_conversations' : null,
        targetId,
        JSON.stringify({ courseKey: decision.courseKey, reasonCode: decision.reasonCode }),
        JSON.stringify(beforeImage),
      ],
    );
  }

  await client.query(
    `UPDATE aria_data_migration_runs
     SET status = 'COMPLETED', "scannedCount" = $2,
         "deterministicCount" = $3, "archivedCount" = $4,
         "manualReviewCount" = $5, "mutatedCount" = $6,
         "completedAt" = NOW()
     WHERE id = $1`,
    [options.runId, decisions.length, deterministic, archived, manualReview, mutated],
  );
  return {
    ...plan.report,
    mutated,
  };
}
