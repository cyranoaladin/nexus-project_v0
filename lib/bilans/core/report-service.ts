import type { Prisma, PrismaClient } from '@prisma/client';

import { getLegalTransition } from './state-machine';
import type { LifecycleActor, LifecycleStatus, TransitionAction } from './types';

type ReportDatabase = Pick<PrismaClient, '$transaction'>;

export class BilanReportServiceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'BilanReportServiceError';
  }
}

export async function advanceAttemptLifecycle(
  transaction: Prisma.TransactionClient,
  input: Readonly<{
    attemptId: string;
    from: LifecycleStatus;
    action: TransitionAction;
    actor: LifecycleActor;
  }>,
): Promise<LifecycleStatus> {
  const transition = getLegalTransition(input.from, input.action, input.actor);
  if (transition === undefined) throw new BilanReportServiceError('BILAN_INVALID_TRANSITION');
  const updated = await transaction.canonicalAssessmentAttempt.updateMany({
    where: { id: input.attemptId, status: input.from },
    data: { status: transition.to },
  });
  if (updated.count !== 1) throw new BilanReportServiceError('BILAN_CONCURRENT_TRANSITION');
  return transition.to;
}

export async function createPendingReport(
  transaction: Prisma.TransactionClient,
  input: Readonly<{
    attemptId: string;
    studentId: string;
    scoreSnapshotId: string;
    reportPackId: string;
    reportPackVersion: string;
    contextChecksum: string;
    content: Prisma.InputJsonValue;
    validationFailures: readonly string[];
  }>,
) {
  const artifact = await transaction.reportArtifact.create({
    data: {
      studentId: input.studentId,
      assessmentAttemptId: input.attemptId,
      status: 'PENDING_REVIEW',
    },
  });
  const revision = await transaction.reportRevision.create({
    data: {
      reportArtifactId: artifact.id,
      scoreSnapshotId: input.scoreSnapshotId,
      status: 'PENDING_REVIEW',
      reportPackId: input.reportPackId,
      reportPackVersion: input.reportPackVersion,
      corpusManifestId: 'disabled',
      corpusManifestVersion: '1',
      promptRevision: 'deterministic-no-agent-v1',
      contextChecksum: input.contextChecksum,
      content: input.content,
      validationFailures: [...input.validationFailures],
    },
  });
  await advanceAttemptLifecycle(transaction, {
    attemptId: input.attemptId,
    from: 'SCORED',
    action: 'CREATE_REPORT',
    actor: 'WORKER',
  });
  return Object.freeze({ artifact, revision });
}

type ReviewInput = Readonly<{
  prisma: ReportDatabase;
  revisionId: string;
  coachId: string;
  motif: string;
  reviewedAt: Date;
}>;

async function pendingRevision(transaction: Prisma.TransactionClient, revisionId: string) {
  const revision = await transaction.reportRevision.findUnique({
    where: { id: revisionId },
    select: {
      id: true,
      status: true,
      validationFailures: true,
      reportArtifact: { select: { id: true, assessmentAttemptId: true, status: true } },
    },
  });
  if (revision === null || revision.status !== 'PENDING_REVIEW') {
    throw new BilanReportServiceError('REPORT_NOT_PENDING_REVIEW');
  }
  return revision;
}

function assertMotif(motif: string): string {
  const value = motif.trim();
  if (!value) throw new BilanReportServiceError('REPORT_REVIEW_MOTIF_REQUIRED');
  return value;
}

export async function validateReportRevision(input: ReviewInput) {
  return input.prisma.$transaction(async (transaction) => {
    const revision = await pendingRevision(transaction, input.revisionId);
    if (revision.validationFailures.length > 0) {
      throw new BilanReportServiceError('REPORT_VALIDATION_FAILURES');
    }
    const review = await transaction.reportReview.create({
      data: {
        reportRevisionId: revision.id,
        coachId: input.coachId,
        decision: 'APPROVED',
        motif: assertMotif(input.motif),
        reviewedAt: input.reviewedAt,
      },
    });
    const updated = await transaction.reportRevision.updateMany({
      where: { id: revision.id, status: 'PENDING_REVIEW', validationFailures: { isEmpty: true } },
      data: { status: 'COACH_VALIDATED' },
    });
    if (updated.count !== 1) throw new BilanReportServiceError('REPORT_CONCURRENT_REVIEW');
    await advanceAttemptLifecycle(transaction, {
      attemptId: revision.reportArtifact.assessmentAttemptId,
      from: 'REPORT_PENDING_REVIEW',
      action: 'VALIDATE_REPORT',
      actor: 'COACH',
    });
    return Object.freeze({ revisionId: revision.id, reviewId: review.id, status: 'COACH_VALIDATED' as const });
  });
}

export async function rejectReportRevision(input: ReviewInput) {
  return input.prisma.$transaction(async (transaction) => {
    const revision = await pendingRevision(transaction, input.revisionId);
    const review = await transaction.reportReview.create({
      data: {
        reportRevisionId: revision.id,
        coachId: input.coachId,
        decision: 'REJECTED',
        motif: assertMotif(input.motif),
        reviewedAt: input.reviewedAt,
      },
    });
    const updated = await transaction.reportRevision.updateMany({
      where: { id: revision.id, status: 'PENDING_REVIEW' },
      data: { status: 'REJECTED' },
    });
    if (updated.count !== 1) throw new BilanReportServiceError('REPORT_CONCURRENT_REVIEW');
    await advanceAttemptLifecycle(transaction, {
      attemptId: revision.reportArtifact.assessmentAttemptId,
      from: 'REPORT_PENDING_REVIEW',
      action: 'REJECT_REPORT',
      actor: 'COACH',
    });
    return Object.freeze({ revisionId: revision.id, reviewId: review.id, status: 'COACH_REJECTED' as const });
  });
}

export async function publishReportRevision(input: Readonly<{
  prisma: ReportDatabase;
  revisionId: string;
  coachId: string;
  publishedAt: Date;
}>) {
  return input.prisma.$transaction(async (transaction) => {
    const revision = await transaction.reportRevision.findUnique({
      where: { id: input.revisionId },
      select: {
        id: true,
        status: true,
        validationFailures: true,
        reportArtifact: { select: { id: true, assessmentAttemptId: true, status: true } },
      },
    });
    if (revision === null || revision.status !== 'COACH_VALIDATED') {
      throw new BilanReportServiceError('REPORT_NOT_COACH_VALIDATED');
    }
    if (revision.validationFailures.length > 0) {
      throw new BilanReportServiceError('REPORT_VALIDATION_FAILURES');
    }
    const approvedReview = await transaction.reportReview.findFirst({
      where: { reportRevisionId: revision.id, coachId: input.coachId, decision: 'APPROVED' },
      select: { id: true },
    });
    if (approvedReview === null) throw new BilanReportServiceError('REPORT_APPROVED_REVIEW_REQUIRED');
    const artifact = await transaction.reportArtifact.update({
      where: { id: revision.reportArtifact.id },
      data: {
        status: 'PUBLISHED',
        currentPublishedRevisionId: revision.id,
        publishedAt: input.publishedAt,
      },
    });
    await advanceAttemptLifecycle(transaction, {
      attemptId: revision.reportArtifact.assessmentAttemptId,
      from: 'COACH_VALIDATED',
      action: 'PUBLISH_REPORT',
      actor: 'COACH',
    });
    return Object.freeze({ revisionId: revision.id, artifactId: artifact.id, status: 'PUBLISHED' as const });
  });
}
