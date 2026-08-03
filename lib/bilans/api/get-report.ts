import type { PrismaClient } from '@prisma/client';
import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

import { CanonicalApiError } from './errors';
import { canonicalErrorResponse } from './http';
import {
  assertAttemptPackEnabled,
  resolveEnabledPack,
  type PackResolver,
} from './pack-access';
import {
  assertPublicRenderedArtifact,
  storedAudienceArtifactIsIntact,
} from '../core/report-artifact-integrity';

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;
type ReportAudience = 'ELEVE' | 'PARENTS' | 'NEXUS';
type ReportDatabase = Pick<
  PrismaClient,
  | 'student'
  | 'canonicalAssessmentAttempt'
  | 'parentStudentLink'
  | 'coachProfile'
  | 'coachStudentAssignment'
  | 'reportArtifact'
>;

type GetReportDependencies = Readonly<{
  prisma: ReportDatabase;
  authenticate: () => Promise<Session | null>;
  resolvePack: PackResolver;
  now: () => Date;
  logger?: Readonly<{ error(event: Readonly<Record<string, unknown>>): void }>;
}>;

type StoredAttempt = Readonly<{
  id: string;
  studentId: string;
  status: string;
  assessmentPackId: string;
  assessmentPackVersion: string;
}>;

async function resolveAudience(
  session: Session | null,
  attempt: StoredAttempt,
  database: ReportDatabase,
  now: Date,
): Promise<ReportAudience> {
  if (session?.user === undefined) throw CanonicalApiError.unauthenticated();

  if (session.user.role === 'ELEVE') {
    const student = await database.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (student?.id !== attempt.studentId) throw CanonicalApiError.notFound();
    return 'ELEVE';
  }

  if (session.user.role === 'PARENT') {
    const student = await database.student.findFirst({
      where: {
        id: attempt.studentId,
        parent: { userId: session.user.id },
      },
      select: { id: true },
    });
    if (student === null) throw CanonicalApiError.notFound();

    const link = await database.parentStudentLink.findFirst({
      where: {
        parentUserId: session.user.id,
        studentId: attempt.studentId,
        state: 'VERIFIED',
        verifiedAt: { not: null },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (link === null) throw CanonicalApiError.notFound();
    return 'PARENTS';
  }

  if (session.user.role === 'ADMIN') return 'NEXUS';

  if (session.user.role === 'COACH') {
    const coach = await database.coachProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (coach === null) throw CanonicalApiError.notFound();
    const assignment = await database.coachStudentAssignment.findFirst({
      where: {
        coachId: coach.id,
        studentId: attempt.studentId,
        status: 'ACTIVE',
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (assignment === null) throw CanonicalApiError.notFound();
    return 'NEXUS';
  }

  throw CanonicalApiError.notFound();
}

const defaultDependencies: GetReportDependencies = {
  prisma,
  authenticate: auth,
  resolvePack: resolveEnabledPack,
  now: () => new Date(),
  logger: { error: (event) => console.error(JSON.stringify(event)) },
};

function requestedFormat(request: NextRequest): 'html' | 'pdf' {
  const explicit = request.nextUrl.searchParams.get('format');
  if (explicit === 'html' || explicit === 'pdf') return explicit;
  if (explicit !== null) throw CanonicalApiError.badRequest('REPORT_FORMAT_INVALID');
  return request.headers.get('accept')?.includes('application/pdf') === true ? 'pdf' : 'html';
}

export function createGetAttemptReportHandler(
  dependencies: GetReportDependencies = defaultDependencies,
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  return async (request, context) => {
    try {
      const session = await dependencies.authenticate();
      if (session?.user === undefined) throw CanonicalApiError.unauthenticated();
      const { id } = await context.params;
      const attempt = await dependencies.prisma.canonicalAssessmentAttempt.findUnique({
        where: { id },
        select: {
          id: true,
          studentId: true,
          status: true,
          assessmentPackId: true,
          assessmentPackVersion: true,
        },
      });
      if (attempt === null || attempt.status !== 'PUBLISHED') throw CanonicalApiError.notFound();

      const now = dependencies.now();
      const audience = await resolveAudience(session, attempt, dependencies.prisma, now);
      assertAttemptPackEnabled(attempt, dependencies.resolvePack);
      const artifact = await dependencies.prisma.reportArtifact.findFirst({
        where: {
          assessmentAttemptId: attempt.id,
          studentId: attempt.studentId,
          status: 'PUBLISHED',
          currentPublishedRevisionId: { not: null },
        },
        orderBy: { publishedAt: 'desc' },
        select: {
          publishedAt: true,
          currentPublishedRevision: {
            select: {
              status: true,
              id: true,
              validationFailures: true,
              materialization: {
                select: {
                  audienceArtifacts: {
                    where: { audience },
                    select: { audience: true, html: true, pdf: true, pdfStatus: true, checksum: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });
      const revision = artifact?.currentPublishedRevision;
      if (
        artifact === null
        || artifact.publishedAt === null
        || revision === null
        || revision === undefined
        || revision.status !== 'COACH_VALIDATED'
        || revision.validationFailures.length > 0
      ) throw CanonicalApiError.notFound();

      const stored = revision.materialization?.audienceArtifacts[0];
      if (stored === undefined) {
        (dependencies.logger ?? defaultDependencies.logger)?.error({
          event: 'A90_REPORT_MATERIALIZATION_MISSING',
          attemptId: attempt.id,
          revisionId: revision.id,
          audience,
        });
        throw CanonicalApiError.notFound();
      }
      const pdf = stored.pdf === null ? null : Buffer.from(stored.pdf);
      if (!storedAudienceArtifactIsIntact({ ...stored, pdf })) {
        (dependencies.logger ?? defaultDependencies.logger)?.error({
          event: 'A90_REPORT_MATERIALIZATION_CHECKSUM_INVALID',
          attemptId: attempt.id,
          revisionId: revision.id,
          audience,
        });
        throw CanonicalApiError.notFound();
      }
      try {
        assertPublicRenderedArtifact(audience, stored.html, attempt.assessmentPackId);
      } catch {
        (dependencies.logger ?? defaultDependencies.logger)?.error({
          event: 'A90_REPORT_PUBLIC_ARTIFACT_REJECTED',
          attemptId: attempt.id,
          revisionId: revision.id,
          audience,
        });
        throw CanonicalApiError.notFound();
      }
      const format = requestedFormat(request);
      if (format === 'pdf') {
        if (stored.pdfStatus === 'UNAVAILABLE') {
          return NextResponse.json({ error: { code: 'REPORT_PDF_UNAVAILABLE' } }, { status: 409 });
        }
        if (pdf === null) throw CanonicalApiError.notFound();
        return new NextResponse(new Uint8Array(pdf), {
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'content-disposition': 'inline; filename="bilan.pdf"',
            'cache-control': 'private, immutable',
          },
        });
      }
      return new NextResponse(stored.html, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'private, immutable',
          'x-nexus-report-published-at': artifact.publishedAt.toISOString(),
        },
      });
    } catch (error) {
      return canonicalErrorResponse(error);
    }
  };
}
