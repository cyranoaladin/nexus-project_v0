import { Prisma, type PrismaClient } from '@prisma/client';

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
  await prisma.user.deleteMany({
    where: { id: { startsWith: prefix } },
  });
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
