import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ariaLearningPreferencesV1Schema } from '@/lib/aria/domain/profile/preferences';
import { stableLegacyFingerprint } from './audit-legacy-data';
import {
  createAriaBackfillSnapshot,
  parseAriaBackfillSourceSnapshot,
  type AriaBackfillSourceSnapshot,
} from './backfill-snapshot';

export interface LegacyFeedbackBackfillInput {
  readonly messageId: string;
  readonly conversationId: string;
  readonly studentId: string;
  readonly feedback: boolean;
}

export interface CanonicalFeedbackBackfillInput {
  readonly id: string;
  readonly messageId: string;
  readonly studentId: string;
  readonly useful: boolean;
}

export interface LegacyProfileBackfillInput {
  readonly profileId: string;
  readonly studentId: string;
  readonly selectedCourseKeys: unknown;
  readonly uiPreferences: unknown;
  readonly preferencesVersion: number;
  readonly pinnedCourseKeys: unknown;
  readonly focusedCourseKey: string | null;
  readonly courseOrder: unknown;
  readonly showCitations: boolean;
}

export interface AriaFeedbackProfileBackfillOptions {
  readonly runId: string;
  readonly sourceDigest: string;
  readonly prerequisiteRunId?: string;
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
  readonly sourceDigest: string;
  readonly sourceSnapshot: AriaBackfillSourceSnapshot;
}

type FeedbackReasonCode =
  | 'TARGET_ABSENT'
  | 'TARGET_MATCHES'
  | 'TARGET_VALUE_CONFLICT'
  | 'TARGET_OWNER_CONFLICT'
  | 'TARGET_MULTIPLE';

type ProfileReasonCode =
  | 'LEGACY_EMPTY_CANONICAL_VALID'
  | 'LEGACY_SELECTED_COURSES_PRESENT'
  | 'LEGACY_SELECTED_COURSES_INVALID'
  | 'LEGACY_UI_PREFERENCES_PRESENT'
  | 'LEGACY_UI_PREFERENCES_INVALID'
  | 'CANONICAL_PREFERENCES_INVALID';

interface CanonicalProfilePreferences {
  readonly preferencesVersion: number;
  readonly pinnedCourseKeys: unknown;
  readonly focusedCourseKey: string | null;
  readonly courseOrder: unknown;
  readonly showCitations: boolean;
}

export interface AriaFeedbackProfileBackfillPlan {
  readonly feedbackDecisions: readonly Readonly<{
    sourceType: 'ARIA_MESSAGE_FEEDBACK';
    sourceId: string;
    source: Readonly<LegacyFeedbackBackfillInput>;
    targets: readonly Readonly<CanonicalFeedbackBackfillInput>[];
    classification: 'DETERMINISTIC_BACKFILL' | 'MANUAL_REVIEW_REQUIRED';
    action: 'CREATE' | 'CANONICAL_NOOP' | 'MANUAL_NOOP';
    reasonCode: FeedbackReasonCode;
  }>[];
  readonly profileDecisions: readonly Readonly<{
    sourceType: 'ARIA_LEARNING_PROFILE';
    sourceId: string;
    source: Readonly<Pick<
      LegacyProfileBackfillInput,
      'profileId' | 'studentId' | 'selectedCourseKeys' | 'uiPreferences'
    >>;
    canonicalPreferences: Readonly<CanonicalProfilePreferences> | null;
    classification: 'DETERMINISTIC_BACKFILL' | 'MANUAL_REVIEW_REQUIRED';
    action: 'CANONICAL_NOOP' | 'MANUAL_NOOP';
    reasonCode: ProfileReasonCode;
  }>[];
  readonly report: AriaFeedbackProfileBackfillReport;
  readonly sourceDigest: string;
  readonly sourceSnapshot: AriaBackfillSourceSnapshot;
}

