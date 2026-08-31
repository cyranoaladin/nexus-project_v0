import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { stableLegacyFingerprint } from './audit-legacy-data';
import {
  createAriaBackfillSnapshot,
  type AriaBackfillSourceSnapshot,
} from './backfill-snapshot';

export interface ConversationTurnBackfillOptions {
  readonly runId: string;
  readonly mode: 'DRY_RUN' | 'APPLY';
  readonly sourceDigest: string;
}

export interface ConversationTurnBackfillReport {
  readonly scannedMessages: number;
  readonly turnsCreated: number;
  readonly archivedGroups: number;
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
  readonly courseKey: string;
  readonly contextVersion: string | null;
}

interface PlannedLegacyMessage extends Omit<LegacyMessageBackfillInput, 'createdAt'> {
  readonly createdAt: string;
}

export interface ConversationTurnBackfillPlan {
  readonly groups: readonly Readonly<{
    kind: 'PAIR' | 'ARCHIVE';
    messages: readonly PlannedLegacyMessage[];
    sequence: number | null;
  }>[];
  readonly report: Readonly<{
    scannedMessages: number;
    turnsCreated: 0;
    archivedGroups: number;
  }>;
  readonly sourceDigest: string;
  readonly sourceSnapshot: AriaBackfillSourceSnapshot;
}

function stableId(prefix: string, values: readonly string[]): string {
  return `${prefix}_${createHash('sha256').update(values.join('\u0000')).digest('hex').slice(0, 32)}`;
}

function normalizedCreatedAt(value: Date | string): string {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('ARIA_BACKFILL_MESSAGE_DATE_INVALID');
  return date.toISOString();
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
  const groups: Array<{
    kind: 'PAIR' | 'ARCHIVE';
    messages: readonly PlannedLegacyMessage[];
    sequence: number | null;
  }> = [];
  for (const [conversationId, messages] of byConversation) {
    const initialMaximum = initialMaximumByConversation.get(conversationId) ?? 0;
    if (!Number.isInteger(initialMaximum) || initialMaximum < 0) {
      throw new Error('ARIA_BACKFILL_TURN_SEQUENCE_INVALID');
    }
    nextSequence.set(conversationId, initialMaximum + 1);
    for (let index = 0; index < messages.length;) {
      const current = messages[index];
      const next = messages[index + 1];
      if (
        current.role === 'user'
        && current.status === 'COMPLETED'
        && next?.role === 'assistant'
        && next.status === 'COMPLETED'
      ) {
        const sequence = nextSequence.get(conversationId) as number;
        groups.push({ kind: 'PAIR', messages: [current, next], sequence });
        nextSequence.set(conversationId, sequence + 1);
        index += 2;
      } else {
        groups.push({ kind: 'ARCHIVE', messages: [current], sequence: null });
        index += 1;
      }
    }
  }
  const frozenGroups = Object.freeze(groups.map((group) => Object.freeze({
    ...group,
    messages: Object.freeze([...group.messages]),
  })));
  const archivedGroups = frozenGroups.filter(({ kind }) => kind === 'ARCHIVE').length;
  const deterministic = frozenGroups.filter(({ kind }) => kind === 'PAIR').length;
  const report = Object.freeze({
    scannedMessages: rows.length,
    turnsCreated: 0 as const,
    archivedGroups,
  });
  const snapshot = createAriaBackfillSnapshot({
    target: 'conversation-turns',
    plannerVersion: 1,
    inputs: { groupingContract: { order: ['conversationId', 'createdAt', 'id'], version: 1 } },
    units: frozenGroups,
    report: {
      scanned: rows.length,
      deterministic,
      archived: archivedGroups,
      manualReview: 0,
    },
  });
  return Object.freeze({
    groups: frozenGroups,
    report,
    sourceDigest: snapshot.sourceDigest,
    sourceSnapshot: snapshot.sourceSnapshot,
  });
}

