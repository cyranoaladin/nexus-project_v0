/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('ARIA M1 PostgreSQL constraints', () => {
  let pool: Pool;
  let client: PoolClient;
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    studentUser: randomUUID(),
    student: randomUUID(),
    otherStudentUser: randomUUID(),
    otherStudent: randomUUID(),
    conversation: randomUUID(),
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
        ($1, $2, 'PARENT', NOW()),
        ($3, $4, 'ELEVE', NOW()),
        ($5, $6, 'ELEVE', NOW())`,
      [
        ids.parentUser,
        `parent-${ids.parentUser}@invalid.test`,
        ids.studentUser,
        `student-${ids.studentUser}@invalid.test`,
        ids.otherStudentUser,
        `student-${ids.otherStudentUser}@invalid.test`,
      ],
    );
    await client.query(
      'INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)',
      [ids.parent, ids.parentUser],
    );
    await client.query(
      `INSERT INTO students
        (id, "parentId", "userId", "gradeLevel", "updatedAt") VALUES
        ($1, $2, $3, 'PREMIERE', NOW()),
        ($4, $2, $5, 'PREMIERE', NOW())`,
      [ids.student, ids.parent, ids.studentUser, ids.otherStudent, ids.otherStudentUser],
    );
    await client.query(
      `INSERT INTO aria_conversations
        (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'ACTIVE', NOW())`,
      [ids.conversation, ids.student],
    );
  });

  afterAll(async () => {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  });

  it('D006 ARIA-B-R013 rejects active null context and preserves unresolved legacy course evidence', async () => {
    await client.query('SAVEPOINT context_guard');
    await expect(client.query(
      `INSERT INTO aria_conversations
        (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $2, NULL, 'ACTIVE', NOW())`,
      [randomUUID(), ids.student],
    )).rejects.toMatchObject({ code: '23514' });
    await client.query('ROLLBACK TO SAVEPOINT context_guard');

    const historicalCourseConversation = randomUUID();
    await expect(client.query(
      `INSERT INTO aria_conversations
        (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'LEGACY_CONTEXT_UNRESOLVED', NOW())`,
      [historicalCourseConversation, ids.student],
    )).resolves.toMatchObject({ rowCount: 1 });
    await expect(client.query(
      `SELECT "courseKey", "contextState"::text FROM aria_conversations WHERE id = $1`,
      [historicalCourseConversation],
    )).resolves.toMatchObject({
      rows: [{
        courseKey: 'eds-maths-premiere',
        contextState: 'LEGACY_CONTEXT_UNRESOLVED',
      }],
    });
    await client.query('ROLLBACK TO SAVEPOINT context_guard');
  });

  it('D007 ARIA-B-R012 enforces idempotency, subject integrity and one active turn per conversation', async () => {
    await client.query('SAVEPOINT turn_constraints');
    const turnId = randomUUID();
    const fingerprint = 'a'.repeat(64);
    await client.query(
      `INSERT INTO aria_conversation_turns
        (id, "conversationId", "actorUserId", "subjectStudentId", "useCase",
         "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'CONVERSATION', 'request-1', $5, 1, 'PENDING', '{}', NOW(), NOW())`,
      [turnId, ids.conversation, ids.studentUser, ids.student, fingerprint],
    );

    await expect(client.query(
      `INSERT INTO aria_conversation_turns
        (id, "conversationId", "actorUserId", "subjectStudentId", "useCase",
         "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'CONVERSATION', 'request-2', $5, 2, 'PENDING', '{}', NOW(), NOW())`,
      [randomUUID(), ids.conversation, ids.studentUser, ids.student, 'b'.repeat(64)],
    )).rejects.toMatchObject({ code: '23505' });
    await client.query('ROLLBACK TO SAVEPOINT turn_constraints');

    await client.query('SAVEPOINT subject_guard');
    await expect(client.query(
      `INSERT INTO aria_conversation_turns
        (id, "conversationId", "actorUserId", "subjectStudentId", "useCase",
         "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'CONVERSATION', 'forged-subject', $5, 1, 'PENDING', '{}', NOW(), NOW())`,
      [randomUUID(), ids.conversation, ids.studentUser, ids.otherStudent, fingerprint],
    )).rejects.toMatchObject({ code: '23503' });
    await client.query('ROLLBACK TO SAVEPOINT subject_guard');
  });

  it('keeps one idempotency identity even across distinct conversations', async () => {
    await client.query('SAVEPOINT idempotency_guard');
    const secondConversation = randomUUID();
    await client.query(
      `INSERT INTO aria_conversations
        (id, "studentId", "courseKey", "contextState", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'ACTIVE', NOW())`,
      [secondConversation, ids.student],
    );
    const values = [ids.conversation, secondConversation];
    await client.query(
      `INSERT INTO aria_conversation_turns
        (id, "conversationId", "actorUserId", "subjectStudentId", "useCase",
         "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
         "completedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'CONVERSATION', 'same-request', $5, 1,
               'COMPLETED', '{}', NOW(), NOW(), NOW())`,
      [randomUUID(), values[0], ids.studentUser, ids.student, 'd'.repeat(64)],
    );
    await expect(client.query(
      `INSERT INTO aria_conversation_turns
        (id, "conversationId", "actorUserId", "subjectStudentId", "useCase",
         "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
         "completedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'CONVERSATION', 'same-request', $5, 1,
               'COMPLETED', '{}', NOW(), NOW(), NOW())`,
      [randomUUID(), values[1], ids.studentUser, ids.student, 'd'.repeat(64)],
    )).rejects.toMatchObject({ code: '23505' });
    await client.query('ROLLBACK TO SAVEPOINT idempotency_guard');
  });

  it('USER_MESSAGE_STATUS_DOES_NOT_MIRROR_ASSISTANT_TURN', async () => {
    const turnId = randomUUID();
    await client.query(
      `INSERT INTO aria_conversation_turns
        (id, "conversationId", "actorUserId", "subjectStudentId", "useCase",
         "clientRequestId", "requestFingerprint", sequence, status, "academicSnapshot",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'CONVERSATION', 'projection', $5, 1, 'PENDING', '{}', NOW(), NOW())`,
      [turnId, ids.conversation, ids.studentUser, ids.student, 'c'.repeat(64)],
    );
    const userMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    await client.query(
      `INSERT INTO aria_messages
        (id, "conversationId", role, content, status, "turnId", "turnRole", "createdAt")
       VALUES
        ($1, $3, 'user', 'attempt', 'COMPLETED', $4, 'USER', NOW()),
        ($2, $3, 'assistant', '', 'PENDING', $4, 'ASSISTANT', NOW())`,
      [userMessageId, assistantMessageId, ids.conversation, turnId],
    );
    await client.query(
      `UPDATE aria_conversation_turns
       SET status = 'CANCELLED', "completedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $1`,
      [turnId],
    );
    const result = await client.query<{ id: string; status: string }>(
      'SELECT id, status FROM aria_messages WHERE "turnId" = $1 ORDER BY id',
      [turnId],
    );
    const statuses = new Map(result.rows.map((row) => [row.id, row.status]));
    expect(statuses.get(userMessageId)).toBe('COMPLETED');
    expect(statuses.get(assistantMessageId)).toBe('CANCELLED');
  });

  it('APPLY_PREREQUISITE_FK_REJECTS_MISSING_AUDIT_AND_RESTRICTS_DELETION', async () => {
    const auditRunId = randomUUID();
    const applyRunId = randomUUID();
    const sourceDigest = '9'.repeat(64);
    const sourceSnapshot = JSON.stringify({
      schemaVersion: 1,
      target: 'conversation-context',
      sourceSnapshotSha256: sourceDigest,
    });
    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "completedAt")
       VALUES ($1, 'aria-conversation-context-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', NOW())`,
      [auditRunId, sourceSnapshot, sourceDigest],
    );

    await client.query('SAVEPOINT missing_apply_lineage');
    await expect(client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status)
       VALUES ($1, 'aria-conversation-context-v1', 'APPLY', $2::jsonb, $3, 'RUNNING')`,
      [randomUUID(), sourceSnapshot, sourceDigest],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('canonical completed DRY_RUN prerequisite'),
    });
    await client.query('ROLLBACK TO SAVEPOINT missing_apply_lineage');

    await client.query('SAVEPOINT mismatched_apply_lineage');
    await expect(client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-conversation-context-v1', 'APPLY', $2::jsonb, $3,
               'RUNNING', $4)`,
      [randomUUID(), sourceSnapshot, '8'.repeat(64), auditRunId],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('canonical completed DRY_RUN prerequisite'),
    });
    await client.query('ROLLBACK TO SAVEPOINT mismatched_apply_lineage');

    await client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-conversation-context-v1', 'APPLY', $2::jsonb, $3,
               'RUNNING', $4)`,
      [applyRunId, sourceSnapshot, sourceDigest, auditRunId],
    );

    await client.query('SAVEPOINT missing_prerequisite');
    await expect(client.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-other-v1', 'APPLY', $2::jsonb, $3, 'RUNNING', $4)`,
      [randomUUID(), sourceSnapshot, '8'.repeat(64), randomUUID()],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('canonical completed DRY_RUN prerequisite'),
    });
    await client.query('ROLLBACK TO SAVEPOINT missing_prerequisite');

    await client.query('SAVEPOINT restricted_prerequisite');
    await expect(client.query(
      'DELETE FROM aria_data_migration_runs WHERE id = $1',
      [auditRunId],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('ARIA migration run evidence cannot be deleted'),
    });
    await client.query('ROLLBACK TO SAVEPOINT restricted_prerequisite');

    await expect(client.query<{ prerequisiteRunId: string }>(
      'SELECT "prerequisiteRunId" FROM aria_data_migration_runs WHERE id = $1',
      [applyRunId],
    )).resolves.toMatchObject({ rows: [{ prerequisiteRunId: auditRunId }] });
  });
});
