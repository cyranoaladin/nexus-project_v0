import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { stableLegacyFingerprint, type LegacyClassification } from './audit-legacy-data';
import {
  createAriaBackfillSnapshot,
  parseAriaBackfillSourceSnapshot,
  type AriaBackfillSourceSnapshot,
} from './backfill-snapshot';

export interface ConversationTurnBackfillOptions {
  readonly runId: string;
  readonly mode: 'DRY_RUN' | 'APPLY';
  readonly sourceDigest: string;
  readonly prerequisiteRunId?: string;
}

export interface ConversationTurnBackfillReport {
  readonly scannedMessages: number;
  readonly turnsCreated: number;
  readonly deterministicGroups: number;
  readonly archivedGroups: number;
  readonly manualReviewGroups: number;
  readonly sourceDigest: string;
  readonly sourceSnapshot: AriaBackfillSourceSnapshot;
}

export interface LegacyMessageBackfillInput {
  readonly id: string;
  readonly conversationId: string;
  readonly role: string;
  readonly status: string;
  readonly createdAt: Date | string;
  readonly studentId: string;
  readonly actorUserId: string;
  readonly courseKey: string | null;
  readonly contextState: string;
  readonly contextVersion: string | null;
}

interface PlannedLegacyMessage extends Omit<LegacyMessageBackfillInput, 'createdAt'> {
  readonly createdAt: string;
}

export interface ConversationTurnBackfillPlan {
  readonly groups: readonly Readonly<{
    kind: 'PAIR' | 'ARCHIVE' | 'MANUAL';
    messages: readonly PlannedLegacyMessage[];
    sequence: number | null;
    clusterId: string | null;
    reason:
      | 'PAIR_COMPLETED'
      | 'PAIR_CANCELLED'
      | 'PAIR_ERROR'
      | 'CONTEXT_UNRESOLVED'
      | 'ORPHAN_USER'
      | 'ORPHAN_ASSISTANT'
      | 'SYSTEM_MESSAGE'
      | 'NON_TERMINAL_STATUS'
      | 'TIMESTAMP_ORDER_AMBIGUOUS'
      | 'NON_ALTERNATING_TERMINAL_GROUP'
      | 'UNKNOWN_ROLE'
      | 'UNKNOWN_STATUS';
    sourceFingerprint: string;
    sourceId: string;
    targetStatus: 'COMPLETED' | 'CANCELLED' | 'ERROR' | null;
    turnId: string | null;
  }>[];
  readonly report: Readonly<{
    scannedMessages: number;
    turnsCreated: 0;
    deterministicGroups: number;
    archivedGroups: number;
    manualReviewGroups: number;
  }>;
  readonly sourceDigest: string;
  readonly sourceSnapshot: AriaBackfillSourceSnapshot;
}