export async function backfillConversationTurns(
  client: PoolClient,
  options: ConversationTurnBackfillOptions,
): Promise<ConversationTurnBackfillReport> {
  const result = await client.query<LegacyMessageBackfillInput>(
    `SELECT m.id, m."conversationId", m.role, m.status, m."createdAt",
            c."studentId", s."userId" AS "actorUserId", c."courseKey", c."contextVersion"
     FROM aria_messages m
     JOIN aria_conversations c ON c.id = m."conversationId"
     JOIN students s ON s.id = c."studentId"
     WHERE m."turnId" IS NULL AND c."contextState" = 'ACTIVE'
     ORDER BY m."conversationId", m."createdAt", m.id`,
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
  const { archivedGroups } = plan.report;
  if (options.mode === 'DRY_RUN') {
    return {
      ...plan.report,
      sourceDigest: plan.sourceDigest,
      sourceSnapshot: plan.sourceSnapshot,
    };
  }

  await client.query(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
       "startedAt")
     VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3, 'RUNNING', NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      options.runId,
      JSON.stringify({ sourceTypes: ['conversation', 'message-status'], version: 1 }),
      options.sourceDigest,
    ],
  );

  let turnsCreated = 0;
  for (const group of groups) {
    const first = group.messages[0];
    const sourceId = stableId('legacy_group', group.messages.map(({ id }) => id));
    const sourceFingerprint = stableLegacyFingerprint({
      conversationId: first.conversationId,
      messageIds: group.messages.map(({ id }) => id),
      roles: group.messages.map(({ role }) => role),
      statuses: group.messages.map(({ status }) => status),
    });
    let targetId: string | null = null;
    if (group.kind === 'PAIR') {
      const turnId = stableId('legacy_turn', group.messages.map(({ id }) => id));
      const insertion = await client.query<{ id: string }>(
        `INSERT INTO aria_conversation_turns
          (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
           "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
           "pedagogicalMode", "agentRole", visibility, "completedAt", "migrationRunId",
           "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'LEGACY_IMPORT', $5, $6, $7, 'COMPLETED',
                 $8::jsonb, 'DISCOVERY', 'TUTOR', 'STUDENT_PRIVATE', $9, $10, $11, NOW())
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          turnId,
          first.conversationId,
          first.studentId,
          first.actorUserId,
          sourceId,
          sourceFingerprint,
          group.sequence,
          JSON.stringify({
            contextVersion: first.contextVersion,
            courseKey: first.courseKey,
            provenance: 'LEGACY_IMPORT',
          }),
          group.messages[group.messages.length - 1].createdAt,
          options.runId,
          first.createdAt,
        ],
      );
      if (insertion.rowCount === 1) {
        targetId = insertion.rows[0].id;
        turnsCreated += 1;
        await client.query(
          `UPDATE aria_messages
           SET "turnId" = $3,
               "turnRole" = CASE id
                 WHEN $1 THEN 'USER'::"AriaConversationTurnMessageRole"
                 WHEN $2 THEN 'ASSISTANT'::"AriaConversationTurnMessageRole"
               END
           WHERE id IN ($1, $2) AND "turnId" IS NULL`,
          [group.messages[0].id, group.messages[1].id, targetId],
        );
      }
    }
    await client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage", "createdAt")
       VALUES ($1, $2, 'ARIA_MESSAGE_GROUP', $3, $4, $5,
               $6, $7, $8::jsonb, $9::jsonb, NOW())
       ON CONFLICT ("runId", "sourceType", "sourceId") DO NOTHING`,
      [
        randomUUID(),
        options.runId,
        sourceId,
        sourceFingerprint,
        group.kind === 'PAIR' ? 'DETERMINISTIC_BACKFILL' : 'ARCHIVED_NON_RESUMABLE',
        targetId ? 'aria_conversation_turns' : null,
        targetId,
        JSON.stringify({ messageIds: group.messages.map(({ id }) => id) }),
        JSON.stringify({
          messageIds: group.messages.map(({ id }) => id),
          roles: group.messages.map(({ role }) => role),
          statuses: group.messages.map(({ status }) => status),
        }),
      ],
    );
  }

  await client.query(
    `UPDATE aria_data_migration_runs
     SET status = 'COMPLETED', "scannedCount" = $2,
         "deterministicCount" = $3, "archivedCount" = $4,
         "manualReviewCount" = 0, "mutatedCount" = $3,
         "completedAt" = NOW()
     WHERE id = $1`,
    [options.runId, plan.report.scannedMessages, turnsCreated, archivedGroups],
  );
  return {
    ...plan.report,
    turnsCreated,
    sourceDigest: plan.sourceDigest,
    sourceSnapshot: plan.sourceSnapshot,
  };
}
