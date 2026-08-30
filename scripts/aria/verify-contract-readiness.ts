import { Pool } from 'pg';

interface Queryable {
  query<T extends Record<string, unknown>>(text: string): Promise<{ readonly rows: readonly T[] }>;
}

export interface AriaContractReadinessBlockers {
  readonly activeTurns: number;
  readonly legacyMessageFeedback: number;
  readonly legacyMessagesWithoutTurn: number;
  readonly legacyProfilesWithSelection: number;
  readonly nullableConversationCourseKey: number;
  readonly unresolvedConversationContext: number;
  readonly legacyWritersNotDrained: number;
  readonly manualAdjudicationContractMissing: number;
}

export interface AriaContractReadinessReport {
  readonly debt: 'ARIA_LEGACY_SCHEMA_DEBT';
  readonly ready: boolean;
  readonly blockers: AriaContractReadinessBlockers;
  readonly blockerCount: number;
}

function count(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('ARIA_M2_READINESS_COUNT_INVALID');
  return parsed;
}

export async function evaluateAriaContractReadiness(
  database: Queryable,
  input: Readonly<{ legacyWritersDrained: boolean }>,
): Promise<AriaContractReadinessReport> {
  const result = await database.query<{
    readonly active_turns: number;
    readonly legacy_message_feedback: number;
    readonly legacy_messages_without_turn: number;
    readonly legacy_profiles_with_selection: number;
    readonly nullable_conversation_course_key: number;
    readonly unresolved_conversation_context: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::integer FROM aria_conversation_turns
       WHERE status IN ('PENDING', 'RUNNING')) AS active_turns,
      (SELECT COUNT(*)::integer FROM aria_messages
       WHERE feedback IS NOT NULL) AS legacy_message_feedback,
      (SELECT COUNT(*)::integer FROM aria_messages
       WHERE "turnId" IS NULL) AS legacy_messages_without_turn,
      (SELECT COUNT(*)::integer FROM aria_learning_profiles
       WHERE CASE
         WHEN jsonb_typeof("selectedCourseKeys") = 'array'
           THEN jsonb_array_length("selectedCourseKeys") > 0
         ELSE TRUE
       END) AS legacy_profiles_with_selection,
      (SELECT COUNT(*)::integer FROM aria_conversations
       WHERE "courseKey" IS NULL) AS nullable_conversation_course_key,
      (SELECT COUNT(*)::integer FROM aria_conversations
       WHERE "contextState" <> 'ACTIVE') AS unresolved_conversation_context
  `);
  const row = result.rows[0];
  if (!row) throw new Error('ARIA_M2_READINESS_QUERY_EMPTY');
  const blockers: AriaContractReadinessBlockers = Object.freeze({
    activeTurns: count(row.active_turns),
    legacyMessageFeedback: count(row.legacy_message_feedback),
    legacyMessagesWithoutTurn: count(row.legacy_messages_without_turn),
    legacyProfilesWithSelection: count(row.legacy_profiles_with_selection),
    nullableConversationCourseKey: count(row.nullable_conversation_course_key),
    unresolvedConversationContext: count(row.unresolved_conversation_context),
    legacyWritersNotDrained: input.legacyWritersDrained ? 0 : 1,
    manualAdjudicationContractMissing: 1,
  });
  const blockerCount = Object.values(blockers).reduce((total, value) => total + value, 0);
  return Object.freeze({
    debt: 'ARIA_LEGACY_SCHEMA_DEBT' as const,
    ready: blockerCount === 0,
    blockers,
    blockerCount,
  });
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('ARIA_M2_DATABASE_URL_REQUIRED');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const report = await evaluateAriaContractReadiness(pool, {
      legacyWritersDrained: process.env.ARIA_LEGACY_WRITERS_DRAINED === '1',
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ready) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) void main();