function normalizedCreatedAt(value: Date | string): string {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('ARIA_BACKFILL_MESSAGE_DATE_INVALID');
  return date.toISOString();
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const KNOWN_MESSAGE_ROLES = new Set(['user', 'assistant', 'system']);
const KNOWN_MESSAGE_STATUSES = new Set([
  'PENDING', 'STREAMING', 'COMPLETED', 'CANCELLED', 'ERROR',
]);

type PlannedGroup = ConversationTurnBackfillPlan['groups'][number];
type GroupReason = PlannedGroup['reason'];

function ambiguousClusterId(messages: readonly PlannedLegacyMessage[]): string {
  const first = messages[0];
  return stableLegacyFingerprint({
    conversationId: first?.conversationId,
    createdAts: messages.map(({ createdAt }) => createdAt),
    messageIds: messages.map(({ id }) => id),
    roles: messages.map(({ role }) => role),
    statuses: messages.map(({ status }) => status),
  });
}

function groupIdentity(
  prefix: 'legacy_message_group_v2' | 'legacy_turn_v2',
  messages: readonly PlannedLegacyMessage[],
): string {
  const first = messages[0];
  return `${prefix}_${stableLegacyFingerprint({
    contractVersion: 2,
    conversationId: first?.conversationId,
    orderedMessageIds: messages.map(({ id }) => id),
  })}`;
}

function groupSourceFingerprint(messages: readonly PlannedLegacyMessage[]): string {
  const first = messages[0];
  return stableLegacyFingerprint({
    actorUserId: first?.actorUserId,
    contextState: first?.contextState,
    contextVersion: first?.contextVersion,
    contractVersion: 2,
    conversationId: first?.conversationId,
    courseKey: first?.courseKey,
    messages: messages.map(({ createdAt, id, role, status }) => ({
      id, role, status, createdAt,
    })),
    studentId: first?.studentId,
  });
}

export function planConversationTurnBackfill(
  inputRows: readonly LegacyMessageBackfillInput[],
  initialMaximumByConversation: ReadonlyMap<string, number>,
): ConversationTurnBackfillPlan {
  const rows = inputRows.map((row) => Object.freeze({
    ...row,
    createdAt: normalizedCreatedAt(row.createdAt),
  })).sort((left, right) =>
    compareText(left.conversationId, right.conversationId)
    || compareText(left.createdAt, right.createdAt)
    || compareText(left.id, right.id));
  const byConversation = new Map<string, PlannedLegacyMessage[]>();
  for (const row of rows) {
    const messages = byConversation.get(row.conversationId) ?? [];
    messages.push(row);
    byConversation.set(row.conversationId, messages);
  }
  const nextSequence = new Map<string, number>();
  const groups: PlannedGroup[] = [];
  for (const [conversationId, messages] of byConversation) {
    const initialMaximum = initialMaximumByConversation.get(conversationId) ?? 0;
    if (!Number.isInteger(initialMaximum) || initialMaximum < 0) {
      throw new Error('ARIA_BACKFILL_TURN_SEQUENCE_INVALID');
    }
    nextSequence.set(conversationId, initialMaximum + 1);
    const appendGroup = (input: Readonly<{
      clusterId: string | null;
      kind: PlannedGroup['kind'];
      messages: readonly PlannedLegacyMessage[];
      reason: GroupReason;
      sequence: number | null;
      targetStatus: PlannedGroup['targetStatus'];
    }>) => {
      const sourceId = groupIdentity('legacy_message_group_v2', input.messages);
      groups.push({
        ...input,
        sourceFingerprint: groupSourceFingerprint(input.messages),
        sourceId,
        turnId: input.kind === 'PAIR'
          ? groupIdentity('legacy_turn_v2', input.messages)
          : null,
      });
    };
    const archive = (message: PlannedLegacyMessage, reason: GroupReason) => {
      appendGroup({
        kind: 'ARCHIVE', messages: [message], sequence: null, clusterId: null,
        reason, targetStatus: null,
      });
    };
    const manual = (ambiguous: readonly PlannedLegacyMessage[], reason: GroupReason) => {
      const clusterId = ambiguousClusterId(ambiguous);
      for (const message of ambiguous) {
        appendGroup({
          kind: 'MANUAL', messages: [message], sequence: null, clusterId,
          reason, targetStatus: null,
        });
      }
    };
    const pair = (userMessage: PlannedLegacyMessage, assistantMessage: PlannedLegacyMessage) => {
      const sequence = nextSequence.get(conversationId) as number;
      const targetStatus = assistantMessage.status as 'COMPLETED' | 'CANCELLED' | 'ERROR';
      const reason = `PAIR_${targetStatus}` as GroupReason;
      appendGroup({
        kind: 'PAIR', messages: [userMessage, assistantMessage], sequence,
        clusterId: null, reason, targetStatus,
      });
      nextSequence.set(conversationId, sequence + 1);
    };
    const flushTerminalRun = (terminalRun: readonly PlannedLegacyMessage[]) => {
      if (terminalRun.length === 0) return;
      if (terminalRun.some((message, index) =>
        index > 0 && terminalRun[index - 1].createdAt === message.createdAt)) {
        manual(terminalRun, 'TIMESTAMP_ORDER_AMBIGUOUS');
        return;
      }
      let start = 0;
      let end = terminalRun.length;
      while (start < end && terminalRun[start].role === 'assistant') {
        archive(terminalRun[start], 'ORPHAN_ASSISTANT');
        start += 1;
      }
      while (end > start && terminalRun[end - 1].role === 'user') end -= 1;
      const pairable = terminalRun.slice(start, end);
      const isStrictPairSequence = pairable.length % 2 === 0
        && pairable.every((message, index) =>
          message.role === (index % 2 === 0 ? 'user' : 'assistant'));
      if (isStrictPairSequence) {
        for (let index = 0; index < pairable.length; index += 2) {
          pair(pairable[index], pairable[index + 1]);
        }
      } else {
        manual(pairable, 'NON_ALTERNATING_TERMINAL_GROUP');
      }
      for (let index = end; index < terminalRun.length; index += 1) {
        archive(terminalRun[index], 'ORPHAN_USER');
      }
    };
    let terminalRun: PlannedLegacyMessage[] = [];
    for (const message of messages) {
      if (message.contextState !== 'ACTIVE' || message.courseKey === null) {
        flushTerminalRun(terminalRun);
        terminalRun = [];
        archive(message, 'CONTEXT_UNRESOLVED');
        continue;
      }
      const knownRole = KNOWN_MESSAGE_ROLES.has(message.role);
      const knownStatus = KNOWN_MESSAGE_STATUSES.has(message.status);
      const terminalCandidate = (message.role === 'user' && message.status === 'COMPLETED')
        || (message.role === 'assistant'
          && ['COMPLETED', 'CANCELLED', 'ERROR'].includes(message.status));
      if (knownRole && knownStatus && terminalCandidate) {
        terminalRun.push(message);
        continue;
      }
      flushTerminalRun(terminalRun);
      terminalRun = [];
      if (!knownRole) manual([message], 'UNKNOWN_ROLE');
      else if (!knownStatus) manual([message], 'UNKNOWN_STATUS');
      else if (message.role === 'system') archive(message, 'SYSTEM_MESSAGE');
      else archive(message, 'NON_TERMINAL_STATUS');
    }
    flushTerminalRun(terminalRun);
  }
  const frozenGroups = Object.freeze(groups.map((group) => Object.freeze({
    ...group,
    messages: Object.freeze([...group.messages]),
  })));
  const archivedGroups = frozenGroups.filter(({ kind }) => kind === 'ARCHIVE').length;
  const deterministicGroups = frozenGroups.filter(({ kind }) => kind === 'PAIR').length;
  const manualReviewGroups = frozenGroups.filter(({ kind }) => kind === 'MANUAL').length;
  const report = Object.freeze({
    scannedMessages: rows.length,
    turnsCreated: 0 as const,
    deterministicGroups,
    archivedGroups,
    manualReviewGroups,
  });
  const snapshot = createAriaBackfillSnapshot({
    target: 'conversation-turns',
    plannerVersion: 2,
    inputs: { groupingContract: { order: ['conversationId', 'createdAt', 'id'], version: 2 } },
    units: frozenGroups,
    report: {
      scanned: rows.length,
      deterministic: deterministicGroups,
      archived: archivedGroups,
      manualReview: manualReviewGroups,
    },
  });
  return Object.freeze({
    groups: frozenGroups,
    report,
    sourceDigest: snapshot.sourceDigest,
    sourceSnapshot: snapshot.sourceSnapshot,
  });
}

export interface MessageGroupBeforeImage {
  readonly clusterId: string | null;
  readonly createdAts: readonly string[];
  readonly messageIds: readonly string[];
  readonly reason: GroupReason;
  readonly roles: readonly string[];
  readonly statuses: readonly string[];
}

export interface MessageGroupTargetKey {
  readonly contractVersion: 2;
  readonly messageIds: readonly string[];
  readonly sequence: number;
  readonly status: 'COMPLETED' | 'CANCELLED' | 'ERROR';
  readonly turnId: string;
}

type ReplayLegacyMessage = Omit<LegacyMessageBackfillInput, 'createdAt'> & {
  readonly createdAt: string;
  readonly priorCompletedAudit: boolean;
  readonly turnId: string | null;
  readonly turnRole: 'USER' | 'ASSISTANT' | null;
};

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  }
  return value;
}

