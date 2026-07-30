import 'server-only';

import type { Prisma } from '@prisma/client';

import { AssessmentEngineError } from './errors';
import { sha256 } from './hash';
import {
  buildDeterministicReport,
  type EngineReportAudience,
} from './report';
import {
  parseCanonicalScoreResult,
  staffAttemptWhere,
} from './scoring-service';
import {
  assertActorIdentity,
  attemptAccessWhere,
  auditActor,
  engineNow,
  resolveAttemptDefinition,
  runIdempotently,
  type AssessmentEngineActor,
  type AssessmentEngineContext,
} from './workflow-service';

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function revisionProjection(revision: Readonly<{
  id: string;
  reportArtifactId: string;
  scoreSnapshotId: string;
  status: string;
  contextChecksum: string;
  createdAt: Date;
}>) {
  return {
    id: revision.id,
    artifactId: revision.reportArtifactId,
    scoreSnapshotId: revision.scoreSnapshotId,
    status: revision.status,
    contextChecksum: revision.contextChecksum,
    createdAt: revision.createdAt.toISOString(),
  };
}

function publicationProjection(publication: Readonly<{
  id: string;
  reportArtifactId: string;
  reportRevisionId: string;
  audience: string;
  version: number;
  status: string;
  publishedAt: Date;
  revokedAt: Date | null;
}>) {
  return {
    id: publication.id,
    artifactId: publication.reportArtifactId,
    revisionId: publication.reportRevisionId,
    audience: publication.audience,
    version: publication.version,
    status: publication.status,
    publishedAt: publication.publishedAt.toISOString(),
    revokedAt: publication.revokedAt?.toISOString() ?? null,
  };
}

function staffRevisionWhere(
  actor: AssessmentEngineActor,
  revisionId: string,
): Prisma.ReportRevisionWhereInput {
  const attemptWhere = staffAttemptWhere(actor, '__placeholder__');
  delete attemptWhere.id;
  return {
    id: revisionId,
    reportArtifact: {
      assessmentAttempt: attemptWhere,
    },
  };
}

function staffPublicationWhere(
  actor: AssessmentEngineActor,
  publicationId: string,
): Prisma.ReportPublicationWhereInput {
  const attemptWhere = staffAttemptWhere(actor, '__placeholder__');
  delete attemptWhere.id;
  return {
    id: publicationId,
    reportArtifact: {
      assessmentAttempt: attemptWhere,
    },
  };
}

