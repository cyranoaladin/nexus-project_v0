import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { stableLegacyFingerprint } from './audit-legacy-data';
import { backfillConversationContexts, type LegacyContextEvidence } from './backfill-conversation-context';
import {
  backfillConversationTurns,
  parseConversationTurnMessageAuditBeforeImage,
  parseConversationTurnTargetKey,
  validateCompletedTurnEvidence,
} from './backfill-conversation-turns';
import { backfillAriaEntitlements } from './backfill-entitlements';
import { backfillAriaFeedbackProfiles } from './backfill-feedback-profile';
import { assertDisposableAriaBackfillTarget } from './backfill-safety';
import {
  parseAriaBackfillSourceSnapshot,
  type AriaBackfillSnapshotTarget,
  type AriaBackfillSourceSnapshot,
} from './backfill-snapshot';

interface SerializedEvidence {
  readonly skillCourseCandidates: Record<string, readonly string[]>;
  readonly resourceCourseCandidates: Record<string, readonly string[]>;
  readonly academicSubjectCandidates: Record<string, readonly string[]>;
}

export type AriaBackfillTarget = AriaBackfillSnapshotTarget;

export interface ParsedAriaBackfillCommand {
  readonly target: AriaBackfillTarget;
  readonly mode: 'DRY_RUN' | 'APPLY' | 'VERIFY';
  readonly databaseUrl: string;
  readonly sourceDigest: string;
  readonly runId: string;
  readonly evidencePath?: string;
  readonly now?: Date;
}

interface AriaBackfillVerificationReport {
  readonly scanned: number;
  readonly deterministic: number;
  readonly archived: number;
  readonly manualReview: number;
  readonly mutated: number;
  readonly auditRows: number;
  readonly targetRows: number;
}

