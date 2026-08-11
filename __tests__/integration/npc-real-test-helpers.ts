import type { PrismaClient } from '@prisma/client';

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
