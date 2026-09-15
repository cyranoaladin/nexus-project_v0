import { Prisma, type PrismaClient } from '@prisma/client';
import { cleanupDisposableTestFixture } from '../helpers/real-db-fixture-cleanup';

export function databaseUrlWithApplicationName(
  databaseUrl: string,
  applicationName: string,
): string {
  const parsed = new URL(databaseUrl);
  parsed.searchParams.set('application_name', applicationName);
  return parsed.toString();
}

export async function waitForBlockedPostgresClient(
  observer: PrismaClient,
  applicationName: string,
): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const [row] = await observer.$queryRaw<Array<{ blocked: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE application_name = ${applicationName}
          AND cardinality(pg_blocking_pids(pid)) > 0
      ) AS blocked
    `);
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`PostgreSQL client ${applicationName} never became blocked`);
}

export async function createNpcRealFixture(
  prisma: PrismaClient,
  prefix: string,
) {
  const parentUserId = `${prefix}-parent-user`;
  const parentId = `${prefix}-parent`;
  const studentUserId = `${prefix}-student-user`;
  const studentId = `${prefix}-student`;
  const submissionId = `${prefix}-submission`;

  await prisma.user.create({
    data: {
      id: parentUserId,
      role: 'PARENT',
      email: `${parentUserId}@example.test`,
      parentProfile: { create: { id: parentId } },
    },
  });
  await prisma.user.create({
    data: {
      id: studentUserId,
      role: 'ELEVE',
      email: `${studentUserId}@example.test`,
    },
  });
  await prisma.student.create({
    data: {
      id: studentId,
      parentId,
      userId: studentUserId,
      gradeLevel: 'TERMINALE',
    },
  });
  await prisma.copySubmission.create({
    data: {
      id: submissionId,
      studentId,
      subject: 'MATHEMATIQUES',
      title: 'Copie transactionnelle NPC',
      status: 'UPLOADED',
    },
  });

  return { parentUserId, studentId, submissionId };
}

export async function cleanupNpcRealFixture(
  prisma: PrismaClient,
  prefix: string,
) {
  // These two reach the fixture only through SET NULL references
  // (ai_processing_jobs.copySubmissionId, npc_audit_logs.reportId), so they are
  // not owned by the account graph and the canonical cleanup will not remove
  // them — which is correct: an audit log outliving the row it describes is the
  // retention behaviour, not a leak. They are cleared explicitly, by prefix.
  await prisma.aiProcessingJob.deleteMany({
    where: { id: { startsWith: prefix } },
  });
  await prisma.npcAuditLog.deleteMany({
    where: {
      OR: [
        { entityId: { startsWith: prefix } },
        { actorId: { startsWith: prefix } },
      ],
    },
  });

  // The accounts and everything owned below them — students, copy submissions,
  // pedagogical reports — go through the canonical cleanup, which derives the
  // order from the live schema rather than assuming a cascade that #273 removed.
  const fixtureUsers = await prisma.user.findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true },
  });
  if (fixtureUsers.length > 0) {
    await cleanupDisposableTestFixture(prisma, {
      userIds: fixtureUsers.map((user) => user.id),
    });
  }
}

export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