interface PersistedFeedbackProfileRun {
  readonly id: string;
  readonly prerequisiteRunId: string | null;
  readonly status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  readonly sourceSnapshot: unknown;
  readonly scannedCount: number;
  readonly deterministicCount: number;
  readonly manualReviewCount: number;
  readonly mutatedCount: number;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cloneFrozenJson(value: unknown, ancestors = new Set<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('ARIA_FEEDBACK_PROFILE_PLAN_JSON_INVALID');
    return value;
  }
  if (typeof value !== 'object' || ancestors.has(value)) {
    throw new Error('ARIA_FEEDBACK_PROFILE_PLAN_JSON_INVALID');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new Error('ARIA_FEEDBACK_PROFILE_PLAN_JSON_INVALID');
      }
      return Object.freeze(value.map((entry) => cloneFrozenJson(entry, ancestors)));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('ARIA_FEEDBACK_PROFILE_PLAN_JSON_INVALID');
    }
    return Object.freeze(Object.fromEntries(
      Object.keys(value).sort().map((key) => [
        key,
        cloneFrozenJson((value as Record<string, unknown>)[key], ancestors),
      ]),
    ));
  } finally {
    ancestors.delete(value);
  }
}

function classifyProfileLegacyState(
  selectedCourseKeys: unknown,
  uiPreferences: unknown,
): { eligible: boolean; reasonCode: ProfileReasonCode } {
  if (!Array.isArray(selectedCourseKeys)) {
    return { eligible: false, reasonCode: 'LEGACY_SELECTED_COURSES_INVALID' };
  }
  if (selectedCourseKeys.length > 0) {
    return { eligible: false, reasonCode: 'LEGACY_SELECTED_COURSES_PRESENT' };
  }
  if (!uiPreferences || typeof uiPreferences !== 'object' || Array.isArray(uiPreferences)) {
    return { eligible: false, reasonCode: 'LEGACY_UI_PREFERENCES_INVALID' };
  }
  if (Object.keys(uiPreferences).length > 0) {
    return { eligible: false, reasonCode: 'LEGACY_UI_PREFERENCES_PRESENT' };
  }
  return { eligible: true, reasonCode: 'LEGACY_EMPTY_CANONICAL_VALID' };
}