export function parseConversationTurnMessageAuditBeforeImage(
  value: unknown,
  classification: LegacyClassification,
): MessageGroupBeforeImage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  }
  const record = value as Record<string, unknown>;
  if (!exactKeys(record, [
    'clusterId', 'createdAts', 'messageIds', 'reason', 'roles', 'statuses',
  ]) || (record.clusterId !== null && typeof record.clusterId !== 'string')
    || typeof record.reason !== 'string') {
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  }
  const createdAts = stringArray(record.createdAts);
  const messageIds = stringArray(record.messageIds);
  const roles = stringArray(record.roles);
  const statuses = stringArray(record.statuses);
  if (
    ![1, 2].includes(messageIds.length)
    || createdAts.length !== messageIds.length
    || roles.length !== messageIds.length
    || statuses.length !== messageIds.length
    || messageIds.some((id) => id.length === 0)
    || createdAts.some((instant) => !Number.isFinite(new Date(instant).getTime()))
  ) {
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  }
  const reason = record.reason as GroupReason;
  if (classification === 'DETERMINISTIC_BACKFILL') {
    const expectedStatus = reason.replace('PAIR_', '');
    if (
      messageIds.length !== 2
      || record.clusterId !== null
      || !['PAIR_COMPLETED', 'PAIR_CANCELLED', 'PAIR_ERROR'].includes(reason)
      || roles[0] !== 'user'
      || roles[1] !== 'assistant'
      || statuses[0] !== 'COMPLETED'
      || statuses[1] !== expectedStatus
    ) throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  } else if (classification === 'ARCHIVED_NON_RESUMABLE') {
    if (
      messageIds.length !== 1
      || record.clusterId !== null
      || ![
        'CONTEXT_UNRESOLVED', 'ORPHAN_USER', 'ORPHAN_ASSISTANT',
        'SYSTEM_MESSAGE', 'NON_TERMINAL_STATUS',
      ].includes(reason)
    ) throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  } else if (
    messageIds.length !== 1
    || typeof record.clusterId !== 'string'
    || !/^[0-9a-f]{64}$/.test(record.clusterId)
    || ![
      'TIMESTAMP_ORDER_AMBIGUOUS', 'NON_ALTERNATING_TERMINAL_GROUP',
      'UNKNOWN_ROLE', 'UNKNOWN_STATUS',
    ].includes(reason)
  ) {
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  }
  return { clusterId: record.clusterId, createdAts, messageIds, reason, roles, statuses };
}

