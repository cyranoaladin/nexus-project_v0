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
}>;

type StoredAttempt = Readonly<{
  id: string;
  studentId: string;
  status: string;
  assessmentPackId: string;
  assessmentPackVersion: string;
}>;

const RAW_SCORE_KEYS = new Set([
  'calibrationindex',
  'coverage',
  'domainscores',
  'globalscore',
  'internalfacts',
  'percentage',
  'points',
  'rawscore',
  'score',
  'scoresnapshot',
  'totalscore',
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function containsRawScore(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsRawScore);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => (
    RAW_SCORE_KEYS.has(key.replace(/[^a-zA-Z]/g, '').toLowerCase())
    || containsRawScore(nested)
  ));
}

function extractAudienceReport(content: unknown, audience: ReportAudience): Readonly<Record<string, unknown>> {
  if (!isRecord(content)) throw CanonicalApiError.notFound();
  const report = content[audience];
  if (!isRecord(report) || report.audience !== audience) throw CanonicalApiError.notFound();
  if (audience !== 'NEXUS' && containsRawScore(report)) throw CanonicalApiError.notFound();
  return report;
}

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
};

export function createGetAttemptReportHandler(
  dependencies: GetReportDependencies = defaultDependencies,
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  return async (_request, context) => {
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
              content: true,
              validationFailures: true,
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

      const report = extractAudienceReport(revision.content, audience);
      return NextResponse.json({
        attemptId: attempt.id,
        audience,
        report,
        publishedAt: artifact.publishedAt.toISOString(),
      });
    } catch (error) {
      return canonicalErrorResponse(error);
    }
  };
}