type QueryExecutor = Pick<PoolClient, 'query'>;

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
  const run = await client.query<{
    status: string;
    migrationName: string;
    mode: string;
    sourceSnapshot: unknown;
    scannedCount: number;
    deterministicCount: number;
    archivedCount: number;
    manualReviewCount: number;
    mutatedCount: number;
  }>(
    `SELECT status::text, "migrationName", mode::text, "sourceSnapshot",
            "scannedCount", "deterministicCount", "archivedCount",
            "manualReviewCount", "mutatedCount"
     FROM aria_data_migration_runs WHERE id = $1 FOR UPDATE`,
    [runId],
  );
  const migrationRun = run.rows[0];
  const isTurnRun = migrationRun?.migrationName === 'aria-conversation-turns-v1';
  const isContextRun = migrationRun?.migrationName === 'aria-conversation-context-v1';
  if (
    run.rowCount !== 1
    || !migrationRun
    || migrationRun.status !== 'COMPLETED'
    || migrationRun.mode !== 'APPLY'
    || (!isTurnRun && !isContextRun)
  ) {
    throw new Error('ARIA_BACKFILL_ROLLBACK_RUN_NOT_COMPLETED');
  }
  if (isTurnRun) {
    try {
      const snapshot = parseAriaBackfillSourceSnapshot(
        migrationRun.sourceSnapshot,
        'conversation-turns',
      );
      if (snapshot.plannerVersion !== 2) throw new Error();
    } catch {
      throw new Error('ARIA_BACKFILL_ROLLBACK_RUN_NOT_COMPLETED');
    }
    await client.query('LOCK TABLE aria_conversation_turns IN SHARE ROW EXCLUSIVE MODE');
    await client.query('LOCK TABLE aria_messages IN SHARE ROW EXCLUSIVE MODE');
    try {
      await validateCompletedTurnEvidence(client, runId, migrationRun, true);
    } catch {
      throw new Error('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
    }
    const dependentTurnRuns = await client.query<{ id: string }>(
      `WITH current_bounds AS (
         SELECT "conversationId", MAX(sequence)::integer AS "maximumSequence"
         FROM aria_conversation_turns
         WHERE "migrationRunId" = $1
         GROUP BY "conversationId"
       )
       SELECT DISTINCT dependent_run.id
       FROM current_bounds current_run
       JOIN aria_conversation_turns dependent_turn
         ON dependent_turn."conversationId" = current_run."conversationId"
        AND dependent_turn.sequence > current_run."maximumSequence"
        AND dependent_turn."migrationRunId" IS DISTINCT FROM $1
       JOIN aria_data_migration_runs dependent_run
         ON dependent_run.id = dependent_turn."migrationRunId"
       WHERE dependent_run."migrationName" = 'aria-conversation-turns-v1'
         AND dependent_run.mode = 'APPLY'
         AND dependent_run.status = 'COMPLETED'
       ORDER BY dependent_run.id`,
      [runId],
    );
    if ((dependentTurnRuns.rowCount ?? 0) > 0) {
      throw new Error('ARIA_BACKFILL_ROLLBACK_DEPENDENCY_CONFLICT');
    }
  }

  const turns = await client.query<{
    id: string;
    classification: 'DETERMINISTIC_BACKFILL';
    targetKey: unknown;
    beforeImage: unknown;
  }>(
    `SELECT t.id, a.classification::text, a."targetKey", a."beforeImage"
     FROM aria_conversation_turns t
     JOIN aria_data_migration_row_audits a
       ON a."runId" = t."migrationRunId"
      AND a."targetId" = t.id
      AND a."sourceType" = 'ARIA_MESSAGE_GROUP'
     WHERE t."migrationRunId" = $1
       AND a.classification = 'DETERMINISTIC_BACKFILL'
     ORDER BY t.id
     FOR UPDATE OF t, a`,
    [runId],
  );
  let turnsDeleted = 0;
  for (const turn of turns.rows) {
    const beforeImage = parseConversationTurnMessageAuditBeforeImage(
      turn.beforeImage,
      turn.classification,
    );
    const targetKey = parseConversationTurnTargetKey(turn.targetKey);
    const unlinked = await client.query(
      `UPDATE aria_messages SET "turnId" = NULL, "turnRole" = NULL
       WHERE "turnId" = $3 AND (
         (id = $1 AND "turnRole" = 'USER')
         OR (id = $2 AND "turnRole" = 'ASSISTANT')
       )`,
      [beforeImage.messageIds[0], beforeImage.messageIds[1], targetKey.turnId],
    );
    if (unlinked.rowCount !== 2) throw new Error('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
    const deletion = await client.query(
      `DELETE FROM aria_conversation_turns
       WHERE id = $1 AND "migrationRunId" = $2 AND "useCase" = 'LEGACY_IMPORT'`,
      [turn.id, runId],
    );
    if (deletion.rowCount !== 1) throw new Error('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
    turnsDeleted += 1;
  }

  const contextAudits = await client.query<ContextRollbackAudit>(
    `SELECT "sourceId", "sourceFingerprint", "targetKey", "beforeImage"
     FROM aria_data_migration_row_audits
     WHERE "runId" = $1 AND "sourceType" = 'ARIA_CONVERSATION'
       AND classification = 'DETERMINISTIC_BACKFILL' AND "targetId" IS NOT NULL
     ORDER BY "sourceId"`,
    [runId],
  );
  if ((contextAudits.rowCount ?? 0) > 0) {
    const conversationIds = contextAudits.rows.map(({ sourceId }) => sourceId);
    const lockedContexts = await client.query<{ id: string }>(
      `SELECT id FROM aria_conversations
       WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      [conversationIds],
    );
    if (lockedContexts.rowCount !== conversationIds.length) {
      throw new Error('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
    }
    const dependentTurnRuns = await client.query<{ id: string }>(
      `SELECT DISTINCT dependent_run.id
       FROM aria_data_migration_runs dependent_run
       JOIN aria_data_migration_row_audits dependent_audit
         ON dependent_audit."runId" = dependent_run.id
        AND dependent_audit."sourceType" = 'ARIA_MESSAGE_GROUP'
       CROSS JOIN LATERAL jsonb_array_elements_text(
         dependent_audit."beforeImage"->'messageIds'
       ) source_message(message_id)
       JOIN aria_messages message ON message.id = source_message.message_id
       WHERE message."conversationId" = ANY($1::text[])
         AND dependent_run."migrationName" = 'aria-conversation-turns-v1'
         AND dependent_run.mode = 'APPLY'
         AND dependent_run.status = 'COMPLETED'
       ORDER BY dependent_run.id`,
      [conversationIds],
    );
    if ((dependentTurnRuns.rowCount ?? 0) > 0) {
      throw new Error('ARIA_BACKFILL_ROLLBACK_DEPENDENCY_CONFLICT');
    }
  }
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

  const terminal = await client.query(
    `UPDATE aria_data_migration_runs
     SET status = 'ROLLED_BACK', "completedAt" = NOW()
     WHERE id = $1 AND status = 'COMPLETED'`,
    [runId],
  );
  if (terminal.rowCount !== 1) throw new Error('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
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

const TARGETS = new Set<AriaBackfillTarget>([
  'conversation-context', 'conversation-turns', 'entitlements', 'feedback-profile',
]);

function argumentAfter(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseAriaBackfillCommand(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): ParsedAriaBackfillCommand {
  const target = argv[0] as AriaBackfillTarget | undefined;
  const selectedModes = [
    argv.includes('--audit') ? 'DRY_RUN' as const : null,
    argv.includes('--apply') ? 'APPLY' as const : null,
    argv.includes('--verify') ? 'VERIFY' as const : null,
  ].filter((mode): mode is ParsedAriaBackfillCommand['mode'] => mode !== null);
  const sourceDigest = argumentAfter(argv, '--source-digest');
  const evidencePath = argumentAfter(argv, '--evidence');
  const databaseUrl = env.DATABASE_URL;
  if (
    !target
    || !TARGETS.has(target)
    || selectedModes.length !== 1
    || !databaseUrl
    || !sourceDigest?.match(/^[0-9a-f]{64}$/)
    || (target === 'conversation-context' && selectedModes[0] !== 'VERIFY' && !evidencePath)
  ) {
    throw new Error('ARIA_BACKFILL_INPUT_REQUIRED');
  }
  if (selectedModes[0] === 'APPLY' && env.ARIA_BACKFILL_APPLY_AUTHORIZATION !== 'M1_EXPLICIT_APPLY') {
    throw new Error('ARIA_BACKFILL_APPLY_NOT_AUTHORIZED');
  }
  assertDisposableAriaBackfillTarget(databaseUrl, env.NEXUS_DISPOSABLE_POSTGRES);
  const nowValue = argumentAfter(argv, '--now');
  const now = target === 'entitlements' && selectedModes[0] !== 'VERIFY'
    ? new Date(nowValue ?? '')
    : undefined;
  if (now && !Number.isFinite(now.getTime())) throw new Error('ARIA_BACKFILL_NOW_REQUIRED');
  return Object.freeze({
    target,
    mode: selectedModes[0],
    databaseUrl,
    sourceDigest,
    runId: `${target}-${sourceDigest.slice(0, 24)}`,
    ...(evidencePath ? { evidencePath } : {}),
    ...(now ? { now } : {}),
  });
}

interface MigrationRunRow {
  readonly status: string;
  readonly sourceDigest: string;
  readonly sourceSnapshot: unknown;
  readonly scannedCount: number;
  readonly deterministicCount: number;
  readonly archivedCount: number;
  readonly manualReviewCount: number;
  readonly mutatedCount: number;
}

interface AuditCountRow {
  readonly auditCount: number;
  readonly deterministic: number;
  readonly archived: number;
  readonly manual: number;
  readonly invalidSources?: number;
  readonly messageCount?: number;
  readonly distinctMessageCount?: number;
}

interface AriaBackfillAuditCounts {
  readonly scanned: number;
  readonly deterministic: number;
  readonly archived: number;
  readonly manualReview: number;
}

interface AriaBackfillCanonicalReport extends AriaBackfillAuditCounts {
  readonly mutated: number;
}

interface PersistedAuditRunRow {
  readonly status: string;
  readonly sourceDigest: string;
  readonly sourceSnapshot: unknown;
  readonly scannedCount: number;
  readonly deterministicCount: number;
  readonly archivedCount: number;
  readonly manualReviewCount: number;
}

const MIGRATION_NAMES: Readonly<Record<AriaBackfillTarget, string>> = Object.freeze({
  'conversation-context': 'aria-conversation-context-v1',
  'conversation-turns': 'aria-conversation-turns-v1',
  entitlements: 'aria-entitlements-v1',
  'feedback-profile': 'aria-feedback-profile-v1',
});

function auditRunId(command: ParsedAriaBackfillCommand): string {
  return `${command.runId}-audit`;
}

function normalizeAriaBackfillReport(
  target: AriaBackfillTarget,
  report: unknown,
): AriaBackfillCanonicalReport {
  if (target === 'conversation-context' || target === 'entitlements') {
    const value = report as {
      scanned: number; deterministic: number; archived: number; manualReview: number; mutated: number;
    };
    return {
      scanned: value.scanned,
      deterministic: value.deterministic,
      archived: value.archived,
      manualReview: value.manualReview,
      mutated: value.mutated,
    };
  }
  if (target === 'conversation-turns') {
    const value = report as {
      scannedMessages: number;
      turnsCreated: number;
      deterministicGroups: number;
      archivedGroups: number;
      manualReviewGroups: number;
    };
    if (
      !Number.isInteger(value.deterministicGroups)
      || !Number.isInteger(value.archivedGroups)
      || !Number.isInteger(value.manualReviewGroups)
      || value.deterministicGroups < 0
      || value.archivedGroups < 0
      || value.manualReviewGroups < 0
      || value.scannedMessages !== (2 * value.deterministicGroups)
        + value.archivedGroups + value.manualReviewGroups
    ) {
      throw new Error('ARIA_BACKFILL_AUDIT_REPORT_INVALID');
    }
    return {
      scanned: value.scannedMessages,
      deterministic: value.deterministicGroups,
      archived: value.archivedGroups,
      manualReview: value.manualReviewGroups,
      mutated: value.turnsCreated,
    };
  }
  const value = report as {
    feedback: { scanned: number; deterministic: number; manualReview: number; mutated: number };
    profiles: { scanned: number; deterministic: number; manualReview: number; mutated: number };
  };
  return {
    scanned: value.feedback.scanned + value.profiles.scanned,
    deterministic: value.feedback.deterministic + value.profiles.deterministic,
    archived: 0,
    manualReview: value.feedback.manualReview + value.profiles.manualReview,
    mutated: value.feedback.mutated + value.profiles.mutated,
  };
}

function sameAuditCounts(
  persisted: PersistedAuditRunRow,
  current: AriaBackfillAuditCounts,
): boolean {
  return persisted.scannedCount === current.scanned
    && persisted.deterministicCount === current.deterministic
    && persisted.archivedCount === current.archived
    && persisted.manualReviewCount === current.manualReview;
}

function snapshotHasExactCounts(
  snapshot: AriaBackfillSourceSnapshot,
  counts: AriaBackfillAuditCounts,
): boolean {
  return snapshot.report.scanned === counts.scanned
    && snapshot.report.deterministic === counts.deterministic
    && snapshot.report.archived === counts.archived
    && snapshot.report.manualReview === counts.manualReview;
}

function canonicalSealFromReport(
  target: AriaBackfillTarget,
  report: unknown,
): Readonly<{ sourceDigest: string; sourceSnapshot: AriaBackfillSourceSnapshot }> {
  const value = report as { sourceDigest?: unknown; sourceSnapshot?: unknown };
  if (typeof value.sourceDigest !== 'string') {
    throw new Error('ARIA_BACKFILL_AUDIT_SEAL_INVALID');
  }
  try {
    const sourceSnapshot = parseAriaBackfillSourceSnapshot(value.sourceSnapshot, target);
    if (sourceSnapshot.sourceSnapshotSha256 !== value.sourceDigest) throw new Error();
    return Object.freeze({ sourceDigest: value.sourceDigest, sourceSnapshot });
  } catch {
    throw new Error('ARIA_BACKFILL_AUDIT_SEAL_INVALID');
  }
}

function persistedAuditHasExactSeal(
  audit: PersistedAuditRunRow,
  target: AriaBackfillTarget,
): boolean {
  try {
    const snapshot = parseAriaBackfillSourceSnapshot(audit.sourceSnapshot, target);
    return snapshot.sourceSnapshotSha256 === audit.sourceDigest
      && snapshotHasExactCounts(snapshot, {
        scanned: audit.scannedCount,
        deterministic: audit.deterministicCount,
        archived: audit.archivedCount,
        manualReview: audit.manualReviewCount,
      });
  } catch {
    return false;
  }
}

async function loadMatchingPersistedAudit(
  client: QueryExecutor,
  command: ParsedAriaBackfillCommand,
): Promise<PersistedAuditRunRow> {
  const result = await client.query<PersistedAuditRunRow>(
    `SELECT status::text, "sourceDigest", "sourceSnapshot", "scannedCount", "deterministicCount",
            "archivedCount", "manualReviewCount"
     FROM aria_data_migration_runs
     WHERE id = $1 AND "migrationName" = $2 AND mode = 'DRY_RUN'
     FOR UPDATE`,
    [auditRunId(command), MIGRATION_NAMES[command.target]],
  );
  const audit = result.rows[0];
  if (
    result.rowCount !== 1
    || !audit
    || audit.status !== 'COMPLETED'
    || audit.sourceDigest !== command.sourceDigest
    || !persistedAuditHasExactSeal(audit, command.target)
  ) {
    throw new Error('ARIA_BACKFILL_MATCHING_AUDIT_REQUIRED');
  }
  return audit;
}

async function sealPersistedAudit(
  client: QueryExecutor,
  command: ParsedAriaBackfillCommand,
  counts: AriaBackfillAuditCounts,
  sourceSnapshot: AriaBackfillSourceSnapshot,
): Promise<void> {
  const parsedSourceSnapshot = parseAriaBackfillSourceSnapshot(sourceSnapshot, command.target);
  if (parsedSourceSnapshot.sourceSnapshotSha256 !== command.sourceDigest) {
    throw new Error('ARIA_BACKFILL_AUDIT_SEAL_INVALID');
  }
  if (!snapshotHasExactCounts(parsedSourceSnapshot, counts)) {
    throw new Error('ARIA_BACKFILL_AUDIT_COUNT_MISMATCH');
  }
  const existing = await client.query<PersistedAuditRunRow>(
    `SELECT status::text, "sourceDigest", "sourceSnapshot", "scannedCount", "deterministicCount",
            "archivedCount", "manualReviewCount"
     FROM aria_data_migration_runs
     WHERE id = $1 AND "migrationName" = $2 AND mode = 'DRY_RUN'
     FOR UPDATE`,
    [auditRunId(command), MIGRATION_NAMES[command.target]],
  );
  if (existing.rowCount === 1) {
    const audit = existing.rows[0];
    if (
      !audit
      || audit.status !== 'COMPLETED'
      || audit.sourceDigest !== command.sourceDigest
      || !persistedAuditHasExactSeal(audit, command.target)
      || !sameAuditCounts(audit, counts)
    ) {
      throw new Error('ARIA_BACKFILL_AUDIT_CONFLICT');
    }
    return;
  }
  if (existing.rowCount !== 0) throw new Error('ARIA_BACKFILL_AUDIT_CONFLICT');
  const inserted = await client.query<{ readonly id: string }>(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
       "scannedCount", "deterministicCount", "archivedCount", "manualReviewCount",
       "mutatedCount", "startedAt", "completedAt")
     VALUES ($1, $2, 'DRY_RUN', $3::jsonb, $4, 'COMPLETED',
             $5, $6, $7, $8, 0, NOW(), NOW())
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      auditRunId(command),
      MIGRATION_NAMES[command.target],
      JSON.stringify(parsedSourceSnapshot),
      command.sourceDigest,
      counts.scanned,
      counts.deterministic,
      counts.archived,
      counts.manualReview,
    ],
  );
  if (inserted.rowCount === 1) return;
  const concurrent = await client.query<PersistedAuditRunRow>(
    `SELECT status::text, "sourceDigest", "sourceSnapshot", "scannedCount", "deterministicCount",
            "archivedCount", "manualReviewCount"
     FROM aria_data_migration_runs
     WHERE id = $1 AND "migrationName" = $2 AND mode = 'DRY_RUN'
     FOR UPDATE`,
    [auditRunId(command), MIGRATION_NAMES[command.target]],
  );
  const audit = concurrent.rows[0];
  if (
    concurrent.rowCount !== 1
    || !audit
    || audit.status !== 'COMPLETED'
    || audit.sourceDigest !== command.sourceDigest
    || !persistedAuditHasExactSeal(audit, command.target)
    || !sameAuditCounts(audit, counts)
  ) {
    throw new Error('ARIA_BACKFILL_AUDIT_CONFLICT');
  }
}

export async function verifyAriaBackfillRun(
  database: QueryExecutor,
  input: Readonly<{
    target: AriaBackfillTarget;
    runId: string;
    sourceDigest: string;
  }>,
): Promise<AriaBackfillVerificationReport> {
  const runResult = await database.query<MigrationRunRow>(
    `SELECT status::text, "sourceDigest", "sourceSnapshot", "scannedCount", "deterministicCount",
            "archivedCount", "manualReviewCount", "mutatedCount"
     FROM aria_data_migration_runs
     WHERE id = $1 AND "migrationName" = $2 AND mode = 'APPLY'`,
    [input.runId, MIGRATION_NAMES[input.target]],
  );
  const run = runResult.rows[0];
  if (
    runResult.rowCount !== 1
    || !run
    || run.status !== 'COMPLETED'
    || run.sourceDigest !== input.sourceDigest
  ) {
    throw new Error('ARIA_BACKFILL_VERIFY_RUN_NOT_COMPLETED');
  }
  let snapshot: AriaBackfillSourceSnapshot;
  try {
    snapshot = parseAriaBackfillSourceSnapshot(run.sourceSnapshot, input.target);
    if (snapshot.sourceSnapshotSha256 !== run.sourceDigest) throw new Error();
  } catch {
    throw new Error('ARIA_BACKFILL_VERIFY_SEAL_INVALID');
  }
  if (!snapshotHasExactCounts(snapshot, {
    scanned: run.scannedCount,
    deterministic: run.deterministicCount,
    archived: run.archivedCount,
    manualReview: run.manualReviewCount,
  })) {
    throw new Error('ARIA_BACKFILL_VERIFY_COUNT_MISMATCH');
  }
  const expectedSourceTypes: Readonly<Record<AriaBackfillTarget, readonly string[]>> = {
    'conversation-context': ['ARIA_CONVERSATION'],
    'conversation-turns': ['ARIA_MESSAGE_GROUP'],
    entitlements: ['ARIA_SUBSCRIPTION_ENTITLEMENT'],
    'feedback-profile': ['ARIA_MESSAGE_FEEDBACK', 'ARIA_LEARNING_PROFILE'],
  };
  const auditResult = await database.query<AuditCountRow>(
    `SELECT COUNT(*)::integer AS "auditCount",
            COUNT(*) FILTER (WHERE classification = 'DETERMINISTIC_BACKFILL')::integer AS deterministic,
            COUNT(*) FILTER (WHERE classification = 'ARCHIVED_NON_RESUMABLE')::integer AS archived,
            COUNT(*) FILTER (WHERE classification = 'MANUAL_REVIEW_REQUIRED')::integer AS manual,
            COUNT(*) FILTER (WHERE NOT ("sourceType" = ANY($2::text[])))::integer AS "invalidSources",
            COALESCE(SUM(CASE WHEN "sourceType" = 'ARIA_MESSAGE_GROUP'
              THEN jsonb_array_length("beforeImage"->'messageIds') ELSE 0 END), 0)::integer
              AS "messageCount",
            (SELECT COUNT(DISTINCT expanded.message_id)::integer
             FROM aria_data_migration_row_audits message_audit
             CROSS JOIN LATERAL jsonb_array_elements_text(
               message_audit."beforeImage"->'messageIds'
             ) AS expanded(message_id)
             WHERE message_audit."runId" = $1
               AND message_audit."sourceType" = 'ARIA_MESSAGE_GROUP') AS "distinctMessageCount"
     FROM aria_data_migration_row_audits WHERE "runId" = $1`,
    [input.runId, expectedSourceTypes[input.target]],
  );
  const targetSql: Record<AriaBackfillTarget, string> = {
    'conversation-context': `SELECT COUNT(*)::integer AS "targetCount"
      FROM aria_conversations WHERE "contextMigrationRunId" = $1 AND "contextState" = 'ACTIVE'`,
    'conversation-turns': `SELECT COUNT(*)::integer AS "targetCount"
      FROM aria_conversation_turns WHERE "migrationRunId" = $1`,
    entitlements: `SELECT COUNT(DISTINCT entitlement.id)::integer AS "targetCount"
      FROM aria_data_migration_row_audits audit
      JOIN entitlements entitlement ON entitlement.id = audit."targetId"
      WHERE audit."runId" = $1 AND audit."sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
        AND entitlement."productCode" = 'ARIA_ACCESS'`,
    'feedback-profile': `SELECT COUNT(*)::integer AS "targetCount"
      FROM aria_data_migration_row_audits audit
      JOIN aria_feedbacks feedback ON feedback.id = audit."targetId"
      WHERE audit."runId" = $1 AND audit."sourceType" = 'ARIA_MESSAGE_FEEDBACK'
        AND audit."targetKey"->>'created' = 'true'`,
  };
  const targetResult = await database.query<{ readonly targetCount: number }>(
    targetSql[input.target],
    [input.runId],
  );
  const audit = auditResult.rows[0];
  const targetRows = targetResult.rows[0]?.targetCount;
  const expectedAuditRows = input.target === 'conversation-turns'
    ? run.deterministicCount + run.archivedCount + run.manualReviewCount
    : run.scannedCount;
  if (
    !audit
    || targetRows === undefined
    || audit.auditCount !== expectedAuditRows
    || audit.deterministic !== run.deterministicCount
    || audit.archived !== run.archivedCount
    || audit.manual !== run.manualReviewCount
    || (audit.invalidSources ?? 0) !== 0
    || targetRows !== run.mutatedCount
    || (input.target === 'conversation-turns'
      && (
        audit.messageCount !== run.scannedCount
        || audit.distinctMessageCount !== run.scannedCount
        || run.scannedCount !== (2 * run.deterministicCount)
          + run.archivedCount + run.manualReviewCount
        || run.mutatedCount !== run.deterministicCount
      ))
    || (input.target !== 'conversation-turns'
      && run.scannedCount !== run.deterministicCount + run.archivedCount + run.manualReviewCount)
  ) {
    throw new Error('ARIA_BACKFILL_VERIFY_COUNT_MISMATCH');
  }
  if (input.target === 'conversation-turns') {
    await validateCompletedTurnEvidence(database, input.runId, run);
  }
  return Object.freeze({
    scanned: run.scannedCount,
    deterministic: run.deterministicCount,
    archived: run.archivedCount,
    manualReview: run.manualReviewCount,
    mutated: run.mutatedCount,
    auditRows: audit.auditCount,
    targetRows,
  });
}

interface AriaBackfillCommandDependencies {
  readonly createPool: (databaseUrl: string) => Pool;
  readonly readEvidence: (path: string) => LegacyContextEvidence;
  readonly backfillConversationContexts: typeof backfillConversationContexts;
  readonly backfillConversationTurns: typeof backfillConversationTurns;
  readonly backfillAriaEntitlements: typeof backfillAriaEntitlements;
  readonly backfillAriaFeedbackProfiles: typeof backfillAriaFeedbackProfiles;
  readonly write: (value: string) => void;
}

const DEFAULT_DEPENDENCIES: AriaBackfillCommandDependencies = {
  createPool: (databaseUrl) => new Pool({ connectionString: databaseUrl }),
  readEvidence: evidenceFromFile,
  backfillConversationContexts,
  backfillConversationTurns,
  backfillAriaEntitlements,
  backfillAriaFeedbackProfiles,
  write: (value) => process.stdout.write(value),
};

export async function runAriaBackfillCommand(
  input: Readonly<{
    argv: readonly string[];
    env: Readonly<Record<string, string | undefined>>;
  }>,
  overrides: Partial<AriaBackfillCommandDependencies> = {},
): Promise<void> {
  const command = parseAriaBackfillCommand(input.argv, input.env);
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };
  const pool = dependencies.createPool(command.databaseUrl);
  try {
    if (command.mode === 'VERIFY') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN TRANSACTION READ ONLY');
        const report = await verifyAriaBackfillRun(client, command);
        await client.query('COMMIT');
        dependencies.write(`${JSON.stringify({ mode: command.mode, report, target: command.target })}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return;
    }

    if (command.target === 'entitlements') {
      const options = {
        runId: command.runId,
        sourceDigest: command.sourceDigest,
        prerequisiteRunId: auditRunId(command),
        now: command.now as Date,
      };
      if (command.mode === 'DRY_RUN') {
        const report = await dependencies.backfillAriaEntitlements(pool, {
          ...options, mode: 'DRY_RUN',
        });
        const seal = canonicalSealFromReport(command.target, report);
        const canonicalCommand = Object.freeze({
          ...command,
          sourceDigest: seal.sourceDigest,
          runId: `entitlements-${seal.sourceDigest.slice(0, 24)}`,
        });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await sealPersistedAudit(
            client,
            canonicalCommand,
            normalizeAriaBackfillReport(canonicalCommand.target, report),
            seal.sourceSnapshot,
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        dependencies.write(`${JSON.stringify({
          mode: command.mode,
          report: normalizeAriaBackfillReport(command.target, report),
          sourceDigest: seal.sourceDigest,
          target: command.target,
        })}\n`);
        return;
      }
      const report = await dependencies.backfillAriaEntitlements(pool, {
        ...options, mode: 'APPLY',
      });
      dependencies.write(`${JSON.stringify({
        mode: command.mode,
        report: normalizeAriaBackfillReport(command.target, report),
        target: command.target,
      })}\n`);
      return;
    }
    if (command.target === 'feedback-profile') {
      const options = { runId: command.runId, sourceDigest: command.sourceDigest };
      if (command.mode === 'DRY_RUN') {
        const report = await dependencies.backfillAriaFeedbackProfiles(pool, {
          ...options, mode: 'DRY_RUN',
        });
        const seal = canonicalSealFromReport(command.target, report);
        const canonicalCommand = Object.freeze({
          ...command,
          sourceDigest: seal.sourceDigest,
          runId: `feedback-profile-${seal.sourceDigest.slice(0, 24)}`,
        });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await sealPersistedAudit(
            client,
            canonicalCommand,
            normalizeAriaBackfillReport(canonicalCommand.target, report),
            seal.sourceSnapshot,
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        dependencies.write(`${JSON.stringify({
          mode: command.mode,
          report: normalizeAriaBackfillReport(command.target, report),
          sourceDigest: seal.sourceDigest,
          target: command.target,
        })}\n`);
        return;
      }
      const auditClient = await pool.connect();
      try {
        await auditClient.query('BEGIN');
        await loadMatchingPersistedAudit(auditClient, command);
        await auditClient.query('COMMIT');
      } catch (error) {
        await auditClient.query('ROLLBACK');
        throw error;
      } finally {
        auditClient.release();
      }
      const report = await dependencies.backfillAriaFeedbackProfiles(pool, {
        ...options,
        prerequisiteRunId: auditRunId(command),
        mode: 'APPLY',
      });
      dependencies.write(`${JSON.stringify({
        mode: command.mode,
        report: normalizeAriaBackfillReport(command.target, report),
        target: command.target,
      })}\n`);
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const runWorker = (mode: 'DRY_RUN' | 'APPLY') => command.target === 'conversation-context'
        ? dependencies.backfillConversationContexts(client, {
          runId: command.runId,
          mode,
          sourceDigest: command.sourceDigest,
          prerequisiteRunId: auditRunId(command),
          evidence: dependencies.readEvidence(command.evidencePath as string),
        })
        : dependencies.backfillConversationTurns(client, {
          runId: command.runId,
          mode,
          sourceDigest: command.sourceDigest,
          prerequisiteRunId: auditRunId(command),
        });
      let report: unknown;
      if (command.mode === 'APPLY') {
        report = await runWorker('APPLY');
        await client.query('COMMIT');
      } else {
        report = await runWorker('DRY_RUN');
        const seal = canonicalSealFromReport(command.target, report);
        const canonicalCommand = Object.freeze({
          ...command,
          sourceDigest: seal.sourceDigest,
          runId: `${command.target}-${seal.sourceDigest.slice(0, 24)}`,
        });
        await client.query('ROLLBACK');
        await client.query('BEGIN');
        await sealPersistedAudit(
          client,
          canonicalCommand,
          normalizeAriaBackfillReport(canonicalCommand.target, report),
          seal.sourceSnapshot,
        );
        await client.query('COMMIT');
        dependencies.write(`${JSON.stringify({
          mode: command.mode,
          report: normalizeAriaBackfillReport(command.target, report),
          sourceDigest: seal.sourceDigest,
          target: command.target,
        })}\n`);
        return;
      }
      dependencies.write(`${JSON.stringify({
        mode: command.mode,
        report: normalizeAriaBackfillReport(command.target, report),
        target: command.target,
      })}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void runAriaBackfillCommand({ argv: process.argv.slice(2), env: process.env });
}