export async function generateAssessmentReport(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    attemptId: string;
    audience: EngineReportAudience;
    idempotencyKey: string;
  }>,
) {
  const now = engineNow(context);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(
      tx,
      input.actor,
      ['ASSISTANTE', 'COACH', 'ADMIN'],
    );
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: {
        attemptId: input.attemptId,
        audience: input.audience,
      },
      scope: 'GENERATE_REPORT',
      load: async (id) => {
        const revision = await tx.reportRevision.findFirst({
          where: staffRevisionWhere(input.actor, id),
        });
        return revision ? revisionProjection(revision) : null;
      },
      execute: async () => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_assessment_attempts"
          WHERE "id" = ${input.attemptId}
          FOR UPDATE
        `;
        const attempt = await tx.canonicalAssessmentAttempt.findFirst({
          where: staffAttemptWhere(input.actor, input.attemptId),
          include: {
            assignment: {
              select: {
                bilanRequestId: true,
                id: true,
                moduleId: true,
              },
            },
            scoreSnapshots: {
              where: { resultKind: 'FINAL' },
              orderBy: [{ scoredAt: 'desc' }, { createdAt: 'desc' }],
              take: 1,
            },
          },
        });
        if (!attempt || !attempt.assignment) {
          throw new AssessmentEngineError('ATTEMPT_NOT_FOUND', 404);
        }
        if (attempt.status !== 'SCORED' && attempt.status !== 'REPORT_PENDING_REVIEW') {
          throw new AssessmentEngineError('FINAL_SCORE_REQUIRED');
        }
        const scoreSnapshot = attempt.scoreSnapshots[0];
        if (!scoreSnapshot || scoreSnapshot.maxScore === null) {
          throw new AssessmentEngineError('FINAL_SCORE_REQUIRED');
        }
        const definition = resolveAttemptDefinition(context, attempt);
        const report = buildDeterministicReport({
          audience: input.audience,
          definition,
          score: parseCanonicalScoreResult(scoreSnapshot.result),
        });
        const artifact = await tx.reportArtifact.upsert({
          where: {
            assessmentAttemptId_audience: {
              assessmentAttemptId: attempt.id,
              audience: input.audience,
            },
          },
          create: {
            studentId: attempt.studentId,
            assessmentAttemptId: attempt.id,
            audience: input.audience,
            status: 'PENDING_REVIEW',
          },
          update: {},
        });
        const existing = await tx.reportRevision.findFirst({
          where: {
            reportArtifactId: artifact.id,
            scoreSnapshotId: scoreSnapshot.id,
            contextChecksum: report.contextChecksum,
          },
        });
        if (existing) return revisionProjection(existing);
        const revision = await tx.reportRevision.create({
          data: {
            reportArtifactId: artifact.id,
            scoreSnapshotId: scoreSnapshot.id,
            status: 'PENDING_REVIEW',
            reportPackId: 'canonical-bilan-template',
            reportPackVersion: report.templateVersion,
            corpusManifestId: context.catalog.version.campaignId,
            corpusManifestVersion:
              `manifest-${context.catalog.version.manifestVersion}`,
            promptRevision: 'deterministic-no-llm',
            contextChecksum: report.contextChecksum,
            content: asJson(report),
          },
        });
        if (attempt.status === 'SCORED') {
          await tx.canonicalAssessmentAttempt.update({
            where: { id: attempt.id },
            data: { status: 'REPORT_PENDING_REVIEW' },
          });
        }
        await tx.bilanRequest.update({
          where: { id: attempt.assignment.bilanRequestId },
          data: {
            status: 'REVIEW_PENDING',
            lastActivityAt: now,
          },
        });
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: attempt.assignment.bilanRequestId,
            assignmentId: attempt.assignment.id,
            assessmentAttemptId: attempt.id,
            eventType: 'REPORT_GENERATED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: {
              audience: input.audience,
              revisionId: revision.id,
            },
          },
        });
        return revisionProjection(revision);
      },
    });
  });
}

export async function approveAssessmentReport(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    revisionId: string;
    motif: string;
    idempotencyKey: string;
  }>,
) {
  const motif = input.motif.trim();
  if (!motif || motif.length > 2_000) {
    throw new AssessmentEngineError('INVALID_RESPONSE', 400);
  }
  const now = engineNow(context);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['COACH', 'ADMIN']);
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: { motif, revisionId: input.revisionId },
      scope: 'APPROVE_REPORT',
      load: async (id) => {
        const revision = await tx.reportRevision.findFirst({
          where: staffRevisionWhere(input.actor, id),
        });
        return revision ? revisionProjection(revision) : null;
      },
      execute: async () => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_report_revisions"
          WHERE "id" = ${input.revisionId}
          FOR UPDATE
        `;
        const revision = await tx.reportRevision.findFirst({
          where: staffRevisionWhere(input.actor, input.revisionId),
          include: {
            reportArtifact: {
              include: {
                assessmentAttempt: {
                  include: {
                    assignment: {
                      select: {
                        bilanRequestId: true,
                        id: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
        const assignment = revision?.reportArtifact.assessmentAttempt.assignment;
        if (!revision || !assignment) {
          throw new AssessmentEngineError('REPORT_NOT_FOUND', 404);
        }
        if (revision.status !== 'PENDING_REVIEW') {
          throw new AssessmentEngineError('REPORT_NOT_APPROVED');
        }
        const coach = input.actor.role === 'COACH'
          ? await tx.coachProfile.findUnique({
            where: { userId: input.actor.userId },
            select: { id: true },
          })
          : null;
        if (input.actor.role === 'COACH' && !coach) {
          throw new AssessmentEngineError('ROLE_FORBIDDEN', 403);
        }
        await tx.reportReview.create({
          data: {
            reportRevisionId: revision.id,
            reviewerUserId: input.actor.userId,
            coachId: coach?.id,
            decision: 'APPROVED',
            motif,
            reviewedAt: now,
          },
        });
        const approved = await tx.reportRevision.update({
          where: { id: revision.id },
          data: { status: 'COACH_VALIDATED' },
        });
        await tx.canonicalAssessmentAttempt.updateMany({
          where: {
            id: revision.reportArtifact.assessmentAttemptId,
            status: 'REPORT_PENDING_REVIEW',
          },
          data: { status: 'COACH_VALIDATED' },
        });
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: assignment.bilanRequestId,
            assignmentId: assignment.id,
            assessmentAttemptId: revision.reportArtifact.assessmentAttemptId,
            eventType: 'REPORT_APPROVED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: { revisionId: revision.id },
          },
        });
        return revisionProjection(approved);
      },
    });
  });
}

export async function publishAssessmentReport(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    revisionId: string;
    idempotencyKey: string;
  }>,
) {
  const now = engineNow(context);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['COACH', 'ADMIN']);
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: { revisionId: input.revisionId },
      scope: 'PUBLISH_REPORT',
      load: async (id) => {
        const publication = await tx.reportPublication.findFirst({
          where: staffPublicationWhere(input.actor, id),
        });
        return publication ? publicationProjection(publication) : null;
      },
      execute: async () => {
        const revision = await tx.reportRevision.findFirst({
          where: staffRevisionWhere(input.actor, input.revisionId),
          include: {
            reportArtifact: {
              include: {
                assessmentAttempt: {
                  include: {
                    assignment: {
                      include: {
                        bilanRequest: {
                          select: {
                            parentUserId: true,
                            parentUser: {
                              select: { email: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            reviews: {
              where: { decision: 'APPROVED' },
              take: 1,
            },
          },
        });
        const assignment = revision?.reportArtifact.assessmentAttempt.assignment;
        if (!revision || !assignment) {
          throw new AssessmentEngineError('REPORT_NOT_FOUND', 404);
        }
        if (revision.status !== 'COACH_VALIDATED' || !revision.reviews.length) {
          throw new AssessmentEngineError('REPORT_NOT_APPROVED');
        }
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_report_artifacts"
          WHERE "id" = ${revision.reportArtifactId}
          FOR UPDATE
        `;
        const active = await tx.reportPublication.findFirst({
          where: {
            reportArtifactId: revision.reportArtifactId,
            status: 'PUBLISHED',
          },
        });
        if (active) {
          if (active.reportRevisionId !== revision.id) {
            throw new AssessmentEngineError('REPORT_ALREADY_PUBLISHED');
          }
          return publicationProjection(active);
        }
        const latest = await tx.reportPublication.aggregate({
          where: { reportArtifactId: revision.reportArtifactId },
          _max: { version: true },
        });
        const publication = await tx.reportPublication.create({
          data: {
            reportArtifactId: revision.reportArtifactId,
            reportRevisionId: revision.id,
            audience: revision.reportArtifact.audience,
            version: (latest._max.version ?? 0) + 1,
            status: 'PUBLISHED',
            publishedByUserId: input.actor.userId,
            publishedAt: now,
            idempotencyKey: input.idempotencyKey,
            idempotencyRequestHash: sha256({ revisionId: revision.id }),
          },
        });
        await tx.reportArtifact.update({
          where: { id: revision.reportArtifactId },
          data: {
            status: 'PUBLISHED',
            currentPublishedRevisionId: revision.id,
            publishedAt: now,
          },
        });
        await tx.canonicalAssessmentAttempt.updateMany({
          where: {
            id: revision.reportArtifact.assessmentAttemptId,
            status: 'COACH_VALIDATED',
          },
          data: { status: 'PUBLISHED' },
        });
        if (revision.reportArtifact.audience === 'PARENT') {
          const parentUserId = assignment.bilanRequest.parentUserId;
          const parentUser = assignment.bilanRequest.parentUser;
          if (!parentUserId || !parentUser) {
            throw new AssessmentEngineError('REPORT_NOT_FOUND', 404);
          }
          await tx.bilanRequest.update({
            where: { id: assignment.bilanRequestId },
            data: {
              status: 'PUBLISHED',
              publishedAt: now,
              lastActivityAt: now,
            },
          });
          await tx.notificationOutbox.create({
            data: {
              eventType: 'REPORT_PUBLISHED',
              sourceEventKey: `${publication.id}.published`,
              recipientKey: `user:${parentUserId}`,
              recipientUserId: parentUserId,
              recipientAddress: parentUser.email,
              channel: 'EMAIL',
              payload: {
                audience: 'PARENT',
                publicationId: publication.id,
              },
            },
          });
        }
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: assignment.bilanRequestId,
            assignmentId: assignment.id,
            assessmentAttemptId: revision.reportArtifact.assessmentAttemptId,
            eventType: 'REPORT_PUBLISHED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: {
              audience: revision.reportArtifact.audience,
              publicationId: publication.id,
              revisionId: revision.id,
            },
          },
        });
        return publicationProjection(publication);
      },
    });
  });
}

export async function revokeAssessmentReport(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    publicationId: string;
    reason: string;
    idempotencyKey: string;
  }>,
) {
  const reason = input.reason.trim();
  if (!reason || reason.length > 2_000) {
    throw new AssessmentEngineError('INVALID_RESPONSE', 400);
  }
  const now = engineNow(context);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['COACH', 'ADMIN']);
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: { publicationId: input.publicationId, reason },
      scope: 'REVOKE_REPORT',
      load: async (id) => {
        const publication = await tx.reportPublication.findFirst({
          where: staffPublicationWhere(input.actor, id),
        });
        return publication ? publicationProjection(publication) : null;
      },
      execute: async () => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_report_publications"
          WHERE "id" = ${input.publicationId}
          FOR UPDATE
        `;
        const publication = await tx.reportPublication.findFirst({
          where: staffPublicationWhere(input.actor, input.publicationId),
          include: {
            reportArtifact: {
              include: {
                assessmentAttempt: {
                  include: {
                    assignment: {
                      select: {
                        bilanRequestId: true,
                        id: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
        const assignment = publication?.reportArtifact.assessmentAttempt.assignment;
        if (!publication || !assignment) {
          throw new AssessmentEngineError('REPORT_NOT_FOUND', 404);
        }
        if (publication.status === 'REVOKED') {
          return publicationProjection(publication);
        }
        const revoked = await tx.reportPublication.update({
          where: { id: publication.id },
          data: {
            status: 'REVOKED',
            revokedByUserId: input.actor.userId,
            revokedAt: now,
            revocationReason: reason,
          },
        });
        await tx.reportArtifact.update({
          where: { id: publication.reportArtifactId },
          data: {
            status: 'ARCHIVED',
            currentPublishedRevisionId: null,
            publishedAt: null,
          },
        });
        const otherActive = await tx.reportPublication.count({
          where: {
            reportArtifact: {
              assessmentAttemptId:
                publication.reportArtifact.assessmentAttemptId,
            },
            status: 'PUBLISHED',
          },
        });
        if (otherActive === 0) {
          await tx.canonicalAssessmentAttempt.updateMany({
            where: {
              id: publication.reportArtifact.assessmentAttemptId,
              status: 'PUBLISHED',
            },
            data: { status: 'SCORED' },
          });
        }
        if (publication.audience === 'PARENT') {
          await tx.bilanRequest.update({
            where: { id: assignment.bilanRequestId },
            data: {
              status: 'REVIEW_PENDING',
              publishedAt: null,
              lastActivityAt: now,
            },
          });
        }
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: assignment.bilanRequestId,
            assignmentId: assignment.id,
            assessmentAttemptId:
              publication.reportArtifact.assessmentAttemptId,
            eventType: 'REPORT_REVOKED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: {
              audience: publication.audience,
              publicationId: publication.id,
            },
          },
        });
        return publicationProjection(revoked);
      },
    });
  });
}

export async function getPublishedAssessmentReport(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    attemptId: string;
    audience?: EngineReportAudience;
  }>,
) {
  const allowedRoles: AssessmentEngineActor['role'][] = [
    'PARENT',
    'ELEVE',
    'ADMIN',
  ];
  const audience = input.actor.role === 'PARENT'
    ? 'PARENT'
    : input.actor.role === 'ELEVE'
      ? 'STUDENT'
      : input.audience ?? 'NEXUS';
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, allowedRoles);
    const publication = await tx.reportPublication.findFirst({
      where: {
        audience,
        status: 'PUBLISHED',
        reportArtifact: {
          assessmentAttempt: attemptAccessWhere(input.actor, input.attemptId),
        },
      },
      include: {
        reportRevision: {
          select: {
            content: true,
            contextChecksum: true,
            id: true,
          },
        },
      },
      orderBy: { version: 'desc' },
    });
    if (!publication) {
      throw new AssessmentEngineError('REPORT_NOT_PUBLISHED', 404);
    }
    return {
      publicationId: publication.id,
      revisionId: publication.reportRevision.id,
      audience: publication.audience,
      contextChecksum: publication.reportRevision.contextChecksum,
      publishedAt: publication.publishedAt.toISOString(),
      report: publication.reportRevision.content,
    };
  });
}
