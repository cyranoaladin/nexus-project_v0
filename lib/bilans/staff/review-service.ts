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

type ReviewServiceDependencies = Readonly<{
  listPending(): Promise<readonly PendingReportReview[]>;
  findPending(revisionId: string): Promise<PendingReportReview | null>;
  resolvePack: PackResolver;
  validate(input: Readonly<{ revisionId: string; reviewerId: string; motif: string; reviewedAt: Date }>): Promise<unknown>;
  publish(input: Readonly<{ revisionId: string; reviewerId: string; publishedAt: Date }>): Promise<unknown>;
  preview(input: Readonly<{ revisionId: string }>): Promise<unknown>;
  reject(input: Readonly<{ revisionId: string; reviewerId: string; motif: string; reviewedAt: Date }>): Promise<unknown>;
  now: () => Date;
}>;

export class StaffReviewError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'StaffReviewError';
  }
}

const defaultDependencies: ReviewServiceDependencies = {
  listPending: () => prisma.reportRevision.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: revisionSelection,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  }),
  findPending: (revisionId) => prisma.reportRevision.findFirst({
    where: { id: revisionId, status: 'PENDING_REVIEW' },
    select: revisionSelection,
  }),
  resolvePack: resolveEnabledPack,
  validate: (input) => validateReportRevision({ prisma, ...input }),
  publish: (input) => publishReportRevision({ prisma, ...input }),
  preview: (input) => previewReportRevision({ prisma, ...input }),
  reject: (input) => rejectReportRevision({ prisma, ...input }),
  now: () => new Date(),
};

/**
 * Report review and publication is an administrative gate, not subject-matter
 * expertise: any authenticated ASSISTANTE may act on any pending report from
 * an enabled pack. Coach is deliberately not accepted here (see the state
 * machine: only ASSISTANTE performs VALIDATE_REPORT/REJECT_REPORT/
 * PUBLISH_REPORT). A coach's own subject knowledge no longer gates
 * publication to families.
 */
function assertAssistante(actor: ReviewActor): string {
  if (actor.role !== 'ASSISTANTE' || !actor.userId.trim()) throw new StaffReviewError('NOT_FOUND');
  return actor.userId;
}

function versionOf(revision: PendingReportReview): number {
  const version = Number(revision.reportPackVersion);
  if (!Number.isSafeInteger(version) || version < 1) throw new StaffReviewError('NOT_FOUND');
  return version;
}

function packIsEnabled(revision: PendingReportReview, dependencies: ReviewServiceDependencies): boolean {
  return dependencies.resolvePack(revision.reportPackId, versionOf(revision)) !== null;
}

async function pendingReview(
  action: ReviewAction,
  dependencies: ReviewServiceDependencies,
): Promise<Readonly<{ revision: PendingReportReview; reviewerId: string; motif: string }>> {
  const reviewerId = assertAssistante(action);
  const revision = await dependencies.findPending(action.revisionId);
  if (revision === null || !packIsEnabled(revision, dependencies)) throw new StaffReviewError('NOT_FOUND');
  const motif = action.motif.trim();
  if (!motif) throw new StaffReviewError('REPORT_REVIEW_MOTIF_REQUIRED');
  return Object.freeze({ revision, reviewerId, motif });
}

export async function listPendingReportReviews(
  actor: ReviewActor,
  overrides: Partial<ReviewServiceDependencies> = {},
): Promise<readonly PendingReportReview[]> {
  const dependencies = { ...defaultDependencies, ...overrides };
  assertAssistante(actor);
  const revisions = await dependencies.listPending();
  return Object.freeze(revisions.filter((revision) => packIsEnabled(revision, dependencies)));
}

export async function validateAndPublishPendingReport(
  action: ReviewAction,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const { revision, reviewerId, motif } = await pendingReview(action, dependencies);
  if (revision.validationFailures.length > 0) throw new StaffReviewError('REPORT_VALIDATION_FAILURES');
  const reviewedAt = dependencies.now();
  await dependencies.validate({ revisionId: revision.id, reviewerId, motif, reviewedAt });
  return dependencies.publish({ revisionId: revision.id, reviewerId, publishedAt: reviewedAt });
}

export async function previewPendingReport(
  action: ReviewActor & Readonly<{ revisionId: string }>,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  assertAssistante(action);
  const revision = await dependencies.findPending(action.revisionId);
  if (revision === null || !packIsEnabled(revision, dependencies)) throw new StaffReviewError('NOT_FOUND');
  if (revision.validationFailures.length > 0) throw new StaffReviewError('REPORT_VALIDATION_FAILURES');
  return dependencies.preview({ revisionId: revision.id });
}

export async function rejectPendingReport(
  action: ReviewAction,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const { revision, reviewerId, motif } = await pendingReview(action, dependencies);
  return dependencies.reject({ revisionId: revision.id, reviewerId, motif, reviewedAt: dependencies.now() });
}