export function parseConversationTurnTargetKey(value: unknown): MessageGroupTargetKey {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  }
  const record = value as Record<string, unknown>;
  const messageIds = stringArray(record.messageIds);
  if (
    !exactKeys(record, [
      'contractVersion', 'messageIds', 'sequence', 'status', 'turnId',
    ])
    || record.contractVersion !== 2
    || messageIds.length !== 2
    || messageIds.some((id) => id.length === 0)
    || !Number.isInteger(record.sequence)
    || (record.sequence as number) < 1
    || (record.sequence as number) > 2_147_483_647
    || typeof record.status !== 'string'
    || !['COMPLETED', 'CANCELLED', 'ERROR'].includes(record.status)
    || typeof record.turnId !== 'string'
    || record.turnId.length === 0
  ) throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  return {
    contractVersion: 2,
    messageIds,
    sequence: record.sequence as number,
    status: record.status as MessageGroupTargetKey['status'],
    turnId: record.turnId,
  };
}

async function loadTurnPrerequisite(
  client: PoolClient,
  options: ConversationTurnBackfillOptions,
): Promise<AriaBackfillSourceSnapshot> {
  if (!options.prerequisiteRunId) {
    throw new Error('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH');
  }
  const result = await client.query<{
    status: string;
    sourceDigest: string;
    sourceSnapshot: unknown;
    scannedCount: number;
    deterministicCount: number;
    archivedCount: number;
    manualReviewCount: number;
    mutatedCount: number;
  }>(
    `SELECT status::text, "sourceDigest", "sourceSnapshot", "scannedCount",
            "deterministicCount", "archivedCount", "manualReviewCount", "mutatedCount"
     FROM aria_data_migration_runs
     WHERE id = $1 AND "migrationName" = 'aria-conversation-turns-v1'
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
    throw new Error('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH');
  }
  try {
    const snapshot = parseAriaBackfillSourceSnapshot(row.sourceSnapshot, 'conversation-turns');
    if (
      snapshot.sourceSnapshotSha256 !== options.sourceDigest
      || snapshot.plannerVersion !== 2
      || row.scannedCount !== snapshot.report.scanned
      || row.deterministicCount !== snapshot.report.deterministic
      || row.archivedCount !== snapshot.report.archived
      || row.manualReviewCount !== snapshot.report.manualReview
      || row.mutatedCount !== 0
    ) {
      throw new Error();
    }
    return snapshot;
  } catch {
    throw new Error('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH');
  }
}

export async function validateCompletedTurnEvidence(
  client: Pick<PoolClient, 'query'>,
  runId: string,
  expected: Readonly<{
    scannedCount: number;
    deterministicCount: number;
    archivedCount: number;
    manualReviewCount: number;
    mutatedCount: number;
  }>,
  lock = false,
): Promise<void> {
  const rowLock = lock ? 'FOR UPDATE' : '';
  const audits = await client.query<{
    sourceId: string;
    sourceFingerprint: string;
    classification: LegacyClassification;
    targetTable: string | null;
    targetId: string | null;
    targetKey: unknown;
    beforeImage: unknown;
  }>(
    `SELECT "sourceId", "sourceFingerprint", classification::text,
            "targetTable", "targetId", "targetKey", "beforeImage"
     FROM aria_data_migration_row_audits
     WHERE "runId" = $1 AND "sourceType" = 'ARIA_MESSAGE_GROUP'
     ORDER BY "sourceId" ${rowLock}`,
    [runId],
  );
  const parsed = audits.rows.map((audit) => ({
    ...audit,
    beforeImage: parseConversationTurnMessageAuditBeforeImage(
      audit.beforeImage,
      audit.classification,
    ),
  }));
  const messageIds = parsed.flatMap(({ beforeImage }) => [...beforeImage.messageIds]);
  if (new Set(messageIds).size !== messageIds.length) {
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  }
  const messages = await client.query<ReplayLegacyMessage>(
    `SELECT m.id, m."conversationId", m.role, m.status,
            to_char(m."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') || 'Z' AS "createdAt",
            m."turnId", m."turnRole"::text, c."studentId",
            s."userId" AS "actorUserId", c."courseKey", c."contextState"::text,
            c."contextVersion",
            EXISTS (
              SELECT 1
              FROM aria_data_migration_row_audits prior_audit
              JOIN aria_data_migration_runs prior_run ON prior_run.id = prior_audit."runId"
              CROSS JOIN LATERAL jsonb_array_elements_text(
                prior_audit."beforeImage"->'messageIds'
              ) prior_source(message_id)
              WHERE prior_audit."sourceType" = 'ARIA_MESSAGE_GROUP'
                AND prior_run.id <> $2
                AND prior_run."migrationName" = 'aria-conversation-turns-v1'
                AND prior_run.mode = 'APPLY' AND prior_run.status = 'COMPLETED'
                AND prior_source.message_id = m.id
            ) AS "priorCompletedAudit"
     FROM aria_messages m
     JOIN aria_conversations c ON c.id = m."conversationId"
     JOIN students s ON s.id = c."studentId"
     WHERE m.id = ANY($1::text[])
        OR (
          m."turnId" IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM aria_data_migration_row_audits prior_audit
            JOIN aria_data_migration_runs prior_run ON prior_run.id = prior_audit."runId"
            CROSS JOIN LATERAL jsonb_array_elements_text(
              prior_audit."beforeImage"->'messageIds'
            ) prior_source(message_id)
              WHERE prior_audit."sourceType" = 'ARIA_MESSAGE_GROUP'
                AND prior_run.id <> $2
                AND prior_run."migrationName" = 'aria-conversation-turns-v1'
                AND prior_run.mode = 'APPLY'
                AND prior_run.status IN ('COMPLETED', 'ROLLED_BACK')
                AND prior_source.message_id = m.id
            )
        )
     ORDER BY m.id ${lock ? 'FOR UPDATE OF m, c, s' : ''}`,
    [messageIds, runId],
  );
  const authoritativeMessageIds = new Set(messages.rows.map(({ id }) => id));
  if (
    messages.rows.some(({ priorCompletedAudit }) => priorCompletedAudit)
    || authoritativeMessageIds.size !== messageIds.length
    || messageIds.some((messageId) => !authoritativeMessageIds.has(messageId))
  ) throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  const byMessageId = new Map(messages.rows.map((message) => [message.id, message]));
  const minimumSequenceByConversation = new Map<string, number>();
  for (const audit of parsed) {
    if (audit.classification !== 'DETERMINISTIC_BACKFILL') continue;
    const firstMessageId = audit.beforeImage.messageIds[0];
    const conversationId = firstMessageId ? byMessageId.get(firstMessageId)?.conversationId : undefined;
    const targetKey = parseConversationTurnTargetKey(audit.targetKey);
    if (!conversationId) {
      throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
    }
    const current = minimumSequenceByConversation.get(conversationId);
    if (current === undefined || targetKey.sequence < current) {
      minimumSequenceByConversation.set(conversationId, targetKey.sequence);
    }
  }
  const sequenceBoundaries = [...minimumSequenceByConversation].map(
    ([conversationId, minimumSequence]) => ({ conversationId, minimumSequence }),
  );
  const maximums = sequenceBoundaries.length === 0
    ? { rows: [] as { conversationId: string; maximum: number }[] }
    : await client.query<{ conversationId: string; maximum: number }>(
      `SELECT boundary."conversationId",
              COALESCE(MAX(turn.sequence), 0)::integer AS maximum
       FROM jsonb_to_recordset($1::jsonb)
         AS boundary("conversationId" text, "minimumSequence" integer)
       LEFT JOIN aria_conversation_turns turn
         ON turn."conversationId" = boundary."conversationId"
        AND turn.sequence < boundary."minimumSequence"
       GROUP BY boundary."conversationId" ORDER BY boundary."conversationId"`,
      [JSON.stringify(sequenceBoundaries)],
    );
  if (maximums.rows.some(({ conversationId, maximum }) =>
    maximum !== (minimumSequenceByConversation.get(conversationId) ?? 0) - 1)) {
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  }
  const replayPlan = planConversationTurnBackfill(
    messages.rows,
    new Map(maximums.rows.map(({ conversationId, maximum }) => [conversationId, maximum])),
  );
  const expectedBySourceId = new Map(replayPlan.groups.map((group) => [group.sourceId, group]));
  if (
    expectedBySourceId.size !== replayPlan.groups.length
    || replayPlan.report.scannedMessages !== expected.scannedCount
    || replayPlan.report.deterministicGroups !== expected.deterministicCount
    || replayPlan.report.archivedGroups !== expected.archivedCount
    || replayPlan.report.manualReviewGroups !== expected.manualReviewCount
  ) throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  const targetIds = parsed.flatMap(({ targetId }) => targetId ? [targetId] : []);
  const targets = await client.query<{
    id: string;
    conversationId: string;
    subjectStudentId: string;
    actorUserId: string;
    useCase: string;
    clientRequestId: string;
    requestFingerprint: string;
    sequence: number;
    status: string;
    academicSnapshot: unknown;
    pedagogicalMode: string;
    agentRole: string;
    visibility: string;
    migrationRunId: string | null;
    createdAt: string;
    completedAt: string | null;
  }>(
    `SELECT id, "conversationId", "subjectStudentId", "actorUserId", "useCase"::text AS "useCase",
            "clientRequestId", "requestFingerprint", sequence, status::text,
            "academicSnapshot", "pedagogicalMode", "agentRole", visibility::text,
            "migrationRunId",
            to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') || 'Z' AS "createdAt",
            CASE WHEN "completedAt" IS NULL THEN NULL
              ELSE to_char("completedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') || 'Z' END AS "completedAt"
     FROM aria_conversation_turns
     WHERE id = ANY($1::text[]) OR "migrationRunId" = $2
     ORDER BY id ${rowLock}`,
    [targetIds, runId],
  );
  const byTargetId = new Map(targets.rows.map((target) => [target.id, target]));
  if (
    new Set(targetIds).size !== targetIds.length
    || targets.rows.length !== expected.deterministicCount
    || targets.rows.some(({ id, migrationRunId }) =>
      migrationRunId !== runId || !targetIds.includes(id))
  ) throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  let deterministic = 0;
  let archived = 0;
  let manualReview = 0;
  for (const audit of parsed) {
    const plannedGroup = expectedBySourceId.get(audit.sourceId);
    const sourceMessages = audit.beforeImage.messageIds.map((messageId) => byMessageId.get(messageId));
    if (!plannedGroup || sourceMessages.some((message) => !message)) {
      throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
    }
    const typedMessages = sourceMessages as ReplayLegacyMessage[];
    const plannedClassification = plannedGroup.kind === 'PAIR'
      ? 'DETERMINISTIC_BACKFILL'
      : plannedGroup.kind === 'MANUAL'
        ? 'MANUAL_REVIEW_REQUIRED'
        : 'ARCHIVED_NON_RESUMABLE';
    if (
      audit.classification !== plannedClassification
      || audit.beforeImage.clusterId !== plannedGroup.clusterId
      || audit.beforeImage.reason !== plannedGroup.reason
      || audit.beforeImage.messageIds.join('\u0000')
        !== plannedGroup.messages.map(({ id }) => id).join('\u0000')
      || audit.beforeImage.roles.join('\u0000')
        !== plannedGroup.messages.map(({ role }) => role).join('\u0000')
      || audit.beforeImage.statuses.join('\u0000')
        !== plannedGroup.messages.map(({ status }) => status).join('\u0000')
      || audit.beforeImage.createdAts.join('\u0000')
        !== plannedGroup.messages.map(({ createdAt }) => createdAt).join('\u0000')
      || typedMessages.some((message, index) =>
        message.role !== audit.beforeImage.roles[index]
        || message.status !== audit.beforeImage.statuses[index]
        || normalizedCreatedAt(message.createdAt) !== audit.beforeImage.createdAts[index])
      || groupIdentity('legacy_message_group_v2', typedMessages) !== audit.sourceId
      || groupSourceFingerprint(typedMessages) !== audit.sourceFingerprint
    ) {
      throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
    }
    if (audit.classification !== 'DETERMINISTIC_BACKFILL') {
      if (
        audit.targetTable !== null || audit.targetId !== null || audit.targetKey !== null
        || typedMessages.some(({ turnId }) => turnId !== null)
      ) throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
      if (audit.classification === 'ARCHIVED_NON_RESUMABLE') archived += 1;
      else manualReview += 1;
      continue;
    }
    deterministic += 1;
    const targetKey = parseConversationTurnTargetKey(audit.targetKey);
    const target = audit.targetId ? byTargetId.get(audit.targetId) : undefined;
    const first = typedMessages[0];
    const second = typedMessages[1];
    if (!target || !first || !second || audit.targetTable !== 'aria_conversation_turns'
      || first.contextState !== 'ACTIVE' || first.courseKey === null
      || second.contextState !== 'ACTIVE' || second.courseKey === null
      || second.conversationId !== first.conversationId
      || second.studentId !== first.studentId
      || second.actorUserId !== first.actorUserId
      || second.courseKey !== first.courseKey
      || second.contextVersion !== first.contextVersion
      || targetKey.turnId !== audit.targetId
      || targetKey.turnId !== plannedGroup.turnId
      || targetKey.messageIds.join('\u0000') !== audit.beforeImage.messageIds.join('\u0000')
      || targetKey.sequence !== plannedGroup.sequence
      || targetKey.status !== plannedGroup.targetStatus
      || target.id !== groupIdentity('legacy_turn_v2', typedMessages)
      || target.migrationRunId !== runId
      || target.useCase !== 'LEGACY_IMPORT'
      || target.clientRequestId !== audit.sourceId
      || target.requestFingerprint !== audit.sourceFingerprint
      || target.sequence !== targetKey.sequence
      || target.status !== targetKey.status
      || target.subjectStudentId !== first.studentId
      || target.actorUserId !== first.actorUserId
      || target.conversationId !== first.conversationId
      || target.pedagogicalMode !== 'LEGACY_UNSPECIFIED'
      || target.agentRole !== 'LEGACY_IMPORT'
      || target.visibility !== 'STUDENT_PRIVATE'
      || target.createdAt !== first.createdAt
      || target.completedAt !== second.createdAt
      || first.turnId !== target.id || first.turnRole !== 'USER'
      || second.turnId !== target.id || second.turnRole !== 'ASSISTANT') {
      throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
    }
    const academicSnapshot = target.academicSnapshot as Record<string, unknown> | null;
    if (!academicSnapshot || !exactKeys(academicSnapshot, [
      'contextVersion', 'courseKey', 'provenance',
    ]) || academicSnapshot.contextVersion !== first.contextVersion
      || academicSnapshot.courseKey !== first.courseKey
      || academicSnapshot.provenance !== 'LEGACY_IMPORT') {
      throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
    }
  }
  if (
    messageIds.length !== expected.scannedCount
    || deterministic !== expected.deterministicCount
    || archived !== expected.archivedCount
    || manualReview !== expected.manualReviewCount
    || expected.mutatedCount !== expected.deterministicCount
    || audits.rowCount !== deterministic + archived + manualReview
  ) throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
}

async function replayCompletedTurnRun(
  client: PoolClient,
  options: ConversationTurnBackfillOptions,
): Promise<ConversationTurnBackfillReport | null> {
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
            "scannedCount", "deterministicCount", "archivedCount", "manualReviewCount",
            "mutatedCount"
     FROM aria_data_migration_runs
     WHERE id = $1 AND "migrationName" = 'aria-conversation-turns-v1'
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
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_RUN_NOT_REPLAYABLE');
  }
  try {
    const prerequisite = await loadTurnPrerequisite(client, options);
    const snapshot = parseAriaBackfillSourceSnapshot(row.sourceSnapshot, 'conversation-turns');
    if (
      snapshot.sourceSnapshotSha256 !== prerequisite.sourceSnapshotSha256
      || snapshot.plannerVersion !== 2
      || snapshot.report.scanned !== row.scannedCount
      || snapshot.report.deterministic !== row.deterministicCount
      || snapshot.report.archived !== row.archivedCount
      || snapshot.report.manualReview !== row.manualReviewCount
    ) throw new Error();
    await validateCompletedTurnEvidence(client, options.runId, row);
    return {
      scannedMessages: row.scannedCount,
      turnsCreated: row.mutatedCount,
      deterministicGroups: row.deterministicCount,
      archivedGroups: row.archivedCount,
      manualReviewGroups: row.manualReviewCount,
      sourceDigest: row.sourceDigest,
      sourceSnapshot: snapshot,
    };
  } catch (error) {
    if (error instanceof Error
      && error.message === 'ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID') {
      throw error;
    }
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_RUN_NOT_REPLAYABLE');
  }
}

export async function backfillConversationTurns(
  client: PoolClient,
  options: ConversationTurnBackfillOptions,
): Promise<ConversationTurnBackfillReport> {
  if (options.mode === 'APPLY') {
    const replay = await replayCompletedTurnRun(client, options);
    if (replay) return replay;
    await client.query('LOCK TABLE aria_conversation_turns IN SHARE ROW EXCLUSIVE MODE');
    await client.query('LOCK TABLE aria_messages IN SHARE ROW EXCLUSIVE MODE');
  }
  const sourceLock = options.mode === 'APPLY' ? 'FOR UPDATE OF m, c, s' : '';
  const result = await client.query<LegacyMessageBackfillInput>(
    `SELECT m.id, m."conversationId", m.role, m.status,
            to_char(m."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') || 'Z' AS "createdAt",
            c."studentId", s."userId" AS "actorUserId", c."courseKey",
            c."contextState"::text, c."contextVersion"
     FROM aria_messages m
     JOIN aria_conversations c ON c.id = m."conversationId"
     JOIN students s ON s.id = c."studentId"
     WHERE m."turnId" IS NULL
       AND NOT EXISTS (
         SELECT 1
         FROM aria_data_migration_row_audits prior_audit
         JOIN aria_data_migration_runs prior_run ON prior_run.id = prior_audit."runId"
         WHERE prior_audit."sourceType" = 'ARIA_MESSAGE_GROUP'
           AND prior_run."migrationName" = 'aria-conversation-turns-v1'
           AND prior_run.mode = 'APPLY' AND prior_run.status = 'COMPLETED'
           AND prior_audit."beforeImage"->'messageIds' ? m.id
       )
     ORDER BY m."conversationId", m."createdAt", m.id
     ${sourceLock}`,
  );
  const conversationIds = [...new Set(result.rows.map(({ conversationId }) => conversationId))];
  const maximums = conversationIds.length === 0
    ? { rows: [] as { conversationId: string; maximum: number }[] }
    : await client.query<{ conversationId: string; maximum: number }>(
      `SELECT "conversationId", COALESCE(MAX(sequence), 0)::integer AS maximum
       FROM aria_conversation_turns
       WHERE "conversationId" = ANY($1::text[])
       GROUP BY "conversationId" ORDER BY "conversationId"`,
      [conversationIds],
    );
  const plan = planConversationTurnBackfill(
    result.rows,
    new Map(maximums.rows.map(({ conversationId, maximum }) => [conversationId, maximum])),
  );
  const { groups } = plan;
  const { archivedGroups, deterministicGroups, manualReviewGroups } = plan.report;
  if (options.mode === 'DRY_RUN') {
    return {
      ...plan.report,
      sourceDigest: plan.sourceDigest,
      sourceSnapshot: plan.sourceSnapshot,
    };
  }
  const replayAfterSourceLock = await replayCompletedTurnRun(client, options);
  if (replayAfterSourceLock) return replayAfterSourceLock;
  const prerequisite = await loadTurnPrerequisite(client, options);
  if (
    options.sourceDigest !== plan.sourceDigest
    || prerequisite.sourceSnapshotSha256 !== plan.sourceSnapshot.sourceSnapshotSha256
  ) {
    throw new Error('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH');
  }

  const run = await client.query<{ id: string }>(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
       "prerequisiteRunId", "startedAt")
     VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
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
    const replay = await replayCompletedTurnRun(client, options);
    if (!replay) throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_RUN_NOT_REPLAYABLE');
    return replay;
  }
  const runId = run.rows[0].id;

  let turnsCreated = 0;
  for (const group of groups) {
    const first = group.messages[0];
    const sourceId = group.sourceId;
    const sourceFingerprint = group.sourceFingerprint;
    let targetId: string | null = null;
    if (group.kind === 'PAIR') {
      const turnId = group.turnId;
      if (!turnId || !group.targetStatus || group.sequence === null || first.courseKey === null) {
        throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_PLAN_INVALID');
      }
      const insertion = await client.query<{ id: string }>(
        `INSERT INTO aria_conversation_turns
          (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
           "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
           "pedagogicalMode", "agentRole", visibility, "completedAt", "migrationRunId",
           "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'LEGACY_IMPORT', $5, $6, $7,
                 $8::"AriaConversationTurnStatus", $9::jsonb,
                 'LEGACY_UNSPECIFIED', 'LEGACY_IMPORT', 'STUDENT_PRIVATE',
                 $10, $11, $12, NOW())
         RETURNING id`,
        [
          turnId,
          first.conversationId,
          first.studentId,
          first.actorUserId,
          sourceId,
          sourceFingerprint,
          group.sequence,
          group.targetStatus,
          JSON.stringify({
            contextVersion: first.contextVersion,
            courseKey: first.courseKey,
            provenance: 'LEGACY_IMPORT',
          }),
          group.messages[group.messages.length - 1].createdAt,
          runId,
          first.createdAt,
        ],
      );
      if (insertion.rowCount !== 1 || insertion.rows[0]?.id !== turnId) {
        throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_TURN_INSERT_CONFLICT');
      }
      targetId = turnId;
      turnsCreated += 1;
      const linked = await client.query(
        `UPDATE aria_messages
         SET "turnId" = $3,
             "turnRole" = CASE id
               WHEN $1 THEN 'USER'::"AriaConversationTurnMessageRole"
               WHEN $2 THEN 'ASSISTANT'::"AriaConversationTurnMessageRole"
             END
         WHERE "conversationId" = $4 AND "turnId" IS NULL
           AND (
             (id = $1 AND role = 'user' AND status = 'COMPLETED')
             OR (id = $2 AND role = 'assistant' AND status = $5)
           )`,
        [
          group.messages[0].id,
          group.messages[1].id,
          targetId,
          first.conversationId,
          group.targetStatus,
        ],
      );
      if (linked.rowCount !== 2) {
        throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_MESSAGE_LINK_CONFLICT');
      }
    }
    const targetKey = group.kind === 'PAIR' ? {
      contractVersion: 2,
      messageIds: group.messages.map(({ id }) => id),
      sequence: group.sequence,
      status: group.targetStatus,
      turnId: group.turnId,
    } : null;
    const auditInsertion = await client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage", "createdAt")
       VALUES ($1, $2, 'ARIA_MESSAGE_GROUP', $3, $4, $5,
               $6, $7, $8::jsonb, $9::jsonb, NOW())`,
      [
        randomUUID(),
        runId,
        sourceId,
        sourceFingerprint,
        group.kind === 'PAIR' ? 'DETERMINISTIC_BACKFILL'
          : group.kind === 'MANUAL' ? 'MANUAL_REVIEW_REQUIRED'
            : 'ARCHIVED_NON_RESUMABLE',
        targetId ? 'aria_conversation_turns' : null,
        targetId,
        targetKey === null ? null : JSON.stringify(targetKey),
        JSON.stringify({
          clusterId: group.clusterId,
          createdAts: group.messages.map(({ createdAt }) => createdAt),
          messageIds: group.messages.map(({ id }) => id),
          reason: group.reason,
          roles: group.messages.map(({ role }) => role),
          statuses: group.messages.map(({ status }) => status),
        }),
      ],
    );
    if (auditInsertion.rowCount !== 1) {
      throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_AUDIT_INSERT_CONFLICT');
    }
  }

  if (turnsCreated !== deterministicGroups) {
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_MUTATION_COUNT_MISMATCH');
  }
  const terminal = await client.query(
    `UPDATE aria_data_migration_runs
     SET status = 'COMPLETED', "scannedCount" = $2,
         "deterministicCount" = $3, "archivedCount" = $4,
         "manualReviewCount" = $5, "mutatedCount" = $6,
         "completedAt" = NOW()
     WHERE id = $1 AND status = 'RUNNING'`,
    [
      runId,
      plan.report.scannedMessages,
      deterministicGroups,
      archivedGroups,
      manualReviewGroups,
      turnsCreated,
    ],
  );
  if (terminal.rowCount !== 1) {
    throw new Error('ARIA_CONVERSATION_TURN_BACKFILL_TERMINAL_CONFLICT');
  }
  return {
    ...plan.report,
    turnsCreated,
    sourceDigest: plan.sourceDigest,
    sourceSnapshot: plan.sourceSnapshot,
  };
}
