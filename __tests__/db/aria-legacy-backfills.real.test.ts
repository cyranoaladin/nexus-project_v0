/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import {
  backfillConversationContexts,
  type LegacyContextEvidence,
} from '@/scripts/aria/backfill-conversation-context';
import { backfillConversationTurns } from '@/scripts/aria/backfill-conversation-turns';
import { rollbackLegacyBackfill } from '@/scripts/aria/run-backfills';

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

  it('classifies dry-run rows without mutating and applies only deterministic evidence', async () => {
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
    expect(dryRun).toMatchObject({ deterministic: 1, manualReview: 1, mutated: 0 });
    const before = await client.query<{ courseKey: string | null }>(
      'SELECT "courseKey" FROM aria_conversations WHERE id = $1',
      [ids.deterministicConversation],
    );
    expect(before.rows[0].courseKey).toBeNull();

    const applied = await backfillConversationContexts(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: 'd'.repeat(64),
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
       VALUES ($1, 'allowlist-proof', 'APPLY', '{}', $2, 'RUNNING')`,
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

  it('creates stable completed legacy Turns only for an unambiguous user/assistant pair', async () => {
    const userMessage = randomUUID();
    const assistantMessage = randomUUID();
    const orphanMessage = randomUUID();
    await client.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "createdAt") VALUES
        ($1, $4, 'user', 'legacy-attempt', 'COMPLETED', NOW() - INTERVAL '3 seconds'),
        ($2, $4, 'assistant', 'legacy-guidance', 'COMPLETED', NOW() - INTERVAL '2 seconds'),
        ($3, $4, 'assistant', 'orphan', 'COMPLETED', NOW() - INTERVAL '1 second')`,
      [userMessage, assistantMessage, orphanMessage, ids.deterministicConversation],
    );
    const runId = randomUUID();
    turnRunId = runId;
    const first = await backfillConversationTurns(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: 'e'.repeat(64),
    });
    expect(first).toMatchObject({ turnsCreated: 1, archivedGroups: 1 });
    const second = await backfillConversationTurns(client, {
      runId,
      mode: 'APPLY',
      sourceDigest: 'e'.repeat(64),
    });
    expect(second.turnsCreated).toBe(0);

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
  });

  it('rolls back only rows whose lineage and fingerprint still match', async () => {
    const turnRollback = await rollbackLegacyBackfill(client, turnRunId);
    expect(turnRollback).toMatchObject({ turnsDeleted: 1, contextsRestored: 0 });
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
    const linkedCount = await client.query<{ count: number }>(
      'SELECT COUNT(*)::integer AS count FROM aria_messages WHERE "turnId" IS NOT NULL',
    );
    expect(linkedCount.rows[0].count).toBe(0);
  });
});
