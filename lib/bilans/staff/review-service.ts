import { ReportRevisionStatus, type Prisma, type UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import {
  BilanReportServiceError,
  previewReportRevision,
  publishReportRevision,
  rejectReportRevision,
  renderReportRevisionAudiencePdf,
  validateReportRevision,
} from '../core/report-service';
import type { ReportAudience } from '../render/profile-copy';

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
  renderPdf(input: Readonly<{ revisionId: string; audience: ReportAudience }>): Promise<Buffer>;
  reject(input: Readonly<{ revisionId: string; reviewerId: string; motif: string; reviewedAt: Date }>): Promise<unknown>;
  now: () => Date;
}>;

export class StaffReviewError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'StaffReviewError';
  }
}

// validateReportRevision() and publishReportRevision() are two separate
// service calls (see the "Chromium and all other rendering happen before
// opening the final, short transaction" comment in report-service.ts --
// rendering deliberately happens outside any transaction). If publish
// throws after validate already committed COACH_VALIDATED, the revision
// would otherwise vanish from every assistante-facing query below (both
// scoped to PENDING_REVIEW only) with no way to retry -- stranded forever,
// invisible in the dashboard, any resubmission 404-ing via NOT_FOUND.
// Including not-yet-materialized COACH_VALIDATED revisions here surfaces
// them again so a retry can pick up exactly where publish failed.
const actionableStatus = {
  in: [ReportRevisionStatus.PENDING_REVIEW, ReportRevisionStatus.COACH_VALIDATED],
};

const defaultDependencies: ReviewServiceDependencies = {
  listPending: () => prisma.reportRevision.findMany({
    where: { status: actionableStatus, materialization: null },
    select: revisionSelection,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  }),
  findPending: (revisionId) => prisma.reportRevision.findFirst({
    where: { id: revisionId, status: actionableStatus, materialization: null },
    select: revisionSelection,
  }),
  resolvePack: resolveEnabledPack,
  validate: (input) => validateReportRevision({ prisma, ...input }),
  publish: (input) => publishReportRevision({ prisma, ...input }),
  preview: (input) => previewReportRevision({ prisma, ...input }),
  renderPdf: (input) => renderReportRevisionAudiencePdf({ prisma, ...input }),
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
 *
 * CONDITIONAL ON NARRATION STAYING OFF. This model was decided for the
 * PLANCHER deployment, where every report is deterministically rendered --
 * an assistante checking process, not content, is sufficient. The day
 * OPENROUTER_API_KEY is confirmed and the worker starts producing
 * AI-narrated reports (see the FLIP POINT comment in
 * ../worker/generate-report-job.ts), a subject-qualified COACH review must
 * be reintroduced as a prerequisite before ASSISTANTE can publish. That
 * re-wiring does not exist yet -- do not flip the LLM on without rebuilding it.
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
  // A stranded retry (see actionableStatus above) already has an APPROVED
  // review on record from the attempt that validated it -- re-running
  // validate would fail outright (its DB guard only matches
  // status='PENDING_REVIEW') and would also record a second, redundant
  // review. Only genuinely PENDING_REVIEW revisions get validated here.
  if (revision.status === 'PENDING_REVIEW') {
    await dependencies.validate({ revisionId: revision.id, reviewerId, motif, reviewedAt });
  }
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

export async function renderPendingReportPdf(
  action: ReviewActor & Readonly<{ revisionId: string; audience: ReportAudience }>,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  assertAssistante(action);
  const revision = await dependencies.findPending(action.revisionId);
  if (revision === null || !packIsEnabled(revision, dependencies)) throw new StaffReviewError('NOT_FOUND');
  if (revision.validationFailures.length > 0) throw new StaffReviewError('REPORT_VALIDATION_FAILURES');
  let pdf: Buffer;
  try {
    pdf = await dependencies.renderPdf({ revisionId: revision.id, audience: action.audience });
  } catch (error) {
    if (error instanceof BilanReportServiceError) {
      throw new StaffReviewError(
        error.code === 'REPORT_PDF_UNAVAILABLE' ? 'REPORT_PDF_UNAVAILABLE' : 'NOT_FOUND',
      );
    }
    throw error;
  }
  return Object.freeze({
    pdf: Buffer.from(pdf),
    filename: `bilan-nexus-${action.audience.toLowerCase()}.pdf`,
  });
}

export async function rejectPendingReport(
  action: ReviewAction,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const { revision, reviewerId, motif } = await pendingReview(action, dependencies);
  // REJECT_REPORT is only a legal transition from REPORT_PENDING_REVIEW
  // (see state-machine.ts) -- a stranded COACH_VALIDATED revision (see
  // actionableStatus above) is visible here for publish-retry, not reject.
  // Without this guard the request would still fail safely one layer down
  // (rejectReportRevision's own DB guard only matches PENDING_REVIEW), but
  // as a generic REPORT_CONCURRENT_REVIEW that doesn't explain why.
  if (revision.status !== 'PENDING_REVIEW') throw new StaffReviewError('REPORT_ALREADY_VALIDATED');
  return dependencies.reject({ revisionId: revision.id, reviewerId, motif, reviewedAt: dependencies.now() });
}