export function planAriaFeedbackProfileBackfill(input: Readonly<{
  feedbackSources: readonly LegacyFeedbackBackfillInput[];
  canonicalFeedbacks: readonly CanonicalFeedbackBackfillInput[];
  profiles: readonly LegacyProfileBackfillInput[];
}>): AriaFeedbackProfileBackfillPlan {
  const sourceIdentities = new Set<string>();
  const feedbackSources = input.feedbackSources.map((row) => Object.freeze({
    messageId: row.messageId,
    conversationId: row.conversationId,
    studentId: row.studentId,
    feedback: row.feedback,
  })).sort((left, right) => compareText(left.messageId, right.messageId));
  const targets = input.canonicalFeedbacks.map((row) => Object.freeze({
    id: row.id,
    messageId: row.messageId,
    studentId: row.studentId,
    useful: row.useful,
  })).sort((left, right) => compareText(left.messageId, right.messageId)
    || compareText(left.studentId, right.studentId)
    || compareText(left.id, right.id));
  const targetsByMessage = new Map<string, CanonicalFeedbackBackfillInput[]>();
  for (const target of targets) {
    const entries = targetsByMessage.get(target.messageId) ?? [];
    entries.push(target);
    targetsByMessage.set(target.messageId, entries);
  }
  const feedbackDecisions = feedbackSources.map((source) => {
    const identity = `ARIA_MESSAGE_FEEDBACK:${source.messageId}`;
    if (sourceIdentities.has(identity)) {
      throw new Error('ARIA_FEEDBACK_PROFILE_PLAN_DUPLICATE_SOURCE');
    }
    sourceIdentities.add(identity);
    const matchingTargets = Object.freeze([...(targetsByMessage.get(source.messageId) ?? [])]);
    const ownerConflict = matchingTargets.some(({ studentId }) => studentId !== source.studentId);
    const correctTargets = matchingTargets.filter(({ studentId }) => studentId === source.studentId);
    let classification: 'DETERMINISTIC_BACKFILL' | 'MANUAL_REVIEW_REQUIRED';
    let action: 'CREATE' | 'CANONICAL_NOOP' | 'MANUAL_NOOP';
    let reasonCode: FeedbackReasonCode;
    if (ownerConflict) {
      classification = 'MANUAL_REVIEW_REQUIRED';
      action = 'MANUAL_NOOP';
      reasonCode = 'TARGET_OWNER_CONFLICT';
    } else if (correctTargets.length > 1) {
      classification = 'MANUAL_REVIEW_REQUIRED';
      action = 'MANUAL_NOOP';
      reasonCode = 'TARGET_MULTIPLE';
    } else if (correctTargets.length === 0) {
      classification = 'DETERMINISTIC_BACKFILL';
      action = 'CREATE';
      reasonCode = 'TARGET_ABSENT';
    } else if (correctTargets[0].useful === source.feedback) {
      classification = 'DETERMINISTIC_BACKFILL';
      action = 'CANONICAL_NOOP';
      reasonCode = 'TARGET_MATCHES';
    } else {
      classification = 'MANUAL_REVIEW_REQUIRED';
      action = 'MANUAL_NOOP';
      reasonCode = 'TARGET_VALUE_CONFLICT';
    }
    return Object.freeze({
      sourceType: 'ARIA_MESSAGE_FEEDBACK' as const,
      sourceId: source.messageId,
      source,
      targets: matchingTargets,
      classification,
      action,
      reasonCode,
    });
  });
  const profiles = input.profiles.map((row) => ({
    source: Object.freeze({
      profileId: row.profileId,
      studentId: row.studentId,
      selectedCourseKeys: cloneFrozenJson(row.selectedCourseKeys),
      uiPreferences: cloneFrozenJson(row.uiPreferences),
    }),
    canonicalPreferences: Object.freeze({
      preferencesVersion: row.preferencesVersion,
      pinnedCourseKeys: cloneFrozenJson(row.pinnedCourseKeys),
      focusedCourseKey: row.focusedCourseKey,
      courseOrder: cloneFrozenJson(row.courseOrder),
      showCitations: row.showCitations,
    }),
  })).sort((left, right) => compareText(left.source.profileId, right.source.profileId));
  const profileDecisions = profiles.map(({ source, canonicalPreferences }) => {
    const identity = `ARIA_LEARNING_PROFILE:${source.profileId}`;
    if (sourceIdentities.has(identity)) {
      throw new Error('ARIA_FEEDBACK_PROFILE_PLAN_DUPLICATE_SOURCE');
    }
    sourceIdentities.add(identity);
    const legacy = classifyProfileLegacyState(source.selectedCourseKeys, source.uiPreferences);
    const canonicalValid = legacy.eligible && ariaLearningPreferencesV1Schema.safeParse({
      version: canonicalPreferences.preferencesVersion,
      pinnedCourseKeys: canonicalPreferences.pinnedCourseKeys,
      focusedCourseKey: canonicalPreferences.focusedCourseKey,
      courseOrder: canonicalPreferences.courseOrder,
      showCitations: canonicalPreferences.showCitations,
    }).success;
    const classification = legacy.eligible && canonicalValid
      ? 'DETERMINISTIC_BACKFILL' as const
      : 'MANUAL_REVIEW_REQUIRED' as const;
    return Object.freeze({
      sourceType: 'ARIA_LEARNING_PROFILE' as const,
      sourceId: source.profileId,
      source,
      canonicalPreferences: legacy.eligible ? canonicalPreferences : null,
      classification,
      action: classification === 'DETERMINISTIC_BACKFILL'
        ? 'CANONICAL_NOOP' as const
        : 'MANUAL_NOOP' as const,
      reasonCode: legacy.eligible && !canonicalValid
        ? 'CANONICAL_PREFERENCES_INVALID' as const
        : legacy.reasonCode,
    });
  });
  const frozenFeedbackDecisions = Object.freeze(feedbackDecisions);
  const frozenProfileDecisions = Object.freeze(profileDecisions);
  const feedbackReport = Object.freeze({
    scanned: feedbackDecisions.length,
    deterministic: feedbackDecisions.filter(({ classification }) =>
      classification === 'DETERMINISTIC_BACKFILL').length,
    manualReview: feedbackDecisions.filter(({ classification }) =>
      classification === 'MANUAL_REVIEW_REQUIRED').length,
    mutated: 0,
  });
  const profilesReport = Object.freeze({
    scanned: profileDecisions.length,
    deterministic: profileDecisions.filter(({ classification }) =>
      classification === 'DETERMINISTIC_BACKFILL').length,
    manualReview: profileDecisions.filter(({ classification }) =>
      classification === 'MANUAL_REVIEW_REQUIRED').length,
    mutated: 0,
  });
  const units = [...feedbackDecisions, ...profileDecisions]
    .sort((left, right) => compareText(left.sourceType, right.sourceType)
      || compareText(left.sourceId, right.sourceId));
  const snapshot = createAriaBackfillSnapshot({
    target: 'feedback-profile',
    plannerVersion: 1,
    inputs: { feedbackProfileContract: { version: 1 } },
    units,
    report: {
      scanned: feedbackReport.scanned + profilesReport.scanned,
      deterministic: feedbackReport.deterministic + profilesReport.deterministic,
      archived: 0,
      manualReview: feedbackReport.manualReview + profilesReport.manualReview,
    },
  });
  const report = Object.freeze({
    feedback: feedbackReport,
    profiles: profilesReport,
    sourceDigest: snapshot.sourceDigest,
    sourceSnapshot: snapshot.sourceSnapshot,
  });
  return Object.freeze({
    feedbackDecisions: frozenFeedbackDecisions,
    profileDecisions: frozenProfileDecisions,
    report,
    sourceDigest: snapshot.sourceDigest,
    sourceSnapshot: snapshot.sourceSnapshot,
  });
}

