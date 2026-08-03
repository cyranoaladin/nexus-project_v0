import type { Prisma, UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import {
  previewReportRevision,
  publishReportRevision,
  rejectReportRevision,
  validateReportRevision,
} from '../core/report-service';

export type PendingReportReview = Readonly<{
  id: string;
  status: string;
  validationFailures: readonly string[];
  reportPackId: string;
  reportPackVersion: string;
  content: Prisma.JsonValue;
  createdAt: Date;
  reportArtifact: Readonly<{
    id: string;
    assessmentAttemptId: string;
    studentId: string;
  }>;
}>;

type ReviewActor = Readonly<{ userId: string; role: UserRole | string }>;
type ReviewAction = ReviewActor & Readonly<{ revisionId: string; motif: string }>;

type ReviewServiceDependencies = Readonly<{
  findCoach(userId: string): Promise<Readonly<{ id: string }> | null>;
  listAssignedPending(coachId: string): Promise<readonly PendingReportReview[]>;
  findAssignedRevision(revisionId: string, coachId: string): Promise<PendingReportReview | null>;
  resolvePack: PackResolver;
  validate(input: Readonly<{ revisionId: string; coachId: string; motif: string; reviewedAt: Date }>): Promise<unknown>;
  publish(input: Readonly<{ revisionId: string; coachId: string; publishedAt: Date }>): Promise<unknown>;
  preview(input: Readonly<{ revisionId: string }>): Promise<unknown>;
  reject(input: Readonly<{ revisionId: string; coachId: string; motif: string; reviewedAt: Date }>): Promise<unknown>;
  now: () => Date;
}>;

export class StaffReviewError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'StaffReviewError';
  }
}

const revisionSelection = {
  id: true,
  status: true,
  validationFailures: true,
  reportPackId: true,
  reportPackVersion: true,
  content: true,
  createdAt: true,
  reportArtifact: {
    select: { id: true, assessmentAttemptId: true, studentId: true },
  },
} as const;

function assignedToCoach(coachId: string) {
  return {
    reportArtifact: {
      assessmentAttempt: {
        student: {
          coachAssignments: { some: { coachId, status: 'ACTIVE' as const } },
        },
      },
    },
  };
}

const defaultDependencies: ReviewServiceDependencies = {
  findCoach: (userId) => prisma.coachProfile.findUnique({ where: { userId }, select: { id: true } }),
  listAssignedPending: (coachId) => prisma.reportRevision.findMany({
    where: { status: 'PENDING_REVIEW', ...assignedToCoach(coachId) },
    select: revisionSelection,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  }),
  findAssignedRevision: (revisionId, coachId) => prisma.reportRevision.findFirst({
    where: { id: revisionId, status: 'PENDING_REVIEW', ...assignedToCoach(coachId) },
    select: revisionSelection,
  }),
  resolvePack: resolveEnabledPack,
  validate: (input) => validateReportRevision({ prisma, ...input }),
  publish: (input) => publishReportRevision({ prisma, ...input }),
  preview: (input) => previewReportRevision({ prisma, ...input }),
  reject: (input) => rejectReportRevision({ prisma, ...input }),
  now: () => new Date(),
};

async function coachFor(actor: ReviewActor, dependencies: ReviewServiceDependencies): Promise<string> {
  if (actor.role !== 'COACH' || !actor.userId.trim()) throw new StaffReviewError('NOT_FOUND');
  const coach = await dependencies.findCoach(actor.userId);
  if (coach === null) throw new StaffReviewError('NOT_FOUND');
  return coach.id;
}

function versionOf(revision: PendingReportReview): number {
  const version = Number(revision.reportPackVersion);
  if (!Number.isSafeInteger(version) || version < 1) throw new StaffReviewError('NOT_FOUND');
  return version;
}

function packIsEnabled(revision: PendingReportReview, dependencies: ReviewServiceDependencies): boolean {
  return dependencies.resolvePack(revision.reportPackId, versionOf(revision)) !== null;
}

async function assignedPending(
  action: ReviewAction,
  dependencies: ReviewServiceDependencies,
): Promise<Readonly<{ revision: PendingReportReview; coachId: string; motif: string }>> {
  const coachId = await coachFor(action, dependencies);
  const revision = await dependencies.findAssignedRevision(action.revisionId, coachId);
  if (revision === null || !packIsEnabled(revision, dependencies)) throw new StaffReviewError('NOT_FOUND');
  const motif = action.motif.trim();
  if (!motif) throw new StaffReviewError('REPORT_REVIEW_MOTIF_REQUIRED');
  return Object.freeze({ revision, coachId, motif });
}

export async function listPendingReportReviews(
  actor: ReviewActor,
  overrides: Partial<ReviewServiceDependencies> = {},
): Promise<readonly PendingReportReview[]> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const coachId = await coachFor(actor, dependencies);
  const revisions = await dependencies.listAssignedPending(coachId);
  return Object.freeze(revisions.filter((revision) => packIsEnabled(revision, dependencies)));
}

export async function validateAndPublishPendingReport(
  action: ReviewAction,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const { revision, coachId, motif } = await assignedPending(action, dependencies);
  if (revision.validationFailures.length > 0) throw new StaffReviewError('REPORT_VALIDATION_FAILURES');
  const reviewedAt = dependencies.now();
  await dependencies.validate({ revisionId: revision.id, coachId, motif, reviewedAt });
  return dependencies.publish({ revisionId: revision.id, coachId, publishedAt: reviewedAt });
}

export async function previewPendingReport(
  action: ReviewActor & Readonly<{ revisionId: string }>,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const coachId = await coachFor(action, dependencies);
  const revision = await dependencies.findAssignedRevision(action.revisionId, coachId);
  if (revision === null || !packIsEnabled(revision, dependencies)) throw new StaffReviewError('NOT_FOUND');
  if (revision.validationFailures.length > 0) throw new StaffReviewError('REPORT_VALIDATION_FAILURES');
  return dependencies.preview({ revisionId: revision.id });
}

export async function rejectPendingReport(
  action: ReviewAction,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const { revision, coachId, motif } = await assignedPending(action, dependencies);
  return dependencies.reject({ revisionId: revision.id, coachId, motif, reviewedAt: dependencies.now() });
}
