import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { stableLegacyFingerprint } from './audit-legacy-data';
import { backfillConversationContexts, type LegacyContextEvidence } from './backfill-conversation-context';
import { backfillConversationTurns } from './backfill-conversation-turns';
import { backfillAriaEntitlements } from './backfill-entitlements';
import { backfillAriaFeedbackProfiles } from './backfill-feedback-profile';
import { assertDisposableAriaBackfillTarget } from './backfill-safety';
import type { AriaBackfillSnapshotTarget } from './backfill-snapshot';

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

interface QueryExecutor {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rowCount: number | null; readonly rows: T[] }>;
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
  readonly scannedCount: number;
  readonly deterministicCount: number;
  readonly archivedCount: number;
  readonly manualReviewCount: number;
}

interface PersistedApplyRunRow extends PersistedAuditRunRow {
  readonly mutatedCount: number;
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
      scannedMessages: number; turnsCreated: number; archivedGroups: number;
    };
    const deterministic = (value.scannedMessages - value.archivedGroups) / 2;
    if (!Number.isInteger(deterministic) || deterministic < 0) {
      throw new Error('ARIA_BACKFILL_AUDIT_REPORT_INVALID');
    }
    return {
      scanned: value.scannedMessages,
      deterministic,
      archived: value.archivedGroups,
      manualReview: 0,
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

async function loadMatchingPersistedAudit(
  client: QueryExecutor,
  command: ParsedAriaBackfillCommand,
): Promise<PersistedAuditRunRow> {
  const result = await client.query<PersistedAuditRunRow>(
    `SELECT status::text, "sourceDigest", "scannedCount", "deterministicCount",
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
  ) {
    throw new Error('ARIA_BACKFILL_MATCHING_AUDIT_REQUIRED');
  }
  return audit;
}

async function sealPersistedAudit(
  client: QueryExecutor,
  command: ParsedAriaBackfillCommand,
  counts: AriaBackfillAuditCounts,
  sourceSnapshot: unknown = {
    inputDigest: command.sourceDigest,
    target: command.target,
    version: 1,
  },
): Promise<void> {
  const existing = await client.query<PersistedAuditRunRow>(
    `SELECT status::text, "sourceDigest", "scannedCount", "deterministicCount",
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
      JSON.stringify(sourceSnapshot),
      command.sourceDigest,
      counts.scanned,
      counts.deterministic,
      counts.archived,
      counts.manualReview,
    ],
  );
  if (inserted.rowCount === 1) return;
  const concurrent = await client.query<PersistedAuditRunRow>(
    `SELECT status::text, "sourceDigest", "scannedCount", "deterministicCount",
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
    || !sameAuditCounts(audit, counts)
  ) {
    throw new Error('ARIA_BACKFILL_AUDIT_CONFLICT');
  }
}

function assertLiveCountsMatchAudit(
  audit: PersistedAuditRunRow,
  target: AriaBackfillTarget,
  report: unknown,
): void {
  if (!sameAuditCounts(audit, normalizeAriaBackfillReport(target, report))) {
    throw new Error('ARIA_BACKFILL_AUDIT_COUNT_MISMATCH');
  }
}

async function loadCompletedApplyReplay(
  client: QueryExecutor,
  command: ParsedAriaBackfillCommand,
): Promise<PersistedApplyRunRow | null> {
  const result = await client.query<PersistedApplyRunRow>(
    `SELECT status::text, "sourceDigest", "scannedCount", "deterministicCount",
            "archivedCount", "manualReviewCount", "mutatedCount"
     FROM aria_data_migration_runs
     WHERE id = $1 AND "migrationName" = $2 AND mode = 'APPLY'
     FOR UPDATE`,
    [command.runId, MIGRATION_NAMES[command.target]],
  );
  if (result.rowCount === 0) return null;
  const run = result.rows[0];
  if (
    result.rowCount !== 1
    || !run
    || run.status !== 'COMPLETED'
    || run.sourceDigest !== command.sourceDigest
  ) {
    throw new Error('ARIA_BACKFILL_APPLY_RUN_NOT_REPLAYABLE');
  }
  return run;
}

function replayReport(run: PersistedApplyRunRow): AriaBackfillCanonicalReport {
  return {
    scanned: run.scannedCount,
    deterministic: run.deterministicCount,
    archived: run.archivedCount,
    manualReview: run.manualReviewCount,
    mutated: run.mutatedCount,
  };
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
    `SELECT status::text, "sourceDigest", "scannedCount", "deterministicCount",
            "archivedCount", "manualReviewCount", "mutatedCount"
     FROM aria_data_migration_runs WHERE id = $1`,
    [input.runId],
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
  const auditResult = await database.query<AuditCountRow>(
    `SELECT COUNT(*)::integer AS "auditCount",
            COUNT(*) FILTER (WHERE classification = 'DETERMINISTIC_BACKFILL')::integer AS deterministic,
            COUNT(*) FILTER (WHERE classification = 'ARCHIVED_NON_RESUMABLE')::integer AS archived,
            COUNT(*) FILTER (WHERE classification = 'MANUAL_REVIEW_REQUIRED')::integer AS manual
     FROM aria_data_migration_row_audits WHERE "runId" = $1`,
    [input.runId],
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
    || targetRows !== run.mutatedCount
    || (input.target !== 'conversation-turns'
      && run.scannedCount !== run.deterministicCount + run.archivedCount + run.manualReviewCount)
  ) {
    throw new Error('ARIA_BACKFILL_VERIFY_COUNT_MISMATCH');
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

    if (command.mode === 'APPLY' && command.target !== 'feedback-profile') {
      const replayClient = await pool.connect();
      try {
        await replayClient.query('BEGIN');
        const replay = await loadCompletedApplyReplay(replayClient, command);
        if (replay) {
          const audit = await loadMatchingPersistedAudit(replayClient, command);
          if (!sameAuditCounts(audit, replayReport(replay))) {
            throw new Error('ARIA_BACKFILL_AUDIT_COUNT_MISMATCH');
          }
        }
        await replayClient.query('COMMIT');
        if (replay) {
          dependencies.write(`${JSON.stringify({
            mode: command.mode,
            replayed: true,
            report: replayReport(replay),
            target: command.target,
          })}\n`);
          return;
        }
      } catch (error) {
        await replayClient.query('ROLLBACK');
        throw error;
      } finally {
        replayClient.release();
      }
    }

    if (command.target === 'entitlements') {
      const options = {
        runId: command.runId,
        sourceDigest: command.sourceDigest,
        now: command.now as Date,
      };
      if (command.mode === 'DRY_RUN') {
        const report = await dependencies.backfillAriaEntitlements(pool, {
          ...options, mode: 'DRY_RUN',
        });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await sealPersistedAudit(
            client,
            command,
            normalizeAriaBackfillReport(command.target, report),
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
          target: command.target,
        })}\n`);
        return;
      }
      const auditClient = await pool.connect();
      let audit: PersistedAuditRunRow;
      try {
        await auditClient.query('BEGIN');
        audit = await loadMatchingPersistedAudit(auditClient, command);
        await auditClient.query('COMMIT');
      } catch (error) {
        await auditClient.query('ROLLBACK');
        throw error;
      } finally {
        auditClient.release();
      }
      const dryRun = await dependencies.backfillAriaEntitlements(pool, {
        ...options, mode: 'DRY_RUN',
      });
      assertLiveCountsMatchAudit(audit, command.target, dryRun);
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
        const canonicalCommand = Object.freeze({
          ...command,
          sourceDigest: report.sourceDigest,
          runId: `feedback-profile-${report.sourceDigest.slice(0, 24)}`,
        });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await sealPersistedAudit(
            client,
            canonicalCommand,
            normalizeAriaBackfillReport(canonicalCommand.target, report),
            report.sourceSnapshot,
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
          sourceDigest: report.sourceDigest,
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
          evidence: dependencies.readEvidence(command.evidencePath as string),
        })
        : dependencies.backfillConversationTurns(client, {
          runId: command.runId,
          mode,
          sourceDigest: command.sourceDigest,
        });
      let report: unknown;
      if (command.mode === 'APPLY') {
        const audit = await loadMatchingPersistedAudit(client, command);
        const dryRun = await runWorker('DRY_RUN');
        assertLiveCountsMatchAudit(audit, command.target, dryRun);
        report = await runWorker('APPLY');
        await client.query('COMMIT');
      } else {
        report = await runWorker('DRY_RUN');
        await client.query('ROLLBACK');
        await client.query('BEGIN');
        await sealPersistedAudit(
          client,
          command,
          normalizeAriaBackfillReport(command.target, report),
        );
        await client.query('COMMIT');
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