async function replayCompletedFeedbackProfileRun(
  client: PoolClient,
  options: AriaFeedbackProfileBackfillOptions,
): Promise<AriaFeedbackProfileBackfillReport | null> {
  const existing = await client.query<PersistedFeedbackProfileRun>(
    `SELECT id, "prerequisiteRunId", status::text, "sourceSnapshot", "scannedCount",
            "deterministicCount", "manualReviewCount", "mutatedCount"
     FROM aria_data_migration_runs
     WHERE "migrationName" = 'aria-feedback-profile-v1'
       AND "sourceDigest" = $1 AND mode = 'APPLY'
     FOR UPDATE`,
    [options.sourceDigest],
  );
  if (existing.rowCount === 0) return null;
  const persistedRun = existing.rows[0];
  if (
    existing.rowCount !== 1
    || !persistedRun
    || persistedRun.id !== options.runId
    || persistedRun.prerequisiteRunId !== options.prerequisiteRunId
    || persistedRun.status !== 'COMPLETED'
  ) {
    throw new Error('ARIA_FEEDBACK_PROFILE_BACKFILL_RUN_NOT_REPLAYABLE');
  }
  const persistedSnapshot = parseAriaBackfillSourceSnapshot(
    persistedRun.sourceSnapshot,
    'feedback-profile',
  );
  if (persistedSnapshot.sourceSnapshotSha256 !== options.sourceDigest) {
    throw new Error('ARIA_FEEDBACK_PROFILE_BACKFILL_REPLAY_AUDIT_INVALID');
  }
  await assertFeedbackProfilePrerequisite(client, options, {
    sourceDigest: persistedSnapshot.sourceSnapshotSha256,
    sourceSnapshot: persistedSnapshot,
  });
  const auditCounts = await client.query<{
    sourceType: 'ARIA_MESSAGE_FEEDBACK' | 'ARIA_LEARNING_PROFILE';
    classification: 'DETERMINISTIC_BACKFILL' | 'MANUAL_REVIEW_REQUIRED';
    count: number;
    mutated: number;
  }>(
    `SELECT "sourceType", classification::text, COUNT(*)::integer AS count,
            COUNT(*) FILTER (WHERE "targetKey"->>'created' = 'true')::integer AS mutated
     FROM aria_data_migration_row_audits WHERE "runId" = $1
     GROUP BY "sourceType", classification ORDER BY "sourceType", classification`,
    [persistedRun.id],
  );
  const section = (sourceType: 'ARIA_MESSAGE_FEEDBACK' | 'ARIA_LEARNING_PROFILE') => {
    const rows = auditCounts.rows.filter((row) => row.sourceType === sourceType);
    if (rows.some(({ classification }) =>
      classification !== 'DETERMINISTIC_BACKFILL'
      && classification !== 'MANUAL_REVIEW_REQUIRED')) {
      throw new Error('ARIA_FEEDBACK_PROFILE_BACKFILL_REPLAY_AUDIT_INVALID');
    }
    return Object.freeze({
      scanned: rows.reduce((sum, row) => sum + row.count, 0),
      deterministic: rows.find(({ classification }) =>
        classification === 'DETERMINISTIC_BACKFILL')?.count ?? 0,
      manualReview: rows.find(({ classification }) =>
        classification === 'MANUAL_REVIEW_REQUIRED')?.count ?? 0,
      mutated: rows.reduce((sum, row) => sum + row.mutated, 0),
    });
  };
  const feedback = section('ARIA_MESSAGE_FEEDBACK');
  const profiles = section('ARIA_LEARNING_PROFILE');
  if (
    feedback.scanned + profiles.scanned !== persistedRun.scannedCount
    || feedback.deterministic + profiles.deterministic !== persistedRun.deterministicCount
    || feedback.manualReview + profiles.manualReview !== persistedRun.manualReviewCount
    || feedback.mutated + profiles.mutated !== persistedRun.mutatedCount
    || persistedSnapshot.report.scanned !== persistedRun.scannedCount
    || persistedSnapshot.report.deterministic !== persistedRun.deterministicCount
    || persistedSnapshot.report.manualReview !== persistedRun.manualReviewCount
  ) {
    throw new Error('ARIA_FEEDBACK_PROFILE_BACKFILL_REPLAY_AUDIT_INVALID');
  }
  return Object.freeze({
    feedback,
    profiles,
    sourceDigest: persistedSnapshot.sourceSnapshotSha256,
    sourceSnapshot: persistedSnapshot,
  });
}

