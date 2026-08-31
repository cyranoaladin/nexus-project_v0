/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import {
  backfillConversationContexts,
  type ConversationContextBackfillReport,
  type LegacyContextEvidence,
} from '@/scripts/aria/backfill-conversation-context';
import {
  backfillConversationTurns,
  planConversationTurnBackfill,
  type ConversationTurnBackfillReport,
  type LegacyMessageBackfillInput,
} from '@/scripts/aria/backfill-conversation-turns';
import { stableLegacyFingerprint } from '@/scripts/aria/audit-legacy-data';
import { rollbackLegacyBackfill, verifyAriaBackfillRun } from '@/scripts/aria/run-backfills';
import { createAriaBackfillSnapshot } from '@/scripts/aria/backfill-snapshot';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('ARIA legacy backfills on PostgreSQL', () => {
  let pool: Pool;
  let client: PoolClient;
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    studentUser: randomUUID(),
    student: randomUUID(),
    deterministicConversation: randomUUID(),
    ambiguousConversation: randomUUID(),
  };
  let contextRunId: string;
  let turnRunId: string;
  let turnPairUserMessage: string;
  let turnPairAssistantMessage: string;
  let turnPairOriginalCreatedAt: string;
  let turnSourceDigest: string;
  let turnPrerequisiteRunId: string;

  async function sealContextDryRun(
    runId: string,
    report: ConversationContextBackfillReport,
  ): Promise<void> {
    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "archivedCount", "manualReviewCount",
         "mutatedCount", "completedAt")
       VALUES ($1, 'aria-conversation-context-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', $4, $5, $6, $7, 0, NOW())`,
      [
        runId,
        JSON.stringify(report.sourceSnapshot),
        report.sourceDigest,
        report.scanned,
        report.deterministic,
        report.archived,
        report.manualReview,
      ],
    );
  }

  async function sealTurnDryRun(
    runId: string,
    report: ConversationTurnBackfillReport,
  ): Promise<void> {
    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "archivedCount", "manualReviewCount",
         "mutatedCount", "completedAt")
       VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', $4, $5, $6, $7, 0, NOW())`,
      [
        runId,
        JSON.stringify(report.sourceSnapshot),
        report.sourceDigest,
        report.scannedMessages,
        report.deterministicGroups,
        report.archivedGroups,
        report.manualReviewGroups,
      ],
    );
  }

  async function seedDirectDeterministicTurnEvidence(input: Readonly<{
    conversationId: string;
    forgedField?: 'sourceId' | 'sourceFingerprint' | 'turnId';
    sequence?: number;
    timestampPrefix: string;
  }>): Promise<Readonly<{
    prerequisiteRunId: string;
    runId: string;
    sourceDigest: string;
  }>> {
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const userMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    const context = await client.query<{
      actorUserId: string;
      contextState: string;
      contextVersion: string | null;
      courseKey: string | null;
      studentId: string;
    }>(
      `SELECT student."userId" AS "actorUserId", conversation."contextState"::text,
              conversation."contextVersion", conversation."courseKey",
              conversation."studentId"
       FROM aria_conversations conversation
       JOIN students student ON student.id = conversation."studentId"
       WHERE conversation.id = $1`,
      [input.conversationId],
    );
    const row = context.rows[0];
    if (!row) throw new Error('B2_DIRECT_EVIDENCE_CONTEXT_MISSING');
    const maximum = await client.query<{ maximum: number }>(
      `SELECT COALESCE(MAX(sequence), 0)::integer AS maximum
       FROM aria_conversation_turns WHERE "conversationId" = $1`,
      [input.conversationId],
    );
    const sequence = input.sequence ?? ((maximum.rows[0]?.maximum ?? 0) + 1);
    const userCreatedAt = `${input.timestampPrefix}:00.000Z`;
    const assistantCreatedAt = `${input.timestampPrefix}:01.000Z`;
    const identitySha256 = stableLegacyFingerprint({
      contractVersion: 2,
      conversationId: input.conversationId,
      orderedMessageIds: [userMessageId, assistantMessageId],
    });
    const canonicalSourceId = `legacy_message_group_v2_${identitySha256}`;
    const canonicalTurnId = `legacy_turn_v2_${identitySha256}`;
    const canonicalSourceFingerprint = stableLegacyFingerprint({
      actorUserId: row.actorUserId,
      contextState: row.contextState,
      contextVersion: row.contextVersion,
      contractVersion: 2,
      conversationId: input.conversationId,
      courseKey: row.courseKey,
      messages: [
        {
          id: userMessageId,
          role: 'user',
          status: 'COMPLETED',
          createdAt: userCreatedAt,
        },
        {
          id: assistantMessageId,
          role: 'assistant',
          status: 'COMPLETED',
          createdAt: assistantCreatedAt,
        },
      ],
      studentId: row.studentId,
    });
    const sourceId = input.forgedField === 'sourceId'
      ? `legacy_message_group_v2_${'a'.repeat(64)}`
      : canonicalSourceId;
    const turnId = input.forgedField === 'turnId'
      ? `legacy_turn_v2_${'b'.repeat(64)}`
      : canonicalTurnId;
    const sourceFingerprint = input.forgedField === 'sourceFingerprint'
      ? 'c'.repeat(64)
      : canonicalSourceFingerprint;
    const snapshot = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 }, fixtureId: prerequisiteRunId },
      units: [{ classification: 'DETERMINISTIC_BACKFILL' }],
      report: { scanned: 2, deterministic: 1, archived: 0, manualReview: 0 },
    });
    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "completedAt")
       VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', 2, 1, NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
               'RUNNING', $4)`,
      [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
    );
    await client.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt") VALUES
        ($1, $3, 'user', 'direct-user', 'COMPLETED', $4::timestamptz),
        ($2, $3, 'assistant', 'direct-assistant', 'COMPLETED', $5::timestamptz)`,
      [
        userMessageId,
        assistantMessageId,
        input.conversationId,
        userCreatedAt,
        assistantCreatedAt,
      ],
    );
    await client.query(
      `INSERT INTO aria_conversation_turns
        (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
         "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
         "pedagogicalMode", "agentRole", visibility, "completedAt", "migrationRunId",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'LEGACY_IMPORT', $5, $6, $7, 'COMPLETED',
               $8::jsonb, 'LEGACY_UNSPECIFIED', 'LEGACY_IMPORT', 'STUDENT_PRIVATE',
               $9::timestamptz, $10, $11::timestamptz, NOW())`,
      [
        turnId,
        input.conversationId,
        row.studentId,
        row.actorUserId,
        sourceId,
        sourceFingerprint,
        sequence,
        JSON.stringify({
          contextVersion: row.contextVersion,
          courseKey: row.courseKey,
          provenance: 'LEGACY_IMPORT',
        }),
        assistantCreatedAt,
        runId,
        userCreatedAt,
      ],
    );
    await client.query(
      `UPDATE aria_messages SET "turnId" = $3,
           "turnRole" = CASE id WHEN $1 THEN 'USER'::"AriaConversationTurnMessageRole"
                                 ELSE 'ASSISTANT'::"AriaConversationTurnMessageRole" END
       WHERE id IN ($1, $2)`,
      [userMessageId, assistantMessageId, turnId],
    );
    await client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage")
       VALUES ($1, $2, 'ARIA_MESSAGE_GROUP', $3, $4, 'DETERMINISTIC_BACKFILL',
               'aria_conversation_turns', $5, $6::jsonb, $7::jsonb)`,
      [
        randomUUID(),
        runId,
        sourceId,
        sourceFingerprint,
        turnId,
        JSON.stringify({
          contractVersion: 2,
          messageIds: [userMessageId, assistantMessageId],
          sequence,
          status: 'COMPLETED',
          turnId,
        }),
        JSON.stringify({
          clusterId: null,
          createdAts: [userCreatedAt, assistantCreatedAt],
          messageIds: [userMessageId, assistantMessageId],
          reason: 'PAIR_COMPLETED',
          roles: ['user', 'assistant'],
          statuses: ['COMPLETED', 'COMPLETED'],
        }),
      ],
    );
    return { prerequisiteRunId, runId, sourceDigest: snapshot.sourceDigest };
  }

  async function insertUnauditedRunTurn(runId: string, conversationId: string): Promise<string> {
    const turnId = randomUUID();
    const context = await client.query<{
      actorUserId: string;
      contextVersion: string | null;
      courseKey: string | null;
      maximumSequence: number;
      studentId: string;
    }>(
      `SELECT student."userId" AS "actorUserId", conversation."contextVersion",
              conversation."courseKey", conversation."studentId",
              COALESCE(MAX(turn.sequence), 0)::integer AS "maximumSequence"
       FROM aria_conversations conversation
       JOIN students student ON student.id = conversation."studentId"
       LEFT JOIN aria_conversation_turns turn ON turn."conversationId" = conversation.id
       WHERE conversation.id = $1
       GROUP BY student."userId", conversation."contextVersion", conversation."courseKey",
                conversation."studentId"`,
      [conversationId],
    );
    const row = context.rows[0];
    if (!row || row.courseKey === null) throw new Error('B2_UNAUDITED_TURN_CONTEXT_MISSING');
    await client.query(
      `INSERT INTO aria_conversation_turns
        (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
         "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
         "pedagogicalMode", "agentRole", visibility, "completedAt", "migrationRunId",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'LEGACY_IMPORT', $5, $6, $7, 'COMPLETED', $8::jsonb,
               'LEGACY_UNSPECIFIED', 'LEGACY_IMPORT', 'STUDENT_PRIVATE', NOW(), $9, NOW(), NOW())`,
      [
        turnId,
        conversationId,
        row.studentId,
        row.actorUserId,
        `unaudited-${randomUUID()}`,
        '9'.repeat(64),
        row.maximumSequence + 1,
        JSON.stringify({
          contextVersion: row.contextVersion,
          courseKey: row.courseKey,
          provenance: 'LEGACY_IMPORT',
        }),
        runId,
      ],
    );
    return turnId;
  }

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
        ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
      [
        ids.parentUser,
        `parent-${ids.parentUser}@invalid.test`,
        ids.studentUser,
        `student-${ids.studentUser}@invalid.test`,
      ],
    );
    await client.query(
      'INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)',
      [ids.parent, ids.parentUser],
    );
    await client.query(
      `INSERT INTO students
        (id, "parentId", "userId", "gradeLevel", "updatedAt")
       VALUES ($1, $2, $3, 'PREMIERE', NOW())`,
      [ids.student, ids.parent, ids.studentUser],
    );
    await client.query(
      `INSERT INTO aria_conversations
        (id, "studentId", subject, "courseKey", "skillId", "contextState", "updatedAt") VALUES
        ($1, $3, 'MATHEMATIQUES', NULL, 'globally-unique-skill', 'LEGACY_CONTEXT_UNRESOLVED', NOW()),
        ($2, $3, 'MATHEMATIQUES', NULL, 'colliding-raw-skill', 'LEGACY_CONTEXT_UNRESOLVED', NOW())`,
      [ids.deterministicConversation, ids.ambiguousConversation, ids.student],
    );
  });

  afterAll(async () => {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  });

  it('B1_APPLY_REJECTS_SAME_COUNT_SOURCE_SNAPSHOT_DRIFT', async () => {
    const conversationA = randomUUID();
    const conversationB = randomUUID();
    const runId = randomUUID();
    const auditRunId = randomUUID();
    await client.query(
      `INSERT INTO aria_conversations
        (id, "studentId", subject, "courseKey", "skillId", "contextState", "updatedAt") VALUES
        ($1, $3, 'MATHEMATIQUES', NULL, 'skill-drift-a', 'LEGACY_CONTEXT_UNRESOLVED', NOW()),
        ($2, $3, 'MATHEMATIQUES', NULL, 'skill-drift-b', 'LEGACY_CONTEXT_UNRESOLVED', NOW())`,
      [conversationA, conversationB, ids.student],
    );
    const evidence: LegacyContextEvidence = {
      skillCourseCandidates: new Map([
        ['skill-drift-a', ['eds-maths-premiere']],
        ['skill-drift-b', ['eds-nsi-terminale']],
      ]),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    };
    const dryRun = await backfillConversationContexts(client, {
      runId, mode: 'DRY_RUN', sourceDigest: '0'.repeat(64), evidence,
    });
    await sealContextDryRun(auditRunId, dryRun);
    await client.query(
      `UPDATE aria_conversations SET "skillId" = 'skill-drift-b' WHERE id = $1`,
      [conversationA],
    );
    const outcome = await backfillConversationContexts(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: auditRunId,
      evidence,
    }).then(() => 'RESOLVED', (error: Error) => error.message);
    if (outcome === 'RESOLVED') await rollbackLegacyBackfill(client, runId);
    await client.query(
      `UPDATE aria_conversations SET "skillId" = 'skill-drift-a' WHERE id = $1`,
      [conversationA],
    );
    await client.query(
      'DELETE FROM aria_conversations WHERE id = ANY($1::text[])',
      [[conversationA, conversationB]],
    );
    expect(outcome).toBe('ARIA_CONVERSATION_CONTEXT_SOURCE_SNAPSHOT_MISMATCH');
  });

  it('B1_UNKNOWN_NON_NULL_COURSE_IS_AUDITED_MANUAL_AND_NON_RESUMABLE', async () => {
    await client.query('SAVEPOINT b1_existing_course_classification');
    const unknownConversationId = randomUUID();
    const knownConversationId = randomUUID();
    const runId = randomUUID();
    const prerequisiteRunId = randomUUID();
    try {
      await client.query(
        `INSERT INTO aria_conversations
          (id, "studentId", subject, "courseKey", "contextState", "updatedAt") VALUES
          ($1, $3, 'MATHEMATIQUES', 'unknown-preserved-course',
           'LEGACY_CONTEXT_UNRESOLVED', NOW()),
          ($2, $3, 'MATHEMATIQUES', 'eds-maths-premiere',
           'LEGACY_CONTEXT_UNRESOLVED', NOW())`,
        [unknownConversationId, knownConversationId, ids.student],
      );
      const evidence: LegacyContextEvidence = {
        skillCourseCandidates: new Map(),
        resourceCourseCandidates: new Map(),
        academicSubjectCandidates: new Map(),
      };
      const dryRun = await backfillConversationContexts(client, {
        runId, mode: 'DRY_RUN', sourceDigest: '0'.repeat(64), evidence,
      });
      await sealContextDryRun(prerequisiteRunId, dryRun);
      await backfillConversationContexts(client, {
        runId,
        mode: 'APPLY',
        sourceDigest: dryRun.sourceDigest,
        prerequisiteRunId,
        evidence,
      });

      const rows = await client.query<{
        id: string;
        courseKey: string | null;
        contextState: string;
      }>(
        `SELECT id, "courseKey", "contextState"::text
         FROM aria_conversations WHERE id = ANY($1::text[]) ORDER BY id`,
        [[unknownConversationId, knownConversationId]],
      );
      const byId = new Map(rows.rows.map((row) => [row.id, row]));
      expect(byId.get(unknownConversationId)).toEqual({
        id: unknownConversationId,
        courseKey: 'unknown-preserved-course',
        contextState: 'LEGACY_CONTEXT_UNRESOLVED',
      });
      expect(byId.get(knownConversationId)).toEqual({
        id: knownConversationId,
        courseKey: 'eds-maths-premiere',
        contextState: 'ACTIVE',
      });
      const audits = await client.query<{
        sourceId: string;
        classification: string;
        targetKey: { reasonCode?: string };
      }>(
        `SELECT "sourceId", classification::text, "targetKey"
         FROM aria_data_migration_row_audits
         WHERE "runId" = $1 AND "sourceId" = ANY($2::text[])`,
        [runId, [unknownConversationId, knownConversationId]],
      );
      expect(audits.rows).toEqual(expect.arrayContaining([
        expect.objectContaining({
          sourceId: unknownConversationId,
          classification: 'MANUAL_REVIEW_REQUIRED',
          targetKey: expect.objectContaining({ reasonCode: 'INVALID_EXISTING_COURSE' }),
        }),
        expect.objectContaining({
          sourceId: knownConversationId,
          classification: 'DETERMINISTIC_BACKFILL',
          targetKey: expect.objectContaining({ reasonCode: 'EXISTING_COURSE' }),
        }),
      ]));
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b1_existing_course_classification');
    }
  });

  it('D017 ARIA-B-R017 classifies dry-run rows without mutating and applies only deterministic evidence', async () => {
    const evidence: LegacyContextEvidence = {
      skillCourseCandidates: new Map([
        ['globally-unique-skill', ['eds-maths-premiere']],
        ['colliding-raw-skill', ['eds-maths-premiere', 'eds-maths-terminale']],
      ]),
      resourceCourseCandidates: new Map(),
      academicSubjectCandidates: new Map(),
    };
    const runId = randomUUID();
    contextRunId = runId;
    const dryRun = await backfillConversationContexts(client, {
      runId,
      mode: 'DRY_RUN',
      sourceDigest: 'd'.repeat(64),
      evidence,
    });
    await sealContextDryRun(`${runId}-audit`, dryRun);
    expect(dryRun).toMatchObject({ deterministic: 1, manualReview: 1, mutated: 0 });
    const before = await client.query<{ courseKey: string | null }>(
      'SELECT "courseKey" FROM aria_conversations WHERE id = $1',
      [ids.deterministicConversation],
    );
    expect(before.rows[0].courseKey).toBeNull();

    const applied = await backfillConversationContexts(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: `${runId}-audit`,
      evidence,
    });
    expect(applied).toMatchObject({ deterministic: 1, manualReview: 1, mutated: 1 });
    const rows = await client.query<{ id: string; courseKey: string | null; contextState: string }>(
      'SELECT id, "courseKey", "contextState" FROM aria_conversations ORDER BY id',
    );
    const byId = new Map(rows.rows.map((row) => [row.id, row]));
    expect(byId.get(ids.deterministicConversation)).toMatchObject({
      courseKey: 'eds-maths-premiere',
      contextState: 'ACTIVE',
    });
    expect(byId.get(ids.ambiguousConversation)).toMatchObject({
      courseKey: null,
      contextState: 'LEGACY_CONTEXT_UNRESOLVED',
    });

    const audits = await client.query<{ classification: string; beforeImage: unknown }>(
      'SELECT classification, "beforeImage" FROM aria_data_migration_row_audits WHERE "runId" = $1',
      [runId],
    );
    expect(audits.rows.map((row) => row.classification).sort()).toEqual([
      'DETERMINISTIC_BACKFILL',
      'MANUAL_REVIEW_REQUIRED',
    ]);
    expect(JSON.stringify(audits.rows)).not.toMatch(/content|email|message/i);
  });

  it('rejects migration before-images outside the source-specific allowlist', async () => {
    await client.query('SAVEPOINT audit_allowlist');
    const runId = randomUUID();
    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status)
       VALUES ($1, 'allowlist-proof', 'DRY_RUN', '{}', $2, 'RUNNING')`,
      [runId, 'f'.repeat(64)],
    );
    await expect(client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint",
         classification, "beforeImage")
       VALUES ($1, $2, 'ARIA_CONVERSATION', 'source-1', $3,
               'MANUAL_REVIEW_REQUIRED', $4::jsonb)`,
      [randomUUID(), runId, 'a'.repeat(64), JSON.stringify({ content: 'not-allowed' })],
    )).rejects.toMatchObject({ code: '23514' });
    await client.query('ROLLBACK TO SAVEPOINT audit_allowlist');
  });

  it('B2_APPLY_REJECTS_SAME_COUNT_SOURCE_SNAPSHOT_DRIFT', async () => {
    const messageIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const replacementAssistant = randomUUID();
    const runId = randomUUID();
    const auditRunId = randomUUID();
    await client.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt") VALUES
        ($1, $5, 'user', 'attempt-a', 'COMPLETED', NOW() - INTERVAL '4 seconds'),
        ($2, $5, 'assistant', 'guidance-a', 'COMPLETED', NOW() - INTERVAL '3 seconds'),
        ($3, $5, 'user', 'attempt-b', 'COMPLETED', NOW() - INTERVAL '2 seconds'),
        ($4, $5, 'assistant', 'guidance-b', 'COMPLETED', NOW() - INTERVAL '1 second')`,
      [...messageIds, ids.deterministicConversation],
    );
    const dryRun = await backfillConversationTurns(client, {
      runId, mode: 'DRY_RUN', sourceDigest: '0'.repeat(64),
    });
    await sealTurnDryRun(auditRunId, dryRun);
    await client.query('DELETE FROM aria_messages WHERE id = $1', [messageIds[1]]);
    await client.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt")
       VALUES ($1, $2, 'assistant', 'replacement', 'COMPLETED', NOW() - INTERVAL '3 seconds')`,
      [replacementAssistant, ids.deterministicConversation],
    );
    const outcome = await backfillConversationTurns(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: auditRunId,
    }).then(() => 'RESOLVED', (error: Error) => error.message);
    if (outcome === 'RESOLVED') await rollbackLegacyBackfill(client, runId);
    await client.query(
      'DELETE FROM aria_messages WHERE id = ANY($1::text[])',
      [[...messageIds, replacementAssistant]],
    );
    expect(outcome).toBe('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH');
  });

  it('B2_APPLY_REJECTS_CREATED_AT_SOURCE_DRIFT', async () => {
    const messageIds = [randomUUID(), randomUUID()];
    const runId = randomUUID();
    const auditRunId = randomUUID();
    await client.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt") VALUES
        ($1, $3, 'user', 'timestamp-user', 'COMPLETED', '2028-01-01 10:00:00.000'),
        ($2, $3, 'assistant', 'timestamp-assistant', 'COMPLETED', '2028-01-01 10:00:01.000')`,
      [...messageIds, ids.deterministicConversation],
    );
    const dryRun = await backfillConversationTurns(client, {
      runId, mode: 'DRY_RUN', sourceDigest: '0'.repeat(64),
    });
    await sealTurnDryRun(auditRunId, dryRun);
    await client.query(
      'UPDATE aria_messages SET "createdAt" = "createdAt" + INTERVAL \'100 milliseconds\' WHERE id = $1',
      [messageIds[0]],
    );
    await expect(backfillConversationTurns(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: auditRunId,
    })).rejects.toThrow('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH');
    await client.query('DELETE FROM aria_messages WHERE id = ANY($1::text[])', [messageIds]);
  });

  it('B2_APPLY_REJECTS_PREREQUISITE_COUNT_DRIFT', async () => {
    await client.query('SAVEPOINT b2_prerequisite_count_drift');
    const messageIds = [randomUUID(), randomUUID()];
    const runId = randomUUID();
    const prerequisiteRunId = randomUUID();
    try {
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt") VALUES
          ($1, $3, 'user', 'count-user', 'COMPLETED', '2029-02-20 10:00:00.000'),
          ($2, $3, 'assistant', 'count-assistant', 'COMPLETED', '2029-02-20 10:00:01.000')`,
        [...messageIds, ids.deterministicConversation],
      );
      const dryRun = await backfillConversationTurns(client, {
        runId, mode: 'DRY_RUN', sourceDigest: '0'.repeat(64),
      });
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "scannedCount", "deterministicCount", "archivedCount", "manualReviewCount",
           "mutatedCount", "completedAt")
         VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
                 'COMPLETED', $4, $5, $6, $7, 0, NOW())`,
        [
          prerequisiteRunId,
          JSON.stringify(dryRun.sourceSnapshot),
          dryRun.sourceDigest,
          dryRun.scannedMessages + 1,
          dryRun.deterministicGroups,
          dryRun.archivedGroups,
          dryRun.manualReviewGroups,
        ],
      );
      await expect(backfillConversationTurns(client, {
        runId,
        mode: 'APPLY',
        sourceDigest: dryRun.sourceDigest,
        prerequisiteRunId,
      })).rejects.toThrow('ARIA_CONVERSATION_TURN_SOURCE_SNAPSHOT_MISMATCH');
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_prerequisite_count_drift');
    }
  });

  it('B2_APPLY_REJECTS_TURN_ID_COLLISION', async () => {
    await client.query('SAVEPOINT b2_turn_id_collision');
    const messageIds = [randomUUID(), randomUUID()];
    const runId = randomUUID();
    try {
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt") VALUES
          ($1, $3, 'user', 'collision-user', 'COMPLETED', '2028-02-01 10:00:00.000'),
          ($2, $3, 'assistant', 'collision-assistant', 'COMPLETED', '2028-02-01 10:00:01.000')`,
        [...messageIds, ids.deterministicConversation],
      );
      const rows = await client.query<LegacyMessageBackfillInput>(
        `SELECT m.id, m."conversationId", m.role, m.status,
                to_char(m."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') || 'Z' AS "createdAt",
                c."studentId", s."userId" AS "actorUserId", c."courseKey",
                c."contextState"::text, c."contextVersion"
         FROM aria_messages m
         JOIN aria_conversations c ON c.id = m."conversationId"
         JOIN students s ON s.id = c."studentId"
         WHERE m.id = ANY($1::text[]) ORDER BY m."createdAt", m.id`,
        [messageIds],
      );
      const plan = planConversationTurnBackfill(rows.rows, new Map());
      const turnId = plan.groups[0].turnId as string;
      await client.query(
        `INSERT INTO aria_conversation_turns
          (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
           "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
           "pedagogicalMode", "agentRole", visibility, "completedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'LEGACY_IMPORT', $5, $6, 99, 'COMPLETED', $7::jsonb,
                 'LEGACY_UNSPECIFIED', 'LEGACY_IMPORT', 'STUDENT_PRIVATE',
                 '2028-02-01 10:00:01.000', '2028-02-01 10:00:00.000', NOW())`,
        [
          turnId,
          ids.deterministicConversation,
          ids.student,
          ids.studentUser,
          `collision-${randomUUID()}`,
          'c'.repeat(64),
          JSON.stringify({
            contextVersion: null,
            courseKey: 'eds-maths-premiere',
            provenance: 'LEGACY_IMPORT',
          }),
        ],
      );
      const dryRun = await backfillConversationTurns(client, {
        runId, mode: 'DRY_RUN', sourceDigest: '0'.repeat(64),
      });
      await sealTurnDryRun(`${runId}-audit`, dryRun);
      await expect(backfillConversationTurns(client, {
        runId,
        mode: 'APPLY',
        sourceDigest: dryRun.sourceDigest,
        prerequisiteRunId: `${runId}-audit`,
      })).rejects.toMatchObject({ code: '23505' });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_turn_id_collision');
    }
  });

  it('B2_COMPLETED_PLANNER_V1_REPLAY_IS_REJECTED', async () => {
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const snapshot = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 1,
      inputs: { groupingContract: { version: 1 } },
      units: [],
      report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
    });
    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status, "completedAt")
       VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    await client.query("SET LOCAL session_replication_role = 'replica'");
    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId", "completedAt")
       VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
               'COMPLETED', $4, NOW())`,
      [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
    );
    await client.query("SET LOCAL session_replication_role = 'origin'");

    await expect(backfillConversationTurns(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: snapshot.sourceDigest,
      prerequisiteRunId,
    })).rejects.toThrow('ARIA_CONVERSATION_TURN_BACKFILL_RUN_NOT_REPLAYABLE');
  });

  it('B2_COMPLETED_REPLAY_REJECTS_MISSING_OR_FORGED_AUDIT', async () => {
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const snapshot = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: {
        groupingContract: { version: 2 },
        fixtureId: prerequisiteRunId,
      },
      units: [{ classification: 'ARCHIVED_NON_RESUMABLE' }],
      report: { scanned: 1, deterministic: 0, archived: 1, manualReview: 0 },
    });
    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "archivedCount", "completedAt")
       VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', 1, 1, NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    await client.query("SET LOCAL session_replication_role = 'replica'");
    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId", "scannedCount", "archivedCount", "completedAt")
       VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
               'COMPLETED', $4, 1, 1, NOW())`,
      [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
    );
    await client.query("SET LOCAL session_replication_role = 'origin'");

    await expect(backfillConversationTurns(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: snapshot.sourceDigest,
      prerequisiteRunId,
    })).rejects.toThrow('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  });

  it('B2_EARLIER_COMPLETED_RUN_REMAINS_REPLAYABLE_AND_VERIFIABLE_AFTER_LATER_RUN_IN_SAME_CONVERSATION', async () => {
    await client.query('SAVEPOINT b2_historical_replay_after_later_run');
    try {
      const conversationId = randomUUID();
      await client.query(
        `INSERT INTO aria_conversations
          (id, "studentId", subject, "courseKey", "contextState", "updatedAt")
         VALUES ($1, $2, 'MATHEMATIQUES', 'eds-maths-premiere', 'ACTIVE', NOW())`,
        [conversationId, ids.student],
      );
      const firstMessageIds = [randomUUID(), randomUUID()];
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt") VALUES
          ($1, $3, 'user', 'first-user', 'COMPLETED', '2029-03-07 10:00:00.000'),
          ($2, $3, 'assistant', 'first-assistant', 'COMPLETED', '2029-03-07 10:00:01.000')`,
        [...firstMessageIds, conversationId],
      );
      const firstRunId = randomUUID();
      const firstDryRun = await backfillConversationTurns(client, {
        runId: firstRunId,
        mode: 'DRY_RUN',
        sourceDigest: '0'.repeat(64),
      });
      const firstPrerequisiteRunId = randomUUID();
      await sealTurnDryRun(firstPrerequisiteRunId, firstDryRun);
      const firstApplied = await backfillConversationTurns(client, {
        runId: firstRunId,
        mode: 'APPLY',
        sourceDigest: firstDryRun.sourceDigest,
        prerequisiteRunId: firstPrerequisiteRunId,
      });

      const secondMessageIds = [randomUUID(), randomUUID()];
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt") VALUES
          ($1, $3, 'user', 'second-user', 'COMPLETED', '2029-03-07 10:01:00.000'),
          ($2, $3, 'assistant', 'second-assistant', 'COMPLETED', '2029-03-07 10:01:01.000')`,
        [...secondMessageIds, conversationId],
      );
      const secondRunId = randomUUID();
      const secondDryRun = await backfillConversationTurns(client, {
        runId: secondRunId,
        mode: 'DRY_RUN',
        sourceDigest: '0'.repeat(64),
      });
      const secondPrerequisiteRunId = randomUUID();
      await sealTurnDryRun(secondPrerequisiteRunId, secondDryRun);
      await backfillConversationTurns(client, {
        runId: secondRunId,
        mode: 'APPLY',
        sourceDigest: secondDryRun.sourceDigest,
        prerequisiteRunId: secondPrerequisiteRunId,
      });

      await expect(backfillConversationTurns(client, {
        runId: firstRunId,
        mode: 'APPLY',
        sourceDigest: firstDryRun.sourceDigest,
        prerequisiteRunId: firstPrerequisiteRunId,
      })).resolves.toEqual(firstApplied);
      await expect(verifyAriaBackfillRun(client, {
        target: 'conversation-turns',
        runId: firstRunId,
        sourceDigest: firstDryRun.sourceDigest,
      })).resolves.toMatchObject({ scanned: 2, deterministic: 1, mutated: 1 });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_historical_replay_after_later_run');
    }
  });

  it('B2_ROLLBACK_REJECTS_EARLIER_RUN_WHEN_LATER_COMPLETED_RUN_DEPENDS_ON_ITS_SEQUENCE', async () => {
    await client.query('SAVEPOINT b2_lifo_rollback_dependency');
    try {
      const conversationId = randomUUID();
      await client.query(
        `INSERT INTO aria_conversations
          (id, "studentId", subject, "courseKey", "contextState", "updatedAt")
         VALUES ($1, $2, 'MATHEMATIQUES', 'eds-maths-premiere', 'ACTIVE', NOW())`,
        [conversationId, ids.student],
      );
      const applyPair = async (timestampPrefix: string) => {
        const messageIds = [randomUUID(), randomUUID()];
        await client.query(
          `INSERT INTO aria_messages
            (id, "conversationId", role, content, status, "createdAt") VALUES
            ($1, $3, 'user', 'rollback-user', 'COMPLETED', $4::timestamptz),
            ($2, $3, 'assistant', 'rollback-assistant', 'COMPLETED', $5::timestamptz)`,
          [
            ...messageIds,
            conversationId,
            `${timestampPrefix}:00.000Z`,
            `${timestampPrefix}:01.000Z`,
          ],
        );
        const runId = randomUUID();
        const dryRun = await backfillConversationTurns(client, {
          runId,
          mode: 'DRY_RUN',
          sourceDigest: '0'.repeat(64),
        });
        const prerequisiteRunId = randomUUID();
        await sealTurnDryRun(prerequisiteRunId, dryRun);
        await backfillConversationTurns(client, {
          runId,
          mode: 'APPLY',
          sourceDigest: dryRun.sourceDigest,
          prerequisiteRunId,
        });
        return { dryRun, messageIds, prerequisiteRunId, runId };
      };

      const first = await applyPair('2029-03-07T11:00');
      const second = await applyPair('2029-03-07T11:01');

      await expect(rollbackLegacyBackfill(client, first.runId))
        .rejects.toThrow('ARIA_BACKFILL_ROLLBACK_DEPENDENCY_CONFLICT');
      for (const run of [first, second]) {
        await expect(verifyAriaBackfillRun(client, {
          target: 'conversation-turns',
          runId: run.runId,
          sourceDigest: run.dryRun.sourceDigest,
        })).resolves.toMatchObject({ scanned: 2, deterministic: 1, mutated: 1 });
      }
      const stillLinked = await client.query<{ count: number }>(
        `SELECT COUNT(*)::integer AS count FROM aria_messages
         WHERE id = ANY($1::text[]) AND "turnId" IS NOT NULL`,
        [[...first.messageIds, ...second.messageIds]],
      );
      expect(stillLinked.rows[0].count).toBe(4);

      await expect(rollbackLegacyBackfill(client, second.runId))
        .resolves.toMatchObject({ turnsDeleted: 1 });
      await expect(rollbackLegacyBackfill(client, first.runId))
        .resolves.toMatchObject({ turnsDeleted: 1 });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_lifo_rollback_dependency');
    }
  });

  it('B2_EMPTY_COMPLETED_REPLAY_REJECTS_NEW_UNAUDITED_SOURCE_UNIVERSE', async () => {
    await client.query('SAVEPOINT b2_empty_completed_replay');
    try {
      const prerequisiteRunId = randomUUID();
      const runId = randomUUID();
      const snapshot = createAriaBackfillSnapshot({
        target: 'conversation-turns',
        plannerVersion: 2,
        inputs: { groupingContract: { version: 2 }, fixtureId: prerequisiteRunId },
        units: [],
        report: { scanned: 0, deterministic: 0, archived: 0, manualReview: 0 },
      });
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "completedAt")
         VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
                 'COMPLETED', NOW())`,
        [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId")
         VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
                 'RUNNING', $4)`,
        [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      await client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      );

      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt")
         VALUES ($1, $2, 'system', 'late-legacy-source', 'COMPLETED',
                 '2029-03-07 10:02:00.000')`,
        [randomUUID(), ids.deterministicConversation],
      );

      await expect(backfillConversationTurns(client, {
        runId,
        mode: 'APPLY',
        sourceDigest: snapshot.sourceDigest,
        prerequisiteRunId,
      })).rejects.toThrow('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_empty_completed_replay');
    }
  });

  it('B2_TERMINALIZATION_REQUIRES_EXACT_ROW_EVIDENCE', async () => {
    await client.query('SAVEPOINT b2_missing_terminal_evidence');
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const snapshot = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: {
        groupingContract: { version: 2 },
        fixtureId: prerequisiteRunId,
      },
      units: [{ classification: 'ARCHIVED_NON_RESUMABLE' }],
      report: { scanned: 1, deterministic: 0, archived: 1, manualReview: 0 },
    });
    try {
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "scannedCount", "archivedCount", "completedAt")
         VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
                 'COMPLETED', 1, 1, NOW())`,
        [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId")
         VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
                 'RUNNING', $4)`,
        [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      await expect(client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 1, "archivedCount" = 1,
             "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      )).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining('conversation-turn APPLY terminal evidence'),
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_missing_terminal_evidence');
    }
  });

  it('B2_TERMINALIZATION_REJECTS_NONDETERMINISTIC_TARGET', async () => {
    await client.query('SAVEPOINT b2_nondeterministic_target');
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const messageId = randomUUID();
    const snapshot = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: {
        groupingContract: { version: 2 },
        fixtureId: prerequisiteRunId,
      },
      units: [{ classification: 'ARCHIVED_NON_RESUMABLE' }],
      report: { scanned: 1, deterministic: 0, archived: 1, manualReview: 0 },
    });
    try {
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt")
         VALUES ($1, $2, 'system', 'legacy-system', 'COMPLETED', '2029-03-01 10:00:00.000')`,
        [messageId, ids.deterministicConversation],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "scannedCount", "archivedCount", "completedAt")
         VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
                 'COMPLETED', 1, 1, NOW())`,
        [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId")
         VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
                 'RUNNING', $4)`,
        [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      await client.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
           "targetTable", "targetId", "targetKey", "beforeImage")
         VALUES ($1, $2, 'ARIA_MESSAGE_GROUP', $3, $4, 'ARCHIVED_NON_RESUMABLE',
                 'aria_conversation_turns', $5, NULL, $6::jsonb)`,
        [
          randomUUID(),
          runId,
          `legacy_message_group_v2_${'a'.repeat(64)}`,
          'b'.repeat(64),
          randomUUID(),
          JSON.stringify({
            clusterId: null,
            createdAts: ['2029-03-01T10:00:00.000Z'],
            messageIds: [messageId],
            reason: 'SYSTEM_MESSAGE',
            roles: ['system'],
            statuses: ['COMPLETED'],
          }),
        ],
      );
      await expect(client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 1, "archivedCount" = 1,
             "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      )).rejects.toMatchObject({ code: 'P0001' });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_nondeterministic_target');
    }
  });

  it.each([
    {
      classification: 'ARCHIVED_NON_RESUMABLE',
      clusterId: null,
      reason: 'NON_TERMINAL_STATUS',
      role: 'user',
      status: 'PENDING',
      timestamp: '2029-03-01T11:00:00.000Z',
    },
    {
      classification: 'MANUAL_REVIEW_REQUIRED',
      clusterId: 'd'.repeat(64),
      reason: 'UNKNOWN_ROLE',
      role: 'tool',
      status: 'COMPLETED',
      timestamp: '2029-03-01T12:00:00.000Z',
    },
  ] as const)(
    'B2_TERMINALIZATION_REJECTS_FORGED_SINGLETON_IDENTITY_$classification',
    async ({ classification, clusterId, reason, role, status, timestamp }) => {
      await client.query('SAVEPOINT b2_forged_singleton_identity');
      const prerequisiteRunId = randomUUID();
      const runId = randomUUID();
      const messageId = randomUUID();
      const archivedCount = classification === 'ARCHIVED_NON_RESUMABLE' ? 1 : 0;
      const manualReviewCount = classification === 'MANUAL_REVIEW_REQUIRED' ? 1 : 0;
      const snapshot = createAriaBackfillSnapshot({
        target: 'conversation-turns',
        plannerVersion: 2,
        inputs: { groupingContract: { version: 2 }, fixtureId: prerequisiteRunId },
        units: [{ classification }],
        report: {
          scanned: 1,
          deterministic: 0,
          archived: archivedCount,
          manualReview: manualReviewCount,
        },
      });
      try {
        await client.query(
          `INSERT INTO aria_messages
            (id, "conversationId", role, content, status, "createdAt")
           VALUES ($1, $2, $3, 'forged-singleton', $4, $5::timestamptz)`,
          [messageId, ids.deterministicConversation, role, status, timestamp],
        );
        await client.query(
          `INSERT INTO aria_data_migration_runs
            (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
             "scannedCount", "archivedCount", "manualReviewCount", "completedAt")
           VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
                   'COMPLETED', 1, $4, $5, NOW())`,
          [
            prerequisiteRunId,
            JSON.stringify(snapshot.sourceSnapshot),
            snapshot.sourceDigest,
            archivedCount,
            manualReviewCount,
          ],
        );
        await client.query(
          `INSERT INTO aria_data_migration_runs
            (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
             "prerequisiteRunId")
           VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
                   'RUNNING', $4)`,
          [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
        );
        await client.query(
          `INSERT INTO aria_data_migration_row_audits
            (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
             "targetTable", "targetId", "targetKey", "beforeImage")
           VALUES ($1, $2, 'ARIA_MESSAGE_GROUP', $3, $4,
                   $5::"AriaDataMigrationClassification", NULL, NULL, NULL, $6::jsonb)`,
          [
            randomUUID(),
            runId,
            `legacy_message_group_v2_${'e'.repeat(64)}`,
            'f'.repeat(64),
            classification,
            JSON.stringify({
              clusterId,
              createdAts: [timestamp],
              messageIds: [messageId],
              reason,
              roles: [role],
              statuses: [status],
            }),
          ],
        );
        await expect(client.query(
          `UPDATE aria_data_migration_runs
           SET status = 'COMPLETED', "scannedCount" = 1,
               "archivedCount" = $2, "manualReviewCount" = $3, "completedAt" = NOW()
           WHERE id = $1`,
          [runId, archivedCount, manualReviewCount],
        )).rejects.toMatchObject({
          code: 'P0001',
          message: expect.stringContaining('conversation-turn APPLY terminal evidence'),
        });
      } finally {
        await client.query('ROLLBACK TO SAVEPOINT b2_forged_singleton_identity');
      }
    },
  );

  it('B2_TERMINALIZATION_REJECTS_REASON_CLASSIFICATION_DRIFT', async () => {
    await client.query('SAVEPOINT b2_reason_classification_drift');
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const messageId = randomUUID();
    const timestamp = '2029-03-01T13:00:00.000Z';
    const context = await client.query<{
      actorUserId: string;
      contextState: string;
      contextVersion: string | null;
      courseKey: string | null;
      studentId: string;
    }>(
      `SELECT student."userId" AS "actorUserId", conversation."contextState"::text,
              conversation."contextVersion", conversation."courseKey",
              conversation."studentId"
       FROM aria_conversations conversation
       JOIN students student ON student.id = conversation."studentId"
       WHERE conversation.id = $1`,
      [ids.deterministicConversation],
    );
    const row = context.rows[0];
    if (!row) throw new Error('B2_REASON_DRIFT_CONTEXT_MISSING');
    const identitySha256 = stableLegacyFingerprint({
      contractVersion: 2,
      conversationId: ids.deterministicConversation,
      orderedMessageIds: [messageId],
    });
    const sourceId = `legacy_message_group_v2_${identitySha256}`;
    const sourceFingerprint = stableLegacyFingerprint({
      actorUserId: row.actorUserId,
      contextState: row.contextState,
      contextVersion: row.contextVersion,
      contractVersion: 2,
      conversationId: ids.deterministicConversation,
      courseKey: row.courseKey,
      messages: [{
        id: messageId,
        role: 'tool',
        status: 'COMPLETED',
        createdAt: timestamp,
      }],
      studentId: row.studentId,
    });
    const snapshot = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 }, fixtureId: prerequisiteRunId },
      units: [{ classification: 'ARCHIVED_NON_RESUMABLE' }],
      report: { scanned: 1, deterministic: 0, archived: 1, manualReview: 0 },
    });
    try {
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt")
         VALUES ($1, $2, 'tool', 'classification-drift', 'COMPLETED', $3::timestamptz)`,
        [messageId, ids.deterministicConversation, timestamp],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "scannedCount", "archivedCount", "completedAt")
         VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
                 'COMPLETED', 1, 1, NOW())`,
        [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId")
         VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
                 'RUNNING', $4)`,
        [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      await client.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
           "targetTable", "targetId", "targetKey", "beforeImage")
         VALUES ($1, $2, 'ARIA_MESSAGE_GROUP', $3, $4,
                 'ARCHIVED_NON_RESUMABLE', NULL, NULL, NULL, $5::jsonb)`,
        [
          randomUUID(),
          runId,
          sourceId,
          sourceFingerprint,
          JSON.stringify({
            clusterId: null,
            createdAts: [timestamp],
            messageIds: [messageId],
            reason: 'SYSTEM_MESSAGE',
            roles: ['tool'],
            statuses: ['COMPLETED'],
          }),
        ],
      );
      await expect(client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 1, "archivedCount" = 1,
             "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      )).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining('conversation-turn APPLY terminal evidence'),
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_reason_classification_drift');
    }
  });

  it('B2_TERMINALIZATION_REJECTS_OMITTED_SOURCE_AND_POST_DRY_SUBSTITUTION', async () => {
    await client.query('SAVEPOINT b2_omitted_source_substitution');
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const omittedMessageId = randomUUID();
    const substitutedMessageId = randomUUID();
    const substitutedTimestamp = '2029-03-01T13:20:01.000Z';
    const context = await client.query<{
      actorUserId: string;
      contextState: string;
      contextVersion: string | null;
      courseKey: string | null;
      studentId: string;
    }>(
      `SELECT student."userId" AS "actorUserId", conversation."contextState"::text,
              conversation."contextVersion", conversation."courseKey",
              conversation."studentId"
       FROM aria_conversations conversation
       JOIN students student ON student.id = conversation."studentId"
       WHERE conversation.id = $1`,
      [ids.deterministicConversation],
    );
    const row = context.rows[0];
    if (!row) throw new Error('B2_SUBSTITUTION_CONTEXT_MISSING');
    const sourceId = `legacy_message_group_v2_${stableLegacyFingerprint({
      contractVersion: 2,
      conversationId: ids.deterministicConversation,
      orderedMessageIds: [substitutedMessageId],
    })}`;
    const sourceFingerprint = stableLegacyFingerprint({
      actorUserId: row.actorUserId,
      contextState: row.contextState,
      contextVersion: row.contextVersion,
      contractVersion: 2,
      conversationId: ids.deterministicConversation,
      courseKey: row.courseKey,
      messages: [{
        id: substitutedMessageId,
        role: 'system',
        status: 'COMPLETED',
        createdAt: substitutedTimestamp,
      }],
      studentId: row.studentId,
    });
    const snapshot = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 }, fixtureId: prerequisiteRunId },
      units: [{ classification: 'ARCHIVED_NON_RESUMABLE' }],
      report: { scanned: 1, deterministic: 0, archived: 1, manualReview: 0 },
    });
    try {
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt")
         VALUES ($1, $2, 'system', 'omitted-source', 'COMPLETED',
                 '2029-03-01 13:20:00.000+00')`,
        [omittedMessageId, ids.deterministicConversation],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "scannedCount", "archivedCount", "completedAt")
         VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
                 'COMPLETED', 1, 1, NOW())`,
        [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
      );
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt")
         VALUES ($1, $2, 'system', 'post-dry-substitute', 'COMPLETED', $3::timestamptz)`,
        [substitutedMessageId, ids.deterministicConversation, substitutedTimestamp],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId")
         VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
                 'RUNNING', $4)`,
        [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      await client.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
           "targetTable", "targetId", "targetKey", "beforeImage")
         VALUES ($1, $2, 'ARIA_MESSAGE_GROUP', $3, $4,
                 'ARCHIVED_NON_RESUMABLE', NULL, NULL, NULL, $5::jsonb)`,
        [
          randomUUID(),
          runId,
          sourceId,
          sourceFingerprint,
          JSON.stringify({
            clusterId: null,
            createdAts: [substitutedTimestamp],
            messageIds: [substitutedMessageId],
            reason: 'SYSTEM_MESSAGE',
            roles: ['system'],
            statuses: ['COMPLETED'],
          }),
        ],
      );
      await expect(client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 1, "archivedCount" = 1,
             "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      )).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining('conversation-turn APPLY terminal evidence'),
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_omitted_source_substitution');
    }
  });

  it('B2_REPLAY_AND_ROLLBACK_REJECT_OMITTED_SOURCE_AND_POST_DRY_SUBSTITUTION', async () => {
    await client.query('SAVEPOINT b2_omitted_source_substitution_replay');
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const omittedMessageId = randomUUID();
    const substitutedMessageId = randomUUID();
    const omittedTimestamp = '2029-03-01T13:30:00.000Z';
    const substitutedTimestamp = '2029-03-01T13:30:01.000Z';
    try {
      const context = await client.query<LegacyMessageBackfillInput>(
        `SELECT $2::text AS id, conversation.id AS "conversationId",
                'system'::text AS role, 'COMPLETED'::text AS status,
                $3::text AS "createdAt", conversation."studentId",
                student."userId" AS "actorUserId", conversation."courseKey",
                conversation."contextState"::text, conversation."contextVersion"
         FROM aria_conversations conversation
         JOIN students student ON student.id = conversation."studentId"
         WHERE conversation.id = $1`,
        [ids.deterministicConversation, substitutedMessageId, substitutedTimestamp],
      );
      const substituted = context.rows[0];
      if (!substituted) throw new Error('B2_SUBSTITUTION_REPLAY_CONTEXT_MISSING');
      const planned = planConversationTurnBackfill([substituted], new Map());
      const group = planned.groups[0];
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt") VALUES
          ($1, $3, 'system', 'omitted-replay-source', 'COMPLETED', $4::timestamptz),
          ($2, $3, 'system', 'post-dry-replay-substitute', 'COMPLETED', $5::timestamptz)`,
        [
          omittedMessageId,
          substitutedMessageId,
          ids.deterministicConversation,
          omittedTimestamp,
          substitutedTimestamp,
        ],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "scannedCount", "archivedCount", "completedAt")
         VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
                 'COMPLETED', 1, 1, NOW())`,
        [prerequisiteRunId, JSON.stringify(planned.sourceSnapshot), planned.sourceDigest],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId")
         VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
                 'RUNNING', $4)`,
        [runId, JSON.stringify(planned.sourceSnapshot), planned.sourceDigest, prerequisiteRunId],
      );
      await client.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
           "targetTable", "targetId", "targetKey", "beforeImage")
         VALUES ($1, $2, 'ARIA_MESSAGE_GROUP', $3, $4,
                 'ARCHIVED_NON_RESUMABLE', NULL, NULL, NULL, $5::jsonb)`,
        [
          randomUUID(),
          runId,
          group.sourceId,
          group.sourceFingerprint,
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
      await client.query("SET LOCAL session_replication_role = 'replica'");
      await client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 1, "archivedCount" = 1,
             "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      );
      await client.query("SET LOCAL session_replication_role = 'origin'");
      const replayOutcome = await backfillConversationTurns(client, {
        runId,
        mode: 'APPLY',
        sourceDigest: planned.sourceDigest,
        prerequisiteRunId,
      }).then(() => 'RESOLVED', (error: Error) => error.message);
      const rollbackOutcome = await rollbackLegacyBackfill(client, runId)
        .then(() => 'RESOLVED', (error: Error) => error.message);
      expect(replayOutcome).toBe('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
      expect(rollbackOutcome).toBe('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_omitted_source_substitution_replay');
    }
  });

  it('B2_TERMINALIZATION_REJECTS_NON_PLANNER_SEQUENCE_OR_NONCONTIGUOUS_PAIR_SEQUENCE', async () => {
    await client.query('SAVEPOINT b2_non_planner_sequence');
    try {
      const { runId } = await seedDirectDeterministicTurnEvidence({
        conversationId: ids.deterministicConversation,
        sequence: 999,
        timestampPrefix: '2029-03-01T14:00',
      });
      await expect(client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 2, "deterministicCount" = 1,
             "mutatedCount" = 1, "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      )).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining('conversation-turn APPLY terminal evidence'),
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_non_planner_sequence');
    }
  });

  it('B2_TERMINALIZATION_REJECTS_UNAUDITED_RUN_TARGET', async () => {
    await client.query('SAVEPOINT b2_unaudited_run_target');
    try {
      const { runId } = await seedDirectDeterministicTurnEvidence({
        conversationId: ids.deterministicConversation,
        timestampPrefix: '2029-03-01T14:10',
      });
      await insertUnauditedRunTurn(runId, ids.deterministicConversation);
      await expect(client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 2, "deterministicCount" = 1,
             "mutatedCount" = 1, "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      )).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining('conversation-turn APPLY terminal evidence'),
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_unaudited_run_target');
    }
  });

  it('B2_REPLAY_AND_ROLLBACK_REJECT_UNAUDITED_RUN_TARGET', async () => {
    await client.query('SAVEPOINT b2_unaudited_run_target_replay');
    try {
      const evidence = await seedDirectDeterministicTurnEvidence({
        conversationId: ids.deterministicConversation,
        timestampPrefix: '2029-03-01T14:20',
      });
      const unauditedTurnId = await insertUnauditedRunTurn(
        evidence.runId,
        ids.deterministicConversation,
      );
      await client.query("SET LOCAL session_replication_role = 'replica'");
      await client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 2, "deterministicCount" = 1,
             "mutatedCount" = 1, "completedAt" = NOW()
         WHERE id = $1`,
        [evidence.runId],
      );
      await client.query("SET LOCAL session_replication_role = 'origin'");
      const replayOutcome = await backfillConversationTurns(client, {
        runId: evidence.runId,
        mode: 'APPLY',
        sourceDigest: evidence.sourceDigest,
        prerequisiteRunId: evidence.prerequisiteRunId,
      }).then(() => 'RESOLVED', (error: Error) => error.message);
      const rollbackOutcome = await rollbackLegacyBackfill(client, evidence.runId)
        .then(() => 'RESOLVED', (error: Error) => error.message);
      expect(replayOutcome).toBe('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
      expect(rollbackOutcome).toBe('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
      const unaudited = await client.query<{ count: number }>(
        `SELECT COUNT(*)::integer AS count FROM aria_conversation_turns
         WHERE id = $1 AND "migrationRunId" = $2`,
        [unauditedTurnId, evidence.runId],
      );
      expect(unaudited.rows[0].count).toBe(1);
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_unaudited_run_target_replay');
    }
  });

  it('B2_TERMINALIZATION_REJECTS_NON_PLANNER_SEQUENCE_OR_NONCONTIGUOUS_PAIR_MESSAGES', async () => {
    await client.query('SAVEPOINT b2_noncontiguous_pair');
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const userMessageId = randomUUID();
    const systemMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    const userCreatedAt = '2029-03-01T15:00:00.000Z';
    const systemCreatedAt = '2029-03-01T15:00:00.500Z';
    const assistantCreatedAt = '2029-03-01T15:00:01.000Z';
    const context = await client.query<{
      actorUserId: string;
      contextState: string;
      contextVersion: string | null;
      courseKey: string | null;
      maximumSequence: number;
      studentId: string;
    }>(
      `SELECT student."userId" AS "actorUserId", conversation."contextState"::text,
              conversation."contextVersion", conversation."courseKey",
              conversation."studentId", COALESCE(MAX(turn.sequence), 0)::integer AS "maximumSequence"
       FROM aria_conversations conversation
       JOIN students student ON student.id = conversation."studentId"
       LEFT JOIN aria_conversation_turns turn ON turn."conversationId" = conversation.id
       WHERE conversation.id = $1
       GROUP BY student."userId", conversation."contextState", conversation."contextVersion",
                conversation."courseKey", conversation."studentId"`,
      [ids.deterministicConversation],
    );
    const row = context.rows[0];
    if (!row || row.courseKey === null) throw new Error('B2_NONCONTIGUOUS_CONTEXT_MISSING');
    const pairIdentity = stableLegacyFingerprint({
      contractVersion: 2,
      conversationId: ids.deterministicConversation,
      orderedMessageIds: [userMessageId, assistantMessageId],
    });
    const pairSourceId = `legacy_message_group_v2_${pairIdentity}`;
    const turnId = `legacy_turn_v2_${pairIdentity}`;
    const pairFingerprint = stableLegacyFingerprint({
      actorUserId: row.actorUserId,
      contextState: row.contextState,
      contextVersion: row.contextVersion,
      contractVersion: 2,
      conversationId: ids.deterministicConversation,
      courseKey: row.courseKey,
      messages: [
        { id: userMessageId, role: 'user', status: 'COMPLETED', createdAt: userCreatedAt },
        {
          id: assistantMessageId,
          role: 'assistant',
          status: 'COMPLETED',
          createdAt: assistantCreatedAt,
        },
      ],
      studentId: row.studentId,
    });
    const systemIdentity = stableLegacyFingerprint({
      contractVersion: 2,
      conversationId: ids.deterministicConversation,
      orderedMessageIds: [systemMessageId],
    });
    const systemSourceId = `legacy_message_group_v2_${systemIdentity}`;
    const systemFingerprint = stableLegacyFingerprint({
      actorUserId: row.actorUserId,
      contextState: row.contextState,
      contextVersion: row.contextVersion,
      contractVersion: 2,
      conversationId: ids.deterministicConversation,
      courseKey: row.courseKey,
      messages: [{
        id: systemMessageId,
        role: 'system',
        status: 'COMPLETED',
        createdAt: systemCreatedAt,
      }],
      studentId: row.studentId,
    });
    const sequence = row.maximumSequence + 1;
    const snapshot = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 }, fixtureId: prerequisiteRunId },
      units: [
        { classification: 'DETERMINISTIC_BACKFILL' },
        { classification: 'ARCHIVED_NON_RESUMABLE' },
      ],
      report: { scanned: 3, deterministic: 1, archived: 1, manualReview: 0 },
    });
    try {
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt") VALUES
          ($1, $4, 'user', 'noncontiguous-user', 'COMPLETED', $5::timestamptz),
          ($2, $4, 'system', 'noncontiguous-system', 'COMPLETED', $6::timestamptz),
          ($3, $4, 'assistant', 'noncontiguous-assistant', 'COMPLETED', $7::timestamptz)`,
        [
          userMessageId,
          systemMessageId,
          assistantMessageId,
          ids.deterministicConversation,
          userCreatedAt,
          systemCreatedAt,
          assistantCreatedAt,
        ],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "scannedCount", "deterministicCount", "archivedCount", "completedAt")
         VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
                 'COMPLETED', 3, 1, 1, NOW())`,
        [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId")
         VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
                 'RUNNING', $4)`,
        [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      await client.query(
        `INSERT INTO aria_conversation_turns
          (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
           "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
           "pedagogicalMode", "agentRole", visibility, "completedAt", "migrationRunId",
           "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'LEGACY_IMPORT', $5, $6, $7, 'COMPLETED',
                 $8::jsonb, 'LEGACY_UNSPECIFIED', 'LEGACY_IMPORT', 'STUDENT_PRIVATE',
                 $9::timestamptz, $10, $11::timestamptz, NOW())`,
        [
          turnId,
          ids.deterministicConversation,
          row.studentId,
          row.actorUserId,
          pairSourceId,
          pairFingerprint,
          sequence,
          JSON.stringify({
            contextVersion: row.contextVersion,
            courseKey: row.courseKey,
            provenance: 'LEGACY_IMPORT',
          }),
          assistantCreatedAt,
          runId,
          userCreatedAt,
        ],
      );
      await client.query(
        `UPDATE aria_messages SET "turnId" = $3,
             "turnRole" = CASE id WHEN $1 THEN 'USER'::"AriaConversationTurnMessageRole"
                                   ELSE 'ASSISTANT'::"AriaConversationTurnMessageRole" END
         WHERE id IN ($1, $2)`,
        [userMessageId, assistantMessageId, turnId],
      );
      await client.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
           "targetTable", "targetId", "targetKey", "beforeImage") VALUES
          ($1, $3, 'ARIA_MESSAGE_GROUP', $4, $5, 'DETERMINISTIC_BACKFILL',
           'aria_conversation_turns', $6, $7::jsonb, $8::jsonb),
          ($2, $3, 'ARIA_MESSAGE_GROUP', $9, $10, 'ARCHIVED_NON_RESUMABLE',
           NULL, NULL, NULL, $11::jsonb)`,
        [
          randomUUID(),
          randomUUID(),
          runId,
          pairSourceId,
          pairFingerprint,
          turnId,
          JSON.stringify({
            contractVersion: 2,
            messageIds: [userMessageId, assistantMessageId],
            sequence,
            status: 'COMPLETED',
            turnId,
          }),
          JSON.stringify({
            clusterId: null,
            createdAts: [userCreatedAt, assistantCreatedAt],
            messageIds: [userMessageId, assistantMessageId],
            reason: 'PAIR_COMPLETED',
            roles: ['user', 'assistant'],
            statuses: ['COMPLETED', 'COMPLETED'],
          }),
          systemSourceId,
          systemFingerprint,
          JSON.stringify({
            clusterId: null,
            createdAts: [systemCreatedAt],
            messageIds: [systemMessageId],
            reason: 'SYSTEM_MESSAGE',
            roles: ['system'],
            statuses: ['COMPLETED'],
          }),
        ],
      );
      await expect(client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 3, "deterministicCount" = 1,
             "archivedCount" = 1, "mutatedCount" = 1, "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      )).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining('conversation-turn APPLY terminal evidence'),
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_noncontiguous_pair');
    }
  });

  it('B2_TERMINALIZATION_REJECTS_MALFORMED_OR_FORGED_TARGET_EVIDENCE', async () => {
    await client.query('SAVEPOINT b2_forged_target');
    const prerequisiteRunId = randomUUID();
    const runId = randomUUID();
    const userMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    const turnId = `legacy_turn_v2_${'c'.repeat(64)}`;
    const sourceId = `legacy_message_group_v2_${'a'.repeat(64)}`;
    const sourceFingerprint = 'b'.repeat(64);
    const snapshot = createAriaBackfillSnapshot({
      target: 'conversation-turns',
      plannerVersion: 2,
      inputs: { groupingContract: { version: 2 }, fixtureId: prerequisiteRunId },
      units: [{ classification: 'DETERMINISTIC_BACKFILL' }],
      report: { scanned: 2, deterministic: 1, archived: 0, manualReview: 0 },
    });
    try {
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "scannedCount", "deterministicCount", "completedAt")
         VALUES ($1, 'aria-conversation-turns-v1', 'DRY_RUN', $2::jsonb, $3,
                 'COMPLETED', 2, 1, NOW())`,
        [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
      );
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId")
         VALUES ($1, 'aria-conversation-turns-v1', 'APPLY', $2::jsonb, $3,
                 'RUNNING', $4)`,
        [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt") VALUES
          ($1, $3, 'user', 'forged-user', 'COMPLETED', '2029-03-02 10:00:00.000'),
          ($2, $3, 'assistant', 'forged-assistant', 'COMPLETED', '2029-03-02 10:00:01.000')`,
        [userMessageId, assistantMessageId, ids.deterministicConversation],
      );
      await client.query(
        `INSERT INTO aria_conversation_turns
          (id, "conversationId", "subjectStudentId", "actorUserId", "useCase",
           "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
           "pedagogicalMode", "agentRole", visibility, "completedAt", "migrationRunId",
           "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'LEGACY_IMPORT', $5, $6, 999, 'COMPLETED',
                 '{"courseKey":"wrong-course","contextVersion":"wrong","provenance":"FORGED"}',
                 'DISCOVERY', 'TUTOR', 'COACH_VISIBLE', '2029-03-02 09:00:01.000', $7,
                 '2029-03-02 09:00:00.000', NOW())`,
        [
          turnId,
          ids.deterministicConversation,
          ids.student,
          ids.parentUser,
          sourceId,
          sourceFingerprint,
          runId,
        ],
      );
      await client.query(
        `UPDATE aria_messages SET "turnId" = $3,
             "turnRole" = CASE id WHEN $1 THEN 'USER'::"AriaConversationTurnMessageRole"
                                   ELSE 'ASSISTANT'::"AriaConversationTurnMessageRole" END
         WHERE id IN ($1, $2)`,
        [userMessageId, assistantMessageId, turnId],
      );
      await client.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
           "targetTable", "targetId", "targetKey", "beforeImage")
         VALUES ($1, $2, 'ARIA_MESSAGE_GROUP', $3, $4, 'DETERMINISTIC_BACKFILL',
                 'aria_conversation_turns', $5, $6::jsonb, $7::jsonb)`,
        [
          randomUUID(),
          runId,
          sourceId,
          sourceFingerprint,
          turnId,
          JSON.stringify({
            contractVersion: 2,
            messageIds: [userMessageId, assistantMessageId],
            sequence: 999,
            status: 'COMPLETED',
            turnId,
          }),
          JSON.stringify({
            clusterId: null,
            createdAts: ['2029-03-02T10:00:00.000Z', '2029-03-02T10:00:01.000Z'],
            messageIds: [userMessageId, assistantMessageId],
            reason: 'PAIR_COMPLETED',
            roles: ['user', 'assistant'],
            statuses: ['COMPLETED', 'COMPLETED'],
          }),
        ],
      );
      await expect(client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 2, "deterministicCount" = 1,
             "mutatedCount" = 1, "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      )).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining('conversation-turn APPLY terminal evidence'),
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_forged_target');
    }
  });

  it.each([
    ['sourceId', '2029-03-03T10:00'],
    ['turnId', '2029-03-04T10:00'],
    ['sourceFingerprint', '2029-03-05T10:00'],
  ] as const)(
    'B2_TERMINALIZATION_REJECTS_FORGED_CANONICAL_IDENTITY_%s',
    async (forgedField, timestampPrefix) => {
      await client.query('SAVEPOINT b2_forged_canonical_identity');
      try {
        const { runId } = await seedDirectDeterministicTurnEvidence({
          conversationId: ids.deterministicConversation,
          forgedField,
          timestampPrefix,
        });
        await expect(client.query(
          `UPDATE aria_data_migration_runs
           SET status = 'COMPLETED', "scannedCount" = 2, "deterministicCount" = 1,
               "mutatedCount" = 1, "completedAt" = NOW()
           WHERE id = $1`,
          [runId],
        )).rejects.toMatchObject({
          code: 'P0001',
          message: expect.stringContaining('conversation-turn APPLY terminal evidence'),
        });
      } finally {
        await client.query('ROLLBACK TO SAVEPOINT b2_forged_canonical_identity');
      }
    },
  );

  it('B2_SQL_IDENTITY_MATCHES_PLANNER_V2_BYTE_FOR_BYTE', async () => {
    const rows: LegacyMessageBackfillInput[] = [
      {
        id: 'message-user-"\\-é',
        conversationId: 'conversation-"\\-élève',
        role: 'user',
        status: 'COMPLETED',
        createdAt: '2029-03-07T10:00:00.000Z',
        studentId: 'student-"\\-é',
        actorUserId: 'actor-"\\-é',
        courseKey: 'course-"\\-é',
        contextState: 'ACTIVE',
        contextVersion: null,
      },
      {
        id: 'message-assistant-"\\-é',
        conversationId: 'conversation-"\\-élève',
        role: 'assistant',
        status: 'ERROR',
        createdAt: '2029-03-07T10:00:01.000Z',
        studentId: 'student-"\\-é',
        actorUserId: 'actor-"\\-é',
        courseKey: 'course-"\\-é',
        contextState: 'ACTIVE',
        contextVersion: null,
      },
    ];
    const planned = planConversationTurnBackfill(rows, new Map());
    const group = planned.groups[0];
    const sql = await client.query<{
      identitySha256: string;
      sourceFingerprint: string;
    }>(
      `SELECT public."aria_turn_v2_identity_sha256"($1, ARRAY[$2, $3])
                AS "identitySha256",
              public."aria_turn_v2_source_fingerprint"(
                $4, $5, $6, $1, $7,
                ARRAY[$2, $3], ARRAY[$8, $11], ARRAY[$9, $12], ARRAY[$10, $13], $14
              ) AS "sourceFingerprint"`,
      [
        rows[0].conversationId,
        rows[0].id,
        rows[1].id,
        rows[0].actorUserId,
        rows[0].contextState,
        rows[0].contextVersion,
        rows[0].courseKey,
        rows[0].role,
        rows[0].status,
        rows[0].createdAt,
        rows[1].role,
        rows[1].status,
        rows[1].createdAt,
        rows[0].studentId,
      ],
    );
    expect(sql.rows[0]).toEqual({
      identitySha256: group.sourceId.replace('legacy_message_group_v2_', ''),
      sourceFingerprint: group.sourceFingerprint,
    });
    expect(group.turnId).toBe(`legacy_turn_v2_${sql.rows[0].identitySha256}`);

    for (const singleton of [
      { ...rows[0], id: 'pending-"\\-é', status: 'PENDING' },
      { ...rows[0], id: 'tool-"\\-é', role: 'tool' },
    ]) {
      const singletonPlan = planConversationTurnBackfill([singleton], new Map());
      const singletonGroup = singletonPlan.groups[0];
      const singletonSql = await client.query<{
        clusterSha256: string;
        identitySha256: string;
        sourceFingerprint: string;
      }>(
        `SELECT public."aria_turn_v2_identity_sha256"($1, ARRAY[$2])
                  AS "identitySha256",
                public."aria_turn_v2_source_fingerprint"(
                  $3, $4, $5, $1, $6,
                  ARRAY[$2], ARRAY[$7], ARRAY[$8], ARRAY[$9], $10
                ) AS "sourceFingerprint",
                public."aria_turn_v2_ambiguous_cluster_sha256"(
                  $1, ARRAY[$9], ARRAY[$2], ARRAY[$7], ARRAY[$8]
                ) AS "clusterSha256"`,
        [
          singleton.conversationId,
          singleton.id,
          singleton.actorUserId,
          singleton.contextState,
          singleton.contextVersion,
          singleton.courseKey,
          singleton.role,
          singleton.status,
          singleton.createdAt,
          singleton.studentId,
        ],
      );
      expect(singletonSql.rows[0]).toMatchObject({
        identitySha256: singletonGroup.sourceId.replace('legacy_message_group_v2_', ''),
        sourceFingerprint: singletonGroup.sourceFingerprint,
      });
      if (singletonGroup.kind === 'MANUAL') {
        expect(singletonSql.rows[0].clusterSha256).toBe(singletonGroup.clusterId);
      }
    }
  });

  it('B2_TERMINALIZATION_REJECTS_UNRESOLVED_CONTEXT_PAIR', async () => {
    await client.query('SAVEPOINT b2_unresolved_context_pair');
    try {
      const { runId } = await seedDirectDeterministicTurnEvidence({
        conversationId: ids.ambiguousConversation,
        timestampPrefix: '2029-03-06T10:00',
      });
      await expect(client.query(
        `UPDATE aria_data_migration_runs
         SET status = 'COMPLETED', "scannedCount" = 2, "deterministicCount" = 1,
             "mutatedCount" = 1, "completedAt" = NOW()
         WHERE id = $1`,
        [runId],
      )).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining('conversation-turn APPLY terminal evidence'),
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_unresolved_context_pair');
    }
  });

  it('D021 B2_APPLY_PERSISTS_EXACT_GROUP_COUNTS_AND_MANUAL_AUDITS', async () => {
    const assistantStatuses = [
      'COMPLETED', 'CANCELLED', 'ERROR', 'COMPLETED',
      'CANCELLED', 'ERROR', 'COMPLETED', 'COMPLETED',
    ] as const;
    const fixtureRows: Array<Readonly<{
      id: string;
      role: string;
      content: string;
      status: string;
      createdAt: string;
    }>> = [];
    for (const [pairIndex, assistantStatus] of assistantStatuses.entries()) {
      fixtureRows.push({
        id: randomUUID(),
        role: 'user',
        content: `pair-${pairIndex}-user`,
        status: 'COMPLETED',
        createdAt: `2029-01-01T10:00:${String(pairIndex * 2).padStart(2, '0')}.000Z`,
      });
      fixtureRows.push({
        id: randomUUID(),
        role: 'assistant',
        content: `pair-${pairIndex}-assistant`,
        status: assistantStatus,
        createdAt: `2029-01-01T10:00:${String(pairIndex * 2 + 1).padStart(2, '0')}.000Z`,
      });
    }
    fixtureRows.push(
      {
        id: randomUUID(), role: 'user', content: 'pending', status: 'PENDING',
        createdAt: '2029-01-01T10:00:16.000Z',
      },
      {
        id: randomUUID(), role: 'assistant', content: 'streaming', status: 'STREAMING',
        createdAt: '2029-01-01T10:00:17.000Z',
      },
      {
        id: randomUUID(), role: 'system', content: 'system', status: 'COMPLETED',
        createdAt: '2029-01-01T10:00:18.000Z',
      },
      {
        id: randomUUID(), role: 'user', content: 'equal-user', status: 'COMPLETED',
        createdAt: '2029-01-01T10:00:19.000Z',
      },
      {
        id: randomUUID(), role: 'assistant', content: 'equal-assistant', status: 'COMPLETED',
        createdAt: '2029-01-01T10:00:19.000Z',
      },
      {
        id: randomUUID(), role: 'tool', content: 'unknown-role', status: 'COMPLETED',
        createdAt: '2029-01-01T10:00:20.000Z',
      },
      {
        id: randomUUID(), role: 'user', content: 'unknown-status', status: 'BROKEN',
        createdAt: '2029-01-01T10:00:21.000Z',
      },
      {
        id: randomUUID(), role: 'assistant', content: 'orphan-assistant', status: 'COMPLETED',
        createdAt: '2029-01-01T10:00:22.000Z',
      },
    );
    const messageIds = fixtureRows.map(({ id }) => id);
    const values: unknown[] = [];
    const placeholders = fixtureRows.map((row, rowIndex) => {
      const offset = rowIndex * 6;
      values.push(
        row.id,
        ids.deterministicConversation,
        row.role,
        row.content,
        row.status,
        row.createdAt,
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::timestamptz)`;
    });
    await client.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt") VALUES
        ${placeholders.join(',\n')}`,
      values,
    );
    const runId = randomUUID();
    const messageBeforeImages = new Map(fixtureRows.map(({ id, role, status }) => [
      id,
      { role, status },
    ]));
    const dryRun = await backfillConversationTurns(client, {
      runId, mode: 'DRY_RUN', sourceDigest: '0'.repeat(64),
    });
    expect(dryRun).toMatchObject({
      scannedMessages: 24,
      deterministicGroups: 8,
      archivedGroups: 4,
      manualReviewGroups: 4,
      turnsCreated: 0,
    });
    await sealTurnDryRun(`${runId}-audit`, dryRun);

    const applied = await backfillConversationTurns(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: `${runId}-audit`,
    });
    expect(applied).toMatchObject({
      scannedMessages: 24,
      deterministicGroups: 8,
      archivedGroups: 4,
      manualReviewGroups: 4,
      turnsCreated: 8,
    });
    const run = await client.query<{
      scannedCount: number;
      deterministicCount: number;
      archivedCount: number;
      manualReviewCount: number;
      mutatedCount: number;
    }>(
      `SELECT "scannedCount", "deterministicCount", "archivedCount",
              "manualReviewCount", "mutatedCount"
       FROM aria_data_migration_runs WHERE id = $1`,
      [runId],
    );
    expect(run.rows[0]).toEqual({
      scannedCount: 24,
      deterministicCount: 8,
      archivedCount: 4,
      manualReviewCount: 4,
      mutatedCount: 8,
    });
    const audits = await client.query<{
      id: string;
      classification: string;
      targetTable: string | null;
      targetId: string | null;
      targetKey: unknown;
      beforeImage: {
        clusterId: string | null;
        createdAts: string[];
        messageIds: string[];
        reason: string;
      };
      createdAt: Date;
    }>(
      `SELECT id, classification::text, "targetTable", "targetId", "targetKey",
              "beforeImage", "createdAt"
       FROM aria_data_migration_row_audits WHERE "runId" = $1
       ORDER BY classification::text, "sourceId"`,
      [runId],
    );
    expect(audits.rows.filter(({ classification }) =>
      classification === 'DETERMINISTIC_BACKFILL')).toHaveLength(8);
    expect(audits.rows.filter(({ classification }) =>
      classification === 'ARCHIVED_NON_RESUMABLE')).toHaveLength(4);
    expect(audits.rows.filter(({ classification }) =>
      classification === 'MANUAL_REVIEW_REQUIRED')).toHaveLength(4);
    const nonDeterministic = audits.rows.filter(({ classification }) =>
      classification !== 'DETERMINISTIC_BACKFILL');
    expect(nonDeterministic.every(({ targetTable, targetId, targetKey }) =>
      targetTable === null && targetId === null && targetKey === null)).toBe(true);
    const manual = audits.rows.filter(({ classification }) =>
      classification === 'MANUAL_REVIEW_REQUIRED');
    expect(manual.every(({ beforeImage }) =>
      /^[0-9a-f]{64}$/.test(beforeImage.clusterId ?? ''))).toBe(true);
    const manualClusterSizes = [...manual.reduce((counts, { beforeImage }) => {
      const clusterId = beforeImage.clusterId as string;
      counts.set(clusterId, (counts.get(clusterId) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()).values()].sort((left, right) => left - right);
    expect(manualClusterSizes).toEqual([1, 1, 2]);
    expect(manual.every(({ beforeImage }) => beforeImage.createdAts.length === 1)).toBe(true);

    const turns = await client.query<{ status: string; count: number }>(
      `SELECT status::text, COUNT(*)::integer AS count
       FROM aria_conversation_turns WHERE "migrationRunId" = $1
       GROUP BY status::text ORDER BY status::text`,
      [runId],
    );
    expect(turns.rows).toEqual([
      { status: 'CANCELLED', count: 2 },
      { status: 'COMPLETED', count: 4 },
      { status: 'ERROR', count: 2 },
    ]);
    const linkedMessages = await client.query<{
      id: string;
      role: string;
      status: string;
      turnRole: string;
    }>(
      `SELECT id, role, status, "turnRole"::text
       FROM aria_messages WHERE id = ANY($1::text[]) AND "turnId" IS NOT NULL`,
      [messageIds],
    );
    expect(linkedMessages.rows).toHaveLength(16);
    expect(linkedMessages.rows.filter(({ turnRole }) => turnRole === 'USER'))
      .toHaveLength(8);
    expect(linkedMessages.rows.filter(({ turnRole, role, status }) =>
      turnRole === 'USER' && role === 'user' && status === 'COMPLETED'))
      .toHaveLength(8);
    expect(linkedMessages.rows.filter(({ turnRole, status }) =>
      turnRole === 'ASSISTANT' && status === 'CANCELLED')).toHaveLength(2);
    expect(linkedMessages.rows.filter(({ turnRole, status }) =>
      turnRole === 'ASSISTANT' && status === 'ERROR')).toHaveLength(2);
    expect(linkedMessages.rows.filter(({ turnRole, status }) =>
      turnRole === 'ASSISTANT' && status === 'COMPLETED')).toHaveLength(4);

    const replay = await backfillConversationTurns(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: `${runId}-audit`,
    });
    expect(replay).toEqual(applied);
    const auditsAfterReplay = await client.query(
      `SELECT id, classification::text, "targetTable", "targetId", "targetKey",
              "beforeImage", "createdAt"
       FROM aria_data_migration_row_audits WHERE "runId" = $1
       ORDER BY classification::text, "sourceId"`,
      [runId],
    );
    expect(auditsAfterReplay.rows).toEqual(audits.rows);
    const remaining = await backfillConversationTurns(client, {
      runId: randomUUID(), mode: 'DRY_RUN', sourceDigest: '0'.repeat(64),
    });
    expect(remaining.scannedMessages).toBe(0);
    await client.query('SAVEPOINT b2_verify_target_drift');
    try {
      await client.query(
        `UPDATE aria_conversation_turns SET "pedagogicalMode" = 'DISCOVERY'
         WHERE "migrationRunId" = $1`,
        [runId],
      );
      await expect(verifyAriaBackfillRun(client, {
        target: 'conversation-turns',
        runId,
        sourceDigest: dryRun.sourceDigest,
      })).rejects.toThrow('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_verify_target_drift');
    }

    await expect(verifyAriaBackfillRun(client, {
      target: 'conversation-turns',
      runId,
      sourceDigest: dryRun.sourceDigest,
    })).resolves.toMatchObject({
      scanned: 24,
      deterministic: 8,
      archived: 4,
      manualReview: 4,
      mutated: 8,
      auditRows: 16,
      targetRows: 8,
    });
    await expect(rollbackLegacyBackfill(client, runId)).resolves.toMatchObject({
      turnsDeleted: 8,
      contextsRestored: 0,
    });
    const auditsAfterRollback = await client.query(
      `SELECT id, classification::text, "targetTable", "targetId", "targetKey",
              "beforeImage", "createdAt"
       FROM aria_data_migration_row_audits WHERE "runId" = $1
       ORDER BY classification::text, "sourceId"`,
      [runId],
    );
    expect(auditsAfterRollback.rows).toEqual(audits.rows);
    const messagesAfterRollback = await client.query<{
      id: string;
      role: string;
      status: string;
      turnId: string | null;
    }>(
      `SELECT id, role, status, "turnId" FROM aria_messages
       WHERE id = ANY($1::text[]) ORDER BY "createdAt", id`,
      [messageIds],
    );
    expect(messagesAfterRollback.rows).toHaveLength(24);
    expect(messagesAfterRollback.rows.every(({ turnId }) => turnId === null)).toBe(true);
    expect(new Map(messagesAfterRollback.rows.map(({ id, role, status }) => [
      id,
      { role, status },
    ]))).toEqual(messageBeforeImages);
    await client.query('DELETE FROM aria_messages WHERE id = ANY($1::text[])', [messageIds]);
  });

  it('B2_UNRESOLVED_CONTEXT_MESSAGES_ARE_AUDITED_WITHOUT_A_TURN', async () => {
    const messageIds = [randomUUID(), randomUUID()];
    await client.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt") VALUES
        ($1, $3, 'user', 'unresolved-user', 'COMPLETED', '2029-02-01 10:00:00.000'),
        ($2, $3, 'assistant', 'unresolved-assistant', 'COMPLETED', '2029-02-01 10:00:01.000')`,
      [...messageIds, ids.ambiguousConversation],
    );
    const runId = randomUUID();
    const dryRun = await backfillConversationTurns(client, {
      runId, mode: 'DRY_RUN', sourceDigest: '0'.repeat(64),
    });
    expect(dryRun).toMatchObject({
      scannedMessages: 2,
      deterministicGroups: 0,
      archivedGroups: 2,
      manualReviewGroups: 0,
    });
    await sealTurnDryRun(`${runId}-audit`, dryRun);
    await backfillConversationTurns(client, {
      runId, mode: 'APPLY', sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: `${runId}-audit`,
    });
    const linked = await client.query<{ count: number }>(
      'SELECT COUNT(*)::integer AS count FROM aria_messages WHERE id = ANY($1::text[]) AND "turnId" IS NOT NULL',
      [messageIds],
    );
    expect(linked.rows[0].count).toBe(0);
  });

  it('creates stable completed legacy Turns only for an unambiguous user/assistant pair', async () => {
    const userMessage = randomUUID();
    const assistantMessage = randomUUID();
    const orphanMessage = randomUUID();
    await client.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt") VALUES
        ($1, $4, 'user', 'legacy-attempt', 'COMPLETED', NOW() - INTERVAL '3 seconds'),
        ($2, $4, 'assistant', 'legacy-guidance', 'COMPLETED', NOW() - INTERVAL '2 seconds'),
        ($3, $4, 'system', 'legacy-system', 'COMPLETED', NOW() - INTERVAL '1 second')`,
      [userMessage, assistantMessage, orphanMessage, ids.deterministicConversation],
    );
    const runId = randomUUID();
    const dryRun = await backfillConversationTurns(client, {
      runId,
      mode: 'DRY_RUN',
      sourceDigest: 'e'.repeat(64),
    });
    turnRunId = runId;
    turnPairUserMessage = userMessage;
    turnPairAssistantMessage = assistantMessage;
    turnSourceDigest = dryRun.sourceDigest;
    turnPrerequisiteRunId = `${runId}-audit`;
    expect(dryRun).toMatchObject({
      scannedMessages: 3,
      deterministicGroups: 1,
      archivedGroups: 1,
      manualReviewGroups: 0,
    });
    await sealTurnDryRun(`${runId}-audit`, dryRun);
    const first = await backfillConversationTurns(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: `${runId}-audit`,
    });
    expect(first).toMatchObject({ turnsCreated: 1, archivedGroups: 1 });
    const second = await backfillConversationTurns(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId: `${runId}-audit`,
    });
    expect(second).toEqual(first);

    const linked = await client.query<{ role: string; status: string; turnId: string | null }>(
      `SELECT role, status, "turnId" FROM aria_messages
       WHERE id = ANY($1::text[]) ORDER BY "createdAt"`,
      [[userMessage, assistantMessage, orphanMessage]],
    );
    expect(linked.rows[0]).toMatchObject({ role: 'user', status: 'COMPLETED' });
    expect(linked.rows[0].turnId).toBeTruthy();
    expect(linked.rows[1]).toMatchObject({ role: 'assistant', status: 'COMPLETED' });
    expect(linked.rows[1].turnId).toBe(linked.rows[0].turnId);
    expect(linked.rows[2].turnId).toBeNull();
    const createdAt = await client.query<{ createdAt: string }>(
      `SELECT to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "createdAt"
       FROM aria_messages WHERE id = $1`,
      [userMessage],
    );
    turnPairOriginalCreatedAt = createdAt.rows[0].createdAt;
  });

  it('B2_ROLLBACK_REJECTS_CREATED_AT_DRIFT_WITHOUT_PARTIAL_UNLINK', async () => {
    await client.query(
      'UPDATE aria_messages SET "createdAt" = "createdAt" + INTERVAL \'100 milliseconds\' WHERE id = $1',
      [turnPairUserMessage],
    );
    await expect(backfillConversationTurns(client, {
      runId: turnRunId,
      mode: 'APPLY',
      sourceDigest: turnSourceDigest,
      prerequisiteRunId: turnPrerequisiteRunId,
    })).rejects.toThrow('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
    await expect(rollbackLegacyBackfill(client, turnRunId))
      .rejects.toThrow('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
    const stillLinked = await client.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM aria_messages
       WHERE "turnId" IN (SELECT id FROM aria_conversation_turns WHERE "migrationRunId" = $1)`,
      [turnRunId],
    );
    expect(stillLinked.rows[0].count).toBe(2);
    await client.query('UPDATE aria_messages SET "createdAt" = $2 WHERE id = $1', [
      turnPairUserMessage,
      turnPairOriginalCreatedAt,
    ]);
  });

  it('B2_ROLLBACK_REJECTS_TURN_TARGET_DRIFT_WITHOUT_PARTIAL_UNLINK', async () => {
    await client.query(
      `UPDATE aria_conversation_turns SET "pedagogicalMode" = 'DISCOVERY'
       WHERE "migrationRunId" = $1`,
      [turnRunId],
    );
    await expect(rollbackLegacyBackfill(client, turnRunId))
      .rejects.toThrow('ARIA_BACKFILL_ROLLBACK_FINGERPRINT_CONFLICT');
    const stillLinked = await client.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM aria_messages
       WHERE id = ANY($1::text[]) AND "turnId" IS NOT NULL`,
      [[turnPairUserMessage, turnPairAssistantMessage]],
    );
    expect(stillLinked.rows[0].count).toBe(2);
    await client.query(
      `UPDATE aria_conversation_turns SET "pedagogicalMode" = 'LEGACY_UNSPECIFIED'
       WHERE "migrationRunId" = $1`,
      [turnRunId],
    );
  });

  it('B2_ROLLBACK_REJECTS_B1_BEFORE_DEPENDENT_B2_WITHOUT_PARTIAL_MUTATION', async () => {
    await client.query('SAVEPOINT b2_wrong_rollback_order');
    try {
      await expect(rollbackLegacyBackfill(client, contextRunId))
        .rejects.toThrow('ARIA_BACKFILL_ROLLBACK_DEPENDENCY_CONFLICT');
      const context = await client.query<{
        courseKey: string | null;
        contextState: string;
        contextMigrationRunId: string | null;
      }>(
        `SELECT "courseKey", "contextState"::text, "contextMigrationRunId"
         FROM aria_conversations WHERE id = $1`,
        [ids.deterministicConversation],
      );
      expect(context.rows[0]).toEqual({
        courseKey: 'eds-maths-premiere',
        contextState: 'ACTIVE',
        contextMigrationRunId: contextRunId,
      });
      const linked = await client.query<{ count: number }>(
        `SELECT COUNT(*)::integer AS count FROM aria_messages
         WHERE "turnId" IN (
           SELECT id FROM aria_conversation_turns WHERE "migrationRunId" = $1
         )`,
        [turnRunId],
      );
      expect(linked.rows[0].count).toBe(2);
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_wrong_rollback_order');
    }
  });

  it('B1_ROLLBACK_REJECTS_COMPLETED_B2_ARCHIVED_AND_MANUAL_AUDITS_WITH_ZERO_TURNS', async () => {
    await client.query('SAVEPOINT b2_zero_turn_dependency');
    const conversationId = randomUUID();
    const contextApplyRunId = randomUUID();
    const contextAuditRunId = randomUUID();
    const turnApplyRunId = randomUUID();
    const turnAuditRunId = randomUUID();
    try {
      await client.query(
        `INSERT INTO aria_conversations
          (id, "studentId", subject, "courseKey", "skillId", "contextState", "updatedAt")
         VALUES ($1, $2, 'MATHEMATIQUES', NULL, 'zero-turn-skill',
                 'LEGACY_CONTEXT_UNRESOLVED', NOW())`,
        [conversationId, ids.student],
      );
      const contextEvidence: LegacyContextEvidence = {
        skillCourseCandidates: new Map([
          ['zero-turn-skill', ['eds-maths-premiere']],
        ]),
        resourceCourseCandidates: new Map(),
        academicSubjectCandidates: new Map(),
      };
      const contextDryRun = await backfillConversationContexts(client, {
        runId: contextApplyRunId,
        mode: 'DRY_RUN',
        sourceDigest: '0'.repeat(64),
        evidence: contextEvidence,
      });
      await sealContextDryRun(contextAuditRunId, contextDryRun);
      await backfillConversationContexts(client, {
        runId: contextApplyRunId,
        mode: 'APPLY',
        sourceDigest: contextDryRun.sourceDigest,
        prerequisiteRunId: contextAuditRunId,
        evidence: contextEvidence,
      });

      const messageIds = Array.from({ length: 3 }, () => randomUUID());
      await client.query(
        `INSERT INTO aria_messages
          (id, "conversationId", role, content, status, "createdAt") VALUES
          ($1, $4, 'user', 'pending', 'PENDING', '2029-05-01 10:00:00.000'),
          ($2, $4, 'user', 'equal-user', 'COMPLETED', '2029-05-01 10:00:01.000'),
          ($3, $4, 'assistant', 'equal-assistant', 'COMPLETED', '2029-05-01 10:00:01.000')`,
        [...messageIds, conversationId],
      );
      const turnDryRun = await backfillConversationTurns(client, {
        runId: turnApplyRunId,
        mode: 'DRY_RUN',
        sourceDigest: '0'.repeat(64),
      });
      expect(turnDryRun).toMatchObject({
        scannedMessages: 3,
        deterministicGroups: 0,
        archivedGroups: 1,
        manualReviewGroups: 2,
        turnsCreated: 0,
      });
      await sealTurnDryRun(turnAuditRunId, turnDryRun);
      await expect(backfillConversationTurns(client, {
        runId: turnApplyRunId,
        mode: 'APPLY',
        sourceDigest: turnDryRun.sourceDigest,
        prerequisiteRunId: turnAuditRunId,
      })).resolves.toMatchObject({ turnsCreated: 0 });

      await expect(rollbackLegacyBackfill(client, contextApplyRunId))
        .rejects.toThrow('ARIA_BACKFILL_ROLLBACK_DEPENDENCY_CONFLICT');
      await expect(client.query(
        `SELECT "courseKey", "contextState"::text, "contextMigrationRunId"
         FROM aria_conversations WHERE id = $1`,
        [conversationId],
      )).resolves.toMatchObject({
        rows: [{
          courseKey: 'eds-maths-premiere',
          contextState: 'ACTIVE',
          contextMigrationRunId: contextApplyRunId,
        }],
      });

      await expect(rollbackLegacyBackfill(client, turnApplyRunId))
        .resolves.toMatchObject({ turnsDeleted: 0, contextsRestored: 0 });
      await expect(rollbackLegacyBackfill(client, contextApplyRunId))
        .resolves.toMatchObject({ turnsDeleted: 0, contextsRestored: 1 });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT b2_zero_turn_dependency');
    }
  });

  it('rolls back only rows whose lineage and fingerprint still match', async () => {
    const turnRollback = await rollbackLegacyBackfill(client, turnRunId);
    expect(turnRollback).toMatchObject({ turnsDeleted: 1, contextsRestored: 0 });
    const linkedCount = await client.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM aria_messages
       WHERE id = ANY($1::text[]) AND "turnId" IS NOT NULL`,
      [[turnPairUserMessage, turnPairAssistantMessage]],
    );
    expect(linkedCount.rows[0].count).toBe(0);

    const contextRollback = await rollbackLegacyBackfill(client, contextRunId);
    expect(contextRollback).toMatchObject({ turnsDeleted: 0, contextsRestored: 1 });
    const conversation = await client.query<{ courseKey: string | null; contextState: string }>(
      'SELECT "courseKey", "contextState" FROM aria_conversations WHERE id = $1',
      [ids.deterministicConversation],
    );
    expect(conversation.rows[0]).toEqual({
      courseKey: null,
      contextState: 'LEGACY_CONTEXT_UNRESOLVED',
    });
  });
});
