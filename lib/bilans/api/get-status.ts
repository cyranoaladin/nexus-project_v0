import type { PrismaClient } from '@prisma/client';
import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

import { resolveSessionStudent } from './access';
import { CanonicalApiError } from './errors';
import { canonicalErrorResponse } from './http';

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;
type StoredStatus = Readonly<{
  id: string;
  status: string;
  updatedAt: Date;
  reportArtifacts: ReadonlyArray<Readonly<{ id: string }>>;
}>;

type StatusDatabase = Readonly<{
  student: PrismaClient['student'];
  canonicalAssessmentAttempt: {
    findFirst(args: unknown): Promise<StoredStatus | null>;
  };
}>;

type StatusDependencies = Readonly<{
  prisma: StatusDatabase;
  authenticate: () => Promise<Session | null>;
}>;

const defaultDependencies: StatusDependencies = {
  prisma: prisma as unknown as StatusDatabase,
  authenticate: auth,
};

export function createGetAttemptStatusHandler(
  dependencies: StatusDependencies = defaultDependencies,
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  return async (_request, context) => {
    try {
      const session = await dependencies.authenticate();
      const student = await resolveSessionStudent(session, dependencies.prisma as never);
      const { id } = await context.params;
      const attempt = await dependencies.prisma.canonicalAssessmentAttempt.findFirst({
        where: { id, studentId: student.id },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          reportArtifacts: { select: { id: true }, take: 1 },
        },
      });
      if (attempt === null) throw CanonicalApiError.notFound();

      return NextResponse.json({
        attemptId: attempt.id,
        status: attempt.status,
        reportStatus: attempt.reportArtifacts.length === 0 ? null : attempt.status,
        updatedAt: attempt.updatedAt.toISOString(),
      });
    } catch (error) {
      return canonicalErrorResponse(error);
    }
  };
}