async function assertFeedbackProfilePrerequisite(
  client: PoolClient,
  options: AriaFeedbackProfileBackfillOptions,
  plan: Pick<AriaFeedbackProfileBackfillPlan, 'sourceDigest' | 'sourceSnapshot'>,
): Promise<void> {
  if (!options.prerequisiteRunId || options.sourceDigest !== plan.sourceDigest) {
    throw new Error('ARIA_FEEDBACK_PROFILE_SOURCE_SNAPSHOT_MISMATCH');
  }
  const prerequisite = await client.query<{
    status: string;
    sourceDigest: string;
    sourceSnapshot: unknown;
    scannedCount: number;
    deterministicCount: number;
    manualReviewCount: number;
  }>(
    `SELECT status::text, "sourceDigest", "sourceSnapshot", "scannedCount",
            "deterministicCount", "manualReviewCount"
     FROM aria_data_migration_runs
     WHERE id = $1 AND "migrationName" = 'aria-feedback-profile-v1'
       AND mode = 'DRY_RUN'
     FOR UPDATE`,
    [options.prerequisiteRunId],
  );
  const row = prerequisite.rows[0];
  if (
    prerequisite.rowCount !== 1
    || !row
    || row.status !== 'COMPLETED'
    || row.sourceDigest !== plan.sourceDigest
    || row.scannedCount !== plan.sourceSnapshot.report.scanned
    || row.deterministicCount !== plan.sourceSnapshot.report.deterministic
    || row.manualReviewCount !== plan.sourceSnapshot.report.manualReview
  ) {
    throw new Error('ARIA_FEEDBACK_PROFILE_SOURCE_SNAPSHOT_MISMATCH');
  }
  const snapshot = parseAriaBackfillSourceSnapshot(row.sourceSnapshot, 'feedback-profile');
  if (snapshot.sourceSnapshotSha256 !== plan.sourceDigest) {
    throw new Error('ARIA_FEEDBACK_PROFILE_SOURCE_SNAPSHOT_MISMATCH');
  }
}

