import type { UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';

type RunnerAttempt = Readonly<{
  id: string;
  studentId: string;
  status: string;
  expiresAt: Date;
  assessmentPackId: string;
  assessmentPackVersion: string;
}>;

type RunnerAccessDependencies = Readonly<{
  findStudent(userId: string): Promise<Readonly<{ id: string }> | null>;
  findAttempt(attemptId: string, studentId: string): Promise<RunnerAttempt | null>;
  resolvePack: PackResolver;
  now: () => Date;
}>;

export class CanonicalRunnerAccessError extends Error {
  readonly code = 'NOT_FOUND';

  constructor() {
    super('NOT_FOUND');
    this.name = 'CanonicalRunnerAccessError';
  }
}

const defaultDependencies: RunnerAccessDependencies = {
  findStudent: (userId) => prisma.student.findUnique({ where: { userId }, select: { id: true } }),
  findAttempt: (attemptId, studentId) => prisma.canonicalAssessmentAttempt.findFirst({
    where: { id: attemptId, studentId },
    select: {
      id: true,
      studentId: true,
      status: true,
      expiresAt: true,
      assessmentPackId: true,
      assessmentPackVersion: true,
    },
  }),
  resolvePack: resolveEnabledPack,
  now: () => new Date(),
};

export async function resolveCanonicalRunnerAccess(
  input: Readonly<{ attemptId: string; userId: string; role: UserRole | string }>,
  dependencies: RunnerAccessDependencies = defaultDependencies,
): Promise<Readonly<{ state: 'WAITING' } | { state: 'READY'; attemptId: string }>> {
  if (!input.attemptId.trim() || !input.userId.trim() || input.role !== 'ELEVE') {
    throw new CanonicalRunnerAccessError();
  }
  const student = await dependencies.findStudent(input.userId);
  if (student === null) throw new CanonicalRunnerAccessError();
  const attempt = await dependencies.findAttempt(input.attemptId, student.id);
  if (
    attempt === null
    || attempt.status !== 'DRAFT'
    || attempt.expiresAt <= dependencies.now()
  ) throw new CanonicalRunnerAccessError();

  const version = Number(attempt.assessmentPackVersion);
  if (!Number.isSafeInteger(version) || version < 1) throw new CanonicalRunnerAccessError();
  const enabled = dependencies.resolvePack(attempt.assessmentPackId, version);
  if (enabled === null) return Object.freeze({ state: 'WAITING' as const });
  return Object.freeze({ state: 'READY' as const, attemptId: attempt.id });
}
