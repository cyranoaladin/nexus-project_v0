import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

import { CanonicalApiError } from './errors';
import { displayTitle } from './get-attempt';
import { createGetAttemptReportHandler } from './get-report';
import { canonicalErrorResponse } from './http';
import {
  assertAttemptPackEnabled,
  resolveEnabledPack,
  type PackResolver,
} from './pack-access';
import {
  resolveParentOwnedStudent,
  validParentResourceId,
  withParentPrivateNoStore,
} from './parent-access';

type ParentRouteContext = Readonly<{ params: Promise<Readonly<{ studentId: string }>> }>;
type ParentReportRouteContext = Readonly<{
  params: Promise<Readonly<{ studentId: string; attemptId: string }>>;
}>;

type StoredPublishedRevision = Readonly<{
  status: string;
  validationFailures: readonly string[];
  materialization: Readonly<{
    audienceArtifacts: ReadonlyArray<Readonly<{ id: string }>>;
  }> | null;
}>;

type StoredParentAttempt = Readonly<{
  id: string;
  status: string;
  assessmentPackId: string;
  assessmentPackVersion: string;
  subject: string;
  gradeLevel: string;
  updatedAt: Date;
  reportArtifacts: ReadonlyArray<Readonly<{
    currentPublishedRevision: StoredPublishedRevision | null;
  }>>;
}>;

type ParentReportsDatabase = Readonly<{
  student: {
    findFirst(args: unknown): Promise<Readonly<{ id: string }> | null>;
  };
  parentStudentLink: {
    findFirst(args: unknown): Promise<Readonly<{
      id: string;
      state: 'PENDING_PARENT_CONSENT' | 'VERIFIED' | 'REVOKED' | 'EXPIRED';
      verifiedAt: Date | null;
      revokedAt: Date | null;
      expiresAt: Date | null;
    }> | null>;
  };
  canonicalAssessmentAttempt: {
    findMany(args: unknown): Promise<readonly StoredParentAttempt[]>;
    findFirst(args: unknown): Promise<Readonly<{
      id: string;
      assessmentPackId: string;
      assessmentPackVersion: string;
    }> | null>;
  };
}>;

type ParentListDependencies = Readonly<{
  prisma: ParentReportsDatabase;
  authenticate: () => Promise<Session | null>;
  resolvePack: PackResolver;
  now: () => Date;
}>;

type ReportHandler = (
  request: NextRequest,
  context: Readonly<{ params: Promise<Readonly<{ id: string }>> }>,
) => Promise<NextResponse>;

type ParentReportDependencies = ParentListDependencies & Readonly<{
  serveReport: ReportHandler;
}>;

const defaultListDependencies: ParentListDependencies = {
  prisma: prisma as unknown as ParentReportsDatabase,
  authenticate: auth,
  resolvePack: resolveEnabledPack,
  now: () => new Date(),
};

const defaultReportDependencies: ParentReportDependencies = {
  ...defaultListDependencies,
  serveReport: createGetAttemptReportHandler(),
};

function publishedParentsArtifactAvailable(attempt: StoredParentAttempt): boolean {
  if (attempt.status !== 'PUBLISHED') return false;
  const revision = attempt.reportArtifacts[0]?.currentPublishedRevision;
  return revision?.status === 'COACH_VALIDATED'
    && revision.validationFailures.length === 0
    && revision.materialization?.audienceArtifacts[0]?.id !== undefined;
}

export function createGetParentChildReportsHandler(
  dependencies: ParentListDependencies = defaultListDependencies,
): (request: NextRequest, context: ParentRouteContext) => Promise<NextResponse> {
  return async (_request, context) => {
    try {
      const session = await dependencies.authenticate();
      const { studentId } = await context.params;
      const student = await resolveParentOwnedStudent(
        session,
        studentId,
        dependencies.prisma,
        dependencies.now(),
      );
      const attempts = await dependencies.prisma.canonicalAssessmentAttempt.findMany({
        where: { studentId: student.id },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          status: true,
          assessmentPackId: true,
          assessmentPackVersion: true,
          subject: true,
          gradeLevel: true,
          updatedAt: true,
          reportArtifacts: {
            where: { status: 'PUBLISHED', currentPublishedRevisionId: { not: null } },
            select: {
              currentPublishedRevision: {
                select: {
                  status: true,
                  validationFailures: true,
                  materialization: {
                    select: {
                      audienceArtifacts: {
                        where: { audience: 'PARENTS' },
                        select: { id: true },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
            take: 1,
          },
        },
      });

      const bilans = attempts.flatMap((attempt) => {
        try {
          const enabled = assertAttemptPackEnabled(attempt, dependencies.resolvePack);
          return [{
            attemptId: attempt.id,
            level: enabled.pack.level,
            subject: enabled.pack.subject,
            title: displayTitle(enabled.pack.subject, enabled.pack.level),
            status: attempt.status,
            updatedAt: attempt.updatedAt.toISOString(),
            reportAvailable: publishedParentsArtifactAvailable(attempt),
          }];
        } catch {
          return [];
        }
      });

      return withParentPrivateNoStore(NextResponse.json({ studentId: student.id, bilans }));
    } catch (error) {
      return withParentPrivateNoStore(canonicalErrorResponse(error));
    }
  };
}

export function createGetParentReportHandler(
  dependencies: ParentReportDependencies = defaultReportDependencies,
): (request: NextRequest, context: ParentReportRouteContext) => Promise<NextResponse> {
  return async (request, context) => {
    try {
      const session = await dependencies.authenticate();
      const { studentId, attemptId } = await context.params;
      const student = await resolveParentOwnedStudent(
        session,
        studentId,
        dependencies.prisma,
        dependencies.now(),
      );
      if (!validParentResourceId(attemptId)) throw CanonicalApiError.notFound();
      const attempt = await dependencies.prisma.canonicalAssessmentAttempt.findFirst({
        where: { id: attemptId, studentId: student.id },
        select: {
          id: true,
          assessmentPackId: true,
          assessmentPackVersion: true,
        },
      });
      if (attempt === null) throw CanonicalApiError.notFound();
      assertAttemptPackEnabled(attempt, dependencies.resolvePack);

      const response = await dependencies.serveReport(request, {
        params: Promise.resolve({ id: attempt.id }),
      });
      return withParentPrivateNoStore(response);
    } catch (error) {
      return withParentPrivateNoStore(canonicalErrorResponse(error));
    }
  };
}