async function executeBackfill(
  client: PoolClient,
  options: AriaFeedbackProfileBackfillOptions,
): Promise<AriaFeedbackProfileBackfillReport> {
  if (!/^[0-9a-f]{64}$/.test(options.sourceDigest)) {
    throw new Error('ARIA_FEEDBACK_PROFILE_SOURCE_DIGEST_INVALID');
  }
  if (options.mode === 'APPLY') {
    const replay = await replayCompletedFeedbackProfileRun(client, options);
    if (replay) return replay;
  }
  const feedbackRows = await client.query<LegacyFeedbackBackfillInput>(
    `SELECT message.id AS "messageId", message."conversationId",
            conversation."studentId", message.feedback
     FROM aria_messages message
     JOIN aria_conversations conversation ON conversation.id = message."conversationId"
     WHERE message.feedback IS NOT NULL
     ORDER BY message.id
     FOR UPDATE OF message, conversation`,
  );
  const messageIds = feedbackRows.rows.map(({ messageId }) => messageId);
  const canonicalRows = messageIds.length === 0
    ? { rows: [] as CanonicalFeedbackBackfillInput[] }
    : await client.query<CanonicalFeedbackBackfillInput>(
      `SELECT id, "messageId", "studentId", useful
       FROM aria_feedbacks WHERE "messageId" = ANY($1::text[])
       ORDER BY "messageId", "studentId", id FOR UPDATE`,
      [messageIds],
    );
  const profileRows = await client.query<LegacyProfileBackfillInput>(
    `SELECT id AS "profileId", "studentId", "selectedCourseKeys", "uiPreferences",
            "preferencesVersion", "pinnedCourseKeys", "focusedCourseKey",
            "courseOrder", "showCitations"
     FROM aria_learning_profiles ORDER BY id FOR UPDATE`,
  );
  const plan = planAriaFeedbackProfileBackfill({
    feedbackSources: feedbackRows.rows,
    canonicalFeedbacks: canonicalRows.rows,
    profiles: profileRows.rows,
  });
  if (options.mode === 'DRY_RUN') return plan.report;
  const replayAfterSourceLock = await replayCompletedFeedbackProfileRun(client, options);
  if (replayAfterSourceLock) return replayAfterSourceLock;
  await assertFeedbackProfilePrerequisite(client, options, plan);

  const run = await client.query<{ id: string }>(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
       "prerequisiteRunId")
     VALUES ($1, 'aria-feedback-profile-v1', 'APPLY', $2::jsonb, $3, 'RUNNING', $4)
     ON CONFLICT ("migrationName", "sourceDigest", mode)
     DO NOTHING
     RETURNING id`,
    [
      options.runId,
      JSON.stringify(plan.sourceSnapshot),
      plan.sourceDigest,
      options.prerequisiteRunId,
    ],
  );
  if (run.rowCount === 0) {
    const replay = await replayCompletedFeedbackProfileRun(client, options);
    if (!replay) throw new Error('ARIA_FEEDBACK_PROFILE_BACKFILL_RUN_NOT_REPLAYABLE');
    return replay;
  }
  const runId = run.rows[0].id;
  let feedbackMutated = 0;

  for (const decision of plan.feedbackDecisions) {
    const { source, classification } = decision;
    let targetId = decision.targets[0]?.id ?? null;
    let created = false;
    let afterFingerprint: string | null = null;
    if (decision.action === 'CREATE') {
      const inserted = await client.query<{ id: string; updatedAt: string }>(
        `INSERT INTO aria_feedbacks
          (id, "messageId", "studentId", useful, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT ("messageId", "studentId") DO NOTHING
         RETURNING id, to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "updatedAt"`,
        [randomUUID(), source.messageId, source.studentId, source.feedback],
      );
      if (inserted.rowCount === 1) {
        targetId = inserted.rows[0].id;
        created = true;
        feedbackMutated += 1;
        afterFingerprint = stableLegacyFingerprint({
          id: targetId,
          messageId: source.messageId,
          studentId: source.studentId,
          useful: source.feedback,
          reason: null,
          updatedAt: inserted.rows[0].updatedAt,
        });
      } else {
        const canonical = await client.query<{
          id: string;
          studentId: string;
          useful: boolean;
        }>(
          `SELECT id, "studentId", useful FROM aria_feedbacks
           WHERE "messageId" = $1 AND "studentId" = $2`,
          [source.messageId, source.studentId],
        );
        if (
          canonical.rowCount !== 1
          || canonical.rows[0].studentId !== source.studentId
          || canonical.rows[0].useful !== source.feedback
        ) {
          throw new Error('ARIA_FEEDBACK_BACKFILL_CONCURRENT_CONFLICT');
        }
        targetId = canonical.rows[0].id;
      }
    }
    const auditInsertion = await client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage")
       VALUES ($1, $2, 'ARIA_MESSAGE_FEEDBACK', $3, $4, $5,
               $6, $7, $8::jsonb, $9::jsonb)
       ON CONFLICT ("runId", "sourceType", "sourceId") DO NOTHING`,
      [
        randomUUID(), runId, source.messageId,
        stableLegacyFingerprint(source), classification,
        targetId ? 'aria_feedbacks' : null, targetId,
        JSON.stringify({
          action: decision.action,
          afterFingerprint,
          created,
          reasonCode: decision.reasonCode,
        }),
        JSON.stringify({ feedback: source.feedback }),
      ],
    );
    if (auditInsertion.rowCount !== 1) {
      throw new Error('ARIA_FEEDBACK_PROFILE_BACKFILL_AUDIT_INSERT_CONFLICT');
    }
  }

  for (const decision of plan.profileDecisions) {
    const { source, classification } = decision;
    const auditInsertion = await client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage")
       VALUES ($1, $2, 'ARIA_LEARNING_PROFILE', $3, $4, $5,
               'aria_learning_profiles', $3, $6::jsonb, $7::jsonb)
       ON CONFLICT ("runId", "sourceType", "sourceId") DO NOTHING`,
      [
        randomUUID(), runId, source.profileId,
        stableLegacyFingerprint(source),
        classification,
        JSON.stringify({ action: decision.action, reasonCode: decision.reasonCode }),
        JSON.stringify({}),
      ],
    );
    if (auditInsertion.rowCount !== 1) {
      throw new Error('ARIA_FEEDBACK_PROFILE_BACKFILL_AUDIT_INSERT_CONFLICT');
    }
  }

  const scanned = plan.report.feedback.scanned + plan.report.profiles.scanned;
  const deterministic = plan.report.feedback.deterministic + plan.report.profiles.deterministic;
  const manualReview = plan.report.feedback.manualReview + plan.report.profiles.manualReview;
  const terminal = await client.query(
    `UPDATE aria_data_migration_runs
     SET status = 'COMPLETED', "scannedCount" = $2, "deterministicCount" = $3,
         "archivedCount" = 0, "manualReviewCount" = $4, "mutatedCount" = $5,
         "completedAt" = NOW()
     WHERE id = $1 AND status = 'RUNNING'`,
    [runId, scanned, deterministic, manualReview, feedbackMutated],
  );
  if (terminal.rowCount !== 1) {
    throw new Error('ARIA_FEEDBACK_PROFILE_BACKFILL_TERMINAL_CONFLICT');
  }
  return {
    feedback: { ...plan.report.feedback, mutated: feedbackMutated },
    profiles: plan.report.profiles,
    sourceDigest: plan.sourceDigest,
    sourceSnapshot: plan.sourceSnapshot,
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
      `SELECT status::text FROM aria_data_migration_runs
       WHERE id = $1 AND "migrationName" = 'aria-feedback-profile-v1'
         AND mode = 'APPLY' FOR UPDATE`,
      [runId],
    );
    if (run.rowCount !== 1 || run.rows[0].status !== 'COMPLETED') {
      throw new Error('ARIA_FEEDBACK_PROFILE_ROLLBACK_RUN_NOT_COMPLETED');
    }
    const audits = await client.query<{
      sourceId: string;
      targetId: string;
      sourceFingerprint: string;
      targetKey: { afterFingerprint: string; created: true };
      beforeImage: { feedback: boolean };
    }>(
      `SELECT "sourceId", "targetId", "sourceFingerprint", "targetKey", "beforeImage"
       FROM aria_data_migration_row_audits
       WHERE "runId" = $1 AND "sourceType" = 'ARIA_MESSAGE_FEEDBACK'
         AND classification = 'DETERMINISTIC_BACKFILL'
         AND "targetKey"->>'created' = 'true'
       ORDER BY "sourceId" FOR UPDATE`,
      [runId],
    );
    let feedbackDeleted = 0;
    for (const audit of audits.rows) {
      const source = await client.query<{
        messageId: string;
        conversationId: string;
        studentId: string;
        feedback: boolean;
        canonicalId: string;
        canonicalMessageId: string;
        canonicalStudentId: string;
        useful: boolean;
        reason: string | null;
        updatedAt: string;
      }>(
        `SELECT message.id AS "messageId", message."conversationId",
                conversation."studentId", message.feedback,
                canonical.id AS "canonicalId", canonical."messageId" AS "canonicalMessageId",
                canonical."studentId" AS "canonicalStudentId", canonical.useful,
                canonical.reason,
                to_char(canonical."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "updatedAt"
         FROM aria_messages message
         JOIN aria_conversations conversation ON conversation.id = message."conversationId"
         JOIN aria_feedbacks canonical ON canonical.id = $2 AND canonical."messageId" = message.id
         WHERE message.id = $1 FOR UPDATE OF message, conversation, canonical`,
        [audit.sourceId, audit.targetId],
      );
      const row = source.rows[0];
      if (
        source.rowCount !== 1
        || stableLegacyFingerprint({
          messageId: row.messageId,
          conversationId: row.conversationId,
          studentId: row.studentId,
          feedback: row.feedback,
        }) !== audit.sourceFingerprint
        || stableLegacyFingerprint({
          id: row.canonicalId,
          messageId: row.canonicalMessageId,
          studentId: row.canonicalStudentId,
          useful: row.useful,
          reason: row.reason,
          updatedAt: row.updatedAt,
        }) !== audit.targetKey.afterFingerprint
        || row.useful !== audit.beforeImage.feedback
      ) {
        throw new Error('ARIA_FEEDBACK_PROFILE_ROLLBACK_FINGERPRINT_CONFLICT');
      }
      const deletion = await client.query(
        `DELETE FROM aria_feedbacks
         WHERE id = $1 AND "messageId" = $2 AND "studentId" = $3`,
        [audit.targetId, audit.sourceId, row.studentId],
      );
      feedbackDeleted += deletion.rowCount ?? 0;
    }
    const completion = await client.query(
      `UPDATE aria_data_migration_runs SET status = 'ROLLED_BACK', "completedAt" = NOW()
       WHERE id = $1 AND "migrationName" = 'aria-feedback-profile-v1'
         AND mode = 'APPLY' AND status = 'COMPLETED'`,
      [runId],
    );
    if (completion.rowCount !== 1) {
      throw new Error('ARIA_FEEDBACK_PROFILE_ROLLBACK_RUN_NOT_COMPLETED');
    }
    await client.query('COMMIT');
    return { feedbackDeleted, profilesRestored: 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
