import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { stableLegacyFingerprint } from './audit-legacy-data';

export interface ConversationTurnBackfillOptions {
  readonly runId: string;
  readonly mode: 'DRY_RUN' | 'APPLY';
  readonly sourceDigest: string;
}

export interface ConversationTurnBackfillReport {
  readonly scannedMessages: number;
  readonly turnsCreated: number;
  readonly archivedGroups: number;
}

interface LegacyMessageRow {
  readonly id: string;
  readonly conversationId: string;
  readonly role: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly studentId: string;
  readonly actorUserId: string;
  readonly courseKey: string;
  readonly contextVersion: string | null;
}

function stableId(prefix: string, values: readonly string[]): string {
  return `${prefix}_${createHash('sha256').update(values.join('\u0000')).digest('hex').slice(0, 32)}`;
}

export async function backfillConversationTurns(
  client: PoolClient,
  options: ConversationTurnBackfillOptions,
): Promise<ConversationTurnBackfillReport> {
  const result = await client.query<LegacyMessageRow>(
    `SELECT m.id, m."conversationId", m.role, m.status, m."createdAt",
            c."studentId", s."userId" AS "actorUserId", c."courseKey", c."contextVersion"
     FROM aria_messages m
     JOIN aria_conversations c ON c.id = m."conversationId"
     JOIN students s ON s.id = c."studentId"
     WHERE m."turnId" IS NULL AND c."contextState" = 'ACTIVE'
     ORDER BY m."conversationId", m."createdAt", m.id`,
  );
  const byConversation = new Map<string, LegacyMessageRow[]>();
  for (const row of result.rows) {
    const messages = byConversation.get(row.conversationId) ?? [];
    messages.push(row);
    byConversation.set(row.conversationId, messages);
  }

  const groups: Array<{
    readonly kind: 'PAIR' | 'ARCHIVE';
    readonly messages: readonly LegacyMessageRow[];
  }> = [];
  for (const messages of byConversation.values()) {
    for (let index = 0; index < messages.length;) {
      const current = messages[index];
      const next = messages[index + 1];
      if (
        current.role === 'user'
        && current.status === 'COMPLETED'
        && next?.role === 'assistant'
        && next.status === 'COMPLETED'
      ) {
        groups.push({ kind: 'PAIR', messages: [current, next] });
        index += 2;
      } else {
        groups.push({ kind: 'ARCHIVE', messages: [current] });
        index += 1;
      }
    }
  }
  const archivedGroups = groups.filter(({ kind }) => kind === 'ARCHIVE').length;
  if (options.mode === 'DRY_RUN') {
    return { scannedMessages: result.rows.length, turnsCreated: 0, archivedGroups };
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
  const nextSequence = new Map<string, number>();
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
      let sequence = nextSequence.get(first.conversationId);
      if (sequence === undefined) {
        const maximum = await client.query<{ maximum: number | null }>(
          'SELECT MAX(sequence)::integer AS maximum FROM aria_conversation_turns WHERE "conversationId" = $1',
          [first.conversationId],
        );
        sequence = (maximum.rows[0].maximum ?? 0) + 1;
      }
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
          sequence,
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
        nextSequence.set(first.conversationId, sequence + 1);
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
    [options.runId, result.rows.length, turnsCreated, archivedGroups],
  );
  return { scannedMessages: result.rows.length, turnsCreated, archivedGroups };
}
