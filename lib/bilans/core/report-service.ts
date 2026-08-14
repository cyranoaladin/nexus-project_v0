import type { Prisma, PrismaClient } from '@prisma/client';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import { buildQuestionEvidence, type QuestionEvidence } from '../render/question-evidence';
import { getLegalTransition } from './state-machine';
import type { LifecycleActor, LifecycleStatus, TransitionAction } from './types';
import {
  parseReportRenderContext,
  prepareCoachPreview,
  prepareReportMaterialization,
  type PublicationRenderer,
} from './report-materialization';
import {
  buildHumanRenderIdentity,
  type HumanRenderIdentity,
  type StudentUserName,
} from '../render/human-identity';
import {
  renderDeterministicBilanPdf,
  type BilanPdfDependencies,
} from '../render/pdf';
import type { ReportAudience } from '../render/profile-copy';

type ReportDatabase = Pick<PrismaClient, '$transaction' | 'reportRevision'>;

export class BilanReportServiceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'BilanReportServiceError';
  }
}

type EvidenceAttemptRow = Readonly<{
  answers: unknown;
  assessmentPackId: string;
  assessmentPackVersion: string | number | bigint;
  assessmentPackChecksum: string | null;
}> | null | undefined;

/**
 * Détail des réponses pour la restitution : pack résolu en lecture seule,
 * rapproché des réponses de la tentative. Indisponible (pack non résolu,
 * champs absents) => restitution sans section détail, jamais un échec.
 * En revanche un pack résolu dont le checksum ne correspond plus à celui de
 * la passation est une incohérence grave : on refuse de rendre un détail
 * potentiellement différent de ce que l'élève a réellement composé.
 */
export function buildAttemptEvidence(
  attempt: EvidenceAttemptRow,
  resolvePack: PackResolver,
): QuestionEvidence | undefined {
  if (attempt === null || attempt === undefined) return undefined;
  if (typeof attempt.assessmentPackId !== 'string' || attempt.assessmentPackId.length === 0) return undefined;
  const resolved = resolvePack(attempt.assessmentPackId, Number(attempt.assessmentPackVersion));
  if (resolved === null) return undefined;
  if (typeof attempt.assessmentPackChecksum === 'string'
    && attempt.assessmentPackChecksum.length > 0
    && attempt.assessmentPackChecksum !== resolved.checksum) {
    throw new BilanReportServiceError('REPORT_EVIDENCE_PACK_MISMATCH');
  }
  return buildQuestionEvidence(resolved.pack, attempt.answers);
}

function requiredHumanRenderIdentity(user: StudentUserName): HumanRenderIdentity {
  try {
    return buildHumanRenderIdentity(user);
  } catch (error) {
    if (error instanceof Error && error.message === 'HUMAN_RENDER_IDENTITY_MISSING') {
      throw new BilanReportServiceError('REPORT_STUDENT_IDENTITY_REQUIRED');
    }
    throw error;
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
  // Centre de notifications assistante : un bilan prêt à revue est un
  // événement clé. Même transaction que la révision — jamais de notification
  // pour un bilan qui n'existe pas.
  const assistants = await transaction.user.findMany({
    where: { role: 'ASSISTANTE' },
    select: { id: true },
  });
  if (assistants.length > 0) {
    await transaction.notification.createMany({
      data: assistants.map(({ id }) => ({
        userId: id,
        userRole: 'ASSISTANTE' as const,
        type: 'BILAN_READY_FOR_REVIEW',
        title: 'Nouveau bilan prêt à revue',
        message: 'Un bilan de positionnement vient d’être généré et attend votre revue avant diffusion.',
        data: { revisionId: revision.id, artifactId: artifact.id },
      })),
    });
  }
  return Object.freeze({ artifact, revision });
}

type ReviewInput = Readonly<{
  prisma: ReportDatabase;
  revisionId: string;
  reviewerId: string;
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
        reviewerId: input.reviewerId,
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
      actor: 'ASSISTANTE',
    });
    return Object.freeze({ revisionId: revision.id, reviewId: review.id, status: 'COACH_VALIDATED' as const });
  });
}

/** Sections annotables d'un bilan — vocabulaire stable, jamais du texte libre. */
export const REPORT_ANNOTATION_SECTIONS = [
  'introduction',
  'methode',
  'forces',
  'priorites',
  'parcours',
  'plan-action',
  'detail-reponses',
  'calibration',
  'conclusion',
  'autre',
  'reprise-de-revue',
] as const;

export type ReportAnnotationSection = (typeof REPORT_ANNOTATION_SECTIONS)[number];

export type ReportReviewAnnotationInput = Readonly<{
  audience: 'ELEVE' | 'PARENTS' | 'NEXUS';
  section: ReportAnnotationSection;
  remark: string;
}>;

function assertAnnotations(
  annotations: readonly ReportReviewAnnotationInput[],
): readonly ReportReviewAnnotationInput[] {
  if (annotations.length === 0) throw new BilanReportServiceError('REPORT_ANNOTATION_REQUIRED');
  for (const annotation of annotations) {
    if (!REPORT_ANNOTATION_SECTIONS.includes(annotation.section)) {
      throw new BilanReportServiceError('REPORT_ANNOTATION_SECTION_UNKNOWN');
    }
    const remark = annotation.remark.trim();
    if (remark.length === 0 || remark.length > 4000) {
      throw new BilanReportServiceError('REPORT_ANNOTATION_REMARK_INVALID');
    }
  }
  return annotations;
}

/**
 * « Correction demandée » : état intermédiaire explicite, distinct du rejet
 * (qui ferme) et de l'attente de diffusion. La revue CHANGES_REQUESTED et ses
 * annotations sont créées dans la même transaction que le changement d'état,
 * exigé par le garde DB. L'attempt reste à REPORT_PENDING_REVIEW : la demande
 * de correction est une affaire de revue, pas de scoring — le snapshot de
 * score et les banques ne sont jamais touchés par ce chemin.
 */
export async function requestReportCorrection(input: ReviewInput & Readonly<{
  annotations: readonly ReportReviewAnnotationInput[];
}>) {
  const annotations = assertAnnotations(input.annotations);
  return input.prisma.$transaction(async (transaction) => {
    const revision = await pendingRevision(transaction, input.revisionId);
    const review = await transaction.reportReview.create({
      data: {
        reportRevisionId: revision.id,
        reviewerId: input.reviewerId,
        decision: 'CHANGES_REQUESTED',
        motif: assertMotif(input.motif),
        reviewedAt: input.reviewedAt,
        annotations: {
          create: annotations.map((annotation) => ({
            audience: annotation.audience,
            section: annotation.section,
            remark: annotation.remark.trim(),
          })),
        },
      },
    });
    const updated = await transaction.reportRevision.updateMany({
      where: { id: revision.id, status: 'PENDING_REVIEW' },
      data: { status: 'CORRECTION_REQUESTED' },
    });
    if (updated.count !== 1) throw new BilanReportServiceError('REPORT_CONCURRENT_REVIEW');
    return Object.freeze({ revisionId: revision.id, reviewId: review.id, status: 'CORRECTION_REQUESTED' as const });
  });
}

/**
 * Reprise de revue après correction : le bilan revient dans la file avec tout
 * son historique d'annotations. La reprise est elle-même tracée, comme
 * annotation interne (audience NEXUS) de la revue qui avait demandé la
 * correction — l'historique ne s'écrase jamais, il s'allonge.
 */
export async function resumeReportReview(input: ReviewInput) {
  return input.prisma.$transaction(async (transaction) => {
    const revision = await transaction.reportRevision.findUnique({
      where: { id: input.revisionId },
      select: {
        id: true,
        status: true,
        reviews: {
          where: { decision: 'CHANGES_REQUESTED' },
          orderBy: { reviewedAt: 'desc' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (revision === null || revision.status !== 'CORRECTION_REQUESTED') {
      throw new BilanReportServiceError('REPORT_NOT_CORRECTION_REQUESTED');
    }
    const triggeringReview = revision.reviews[0];
    if (triggeringReview === undefined) throw new BilanReportServiceError('REPORT_CORRECTION_REVIEW_MISSING');
    await transaction.reportReviewAnnotation.create({
      data: {
        reportReviewId: triggeringReview.id,
        audience: 'NEXUS',
        section: 'reprise-de-revue',
        remark: assertMotif(input.motif),
      },
    });
    const updated = await transaction.reportRevision.updateMany({
      where: { id: revision.id, status: 'CORRECTION_REQUESTED' },
      data: { status: 'PENDING_REVIEW' },
    });
    if (updated.count !== 1) throw new BilanReportServiceError('REPORT_CONCURRENT_REVIEW');
    return Object.freeze({ revisionId: revision.id, status: 'PENDING_REVIEW' as const });
  });
}

export async function rejectReportRevision(input: ReviewInput) {
  return input.prisma.$transaction(async (transaction) => {
    const revision = await pendingRevision(transaction, input.revisionId);
    const review = await transaction.reportReview.create({
      data: {
        reportRevisionId: revision.id,
        reviewerId: input.reviewerId,
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
      actor: 'ASSISTANTE',
    });
    return Object.freeze({ revisionId: revision.id, reviewId: review.id, status: 'COACH_REJECTED' as const });
  });
}

export async function publishReportRevision(input: Readonly<{
  prisma: ReportDatabase;
  revisionId: string;
  reviewerId: string;
  publishedAt: Date;
  renderAudience?: PublicationRenderer;
  resolvePack?: PackResolver;
}>) {
  const candidate = await input.prisma.reportRevision.findUnique({
    where: { id: input.revisionId },
    select: {
      id: true,
      status: true,
      validationFailures: true,
      generation: true,
      content: true,
      materialization: { select: { id: true } },
      scoreSnapshot: { select: { result: true } },
      reviews: {
        where: { decision: 'APPROVED' },
        select: { id: true },
        take: 1,
      },
      reportArtifact: {
        select: {
          id: true,
          status: true,
          assessmentAttemptId: true,
          assessmentAttempt: {
            select: {
              status: true,
              answers: true,
              assessmentPackId: true,
              assessmentPackVersion: true,
              assessmentPackChecksum: true,
            },
          },
          student: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
  if (candidate === null || candidate.status !== 'COACH_VALIDATED') {
    throw new BilanReportServiceError('REPORT_NOT_COACH_VALIDATED');
  }
  if (candidate.validationFailures.length > 0) {
    throw new BilanReportServiceError('REPORT_VALIDATION_FAILURES');
  }
  if (candidate.materialization !== null) throw new BilanReportServiceError('REPORT_ALREADY_MATERIALIZED');
  // Re-publication d'une régénération : l'artefact est resté PUBLISHED
  // pendant la re-revue (même règle que dans la transaction finale).
  if (
    (candidate.reportArtifact.status !== 'PENDING_REVIEW'
      && !(candidate.generation > 1 && candidate.reportArtifact.status === 'PUBLISHED'))
    || candidate.reportArtifact.assessmentAttempt.status !== 'COACH_VALIDATED'
  ) throw new BilanReportServiceError('REPORT_CONCURRENT_PUBLICATION');
  if (candidate.reviews.length !== 1) throw new BilanReportServiceError('REPORT_APPROVED_REVIEW_REQUIRED');

  // Chromium and all other rendering happen before opening the final, short transaction.
  const prepared = await prepareReportMaterialization(
    parseReportRenderContext(
      candidate.scoreSnapshot.result,
      candidate.content,
      requiredHumanRenderIdentity(candidate.reportArtifact.student.user),
      buildAttemptEvidence(candidate.reportArtifact.assessmentAttempt, input.resolvePack ?? resolveEnabledPack),
    ),
    input.renderAudience,
  );

  return input.prisma.$transaction(async (transaction) => {
    const revision = await transaction.reportRevision.findUnique({
      where: { id: input.revisionId },
      select: {
        id: true,
        status: true,
        generation: true,
        validationFailures: true,
        materialization: { select: { id: true } },
        reportArtifact: {
          select: {
            id: true,
            assessmentAttemptId: true,
            status: true,
            assessmentAttempt: { select: { status: true } },
          },
        },
      },
    });
    if (revision === null || revision.status !== 'COACH_VALIDATED') {
      throw new BilanReportServiceError('REPORT_NOT_COACH_VALIDATED');
    }
    if (revision.validationFailures.length > 0) {
      throw new BilanReportServiceError('REPORT_VALIDATION_FAILURES');
    }
    if (revision.materialization !== null) throw new BilanReportServiceError('REPORT_ALREADY_MATERIALIZED');
    // Régénération (génération > 1) : l'artefact est resté PUBLISHED pendant
    // la re-revue — la famille conservait l'ancienne version. La
    // re-publication bascule currentPublishedRevisionId ; tout le reste du
    // chemin (revue APPROVED tracée, matérialisation, attempt COACH_VALIDATED)
    // est identique à une première publication.
    const isRepublication = revision.generation > 1
      && revision.reportArtifact.status === 'PUBLISHED';
    if (
      (revision.reportArtifact.status !== 'PENDING_REVIEW' && !isRepublication)
      || revision.reportArtifact.assessmentAttempt.status !== 'COACH_VALIDATED'
    ) throw new BilanReportServiceError('REPORT_CONCURRENT_PUBLICATION');
    const approvedReview = await transaction.reportReview.findFirst({
      where: { reportRevisionId: revision.id, decision: 'APPROVED' },
      select: { id: true },
    });
    if (approvedReview === null) throw new BilanReportServiceError('REPORT_APPROVED_REVIEW_REQUIRED');
    const materialization = await transaction.reportMaterialization.create({
      data: {
        revisionId: revision.id,
        brandVersion: prepared.brandVersion,
        globalChecksum: prepared.globalChecksum,
        materializedAt: input.publishedAt,
        audienceArtifacts: {
          create: prepared.audiences.map((audience) => ({
            audience: audience.audience,
            html: audience.html,
            pdf: audience.pdf === null ? null : Uint8Array.from(audience.pdf),
            pdfStatus: audience.pdfStatus,
            checksum: audience.checksum,
          })),
        },
      },
    });
    const artifact = await transaction.reportArtifact.updateMany({
      where: isRepublication
        ? { id: revision.reportArtifact.id, status: 'PUBLISHED' }
        : { id: revision.reportArtifact.id, status: 'PENDING_REVIEW', currentPublishedRevisionId: null },
      data: {
        status: 'PUBLISHED',
        currentPublishedRevisionId: revision.id,
        publishedAt: input.publishedAt,
      },
    });
    if (artifact.count !== 1) throw new BilanReportServiceError('REPORT_CONCURRENT_PUBLICATION');
    await advanceAttemptLifecycle(transaction, {
      attemptId: revision.reportArtifact.assessmentAttemptId,
      from: 'COACH_VALIDATED',
      action: 'PUBLISH_REPORT',
      actor: 'ASSISTANTE',
    });
    return Object.freeze({
      revisionId: revision.id,
      artifactId: revision.reportArtifact.id,
      materializationId: materialization.id,
      status: 'PUBLISHED' as const,
    });
  });
}

export async function previewReportRevision(input: Readonly<{
  prisma: Pick<PrismaClient, 'reportRevision'>;
  revisionId: string;
  resolvePack?: PackResolver;
}>) {
  const revision = await input.prisma.reportRevision.findUnique({
    where: { id: input.revisionId },
    select: {
      status: true,
      validationFailures: true,
      content: true,
      scoreSnapshot: { select: { result: true } },
      reportArtifact: {
        select: {
          assessmentAttempt: {
            select: {
              answers: true,
              assessmentPackId: true,
              assessmentPackVersion: true,
              assessmentPackChecksum: true,
            },
          },
          student: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
  if (
    revision === null
    || !['PENDING_REVIEW', 'COACH_VALIDATED'].includes(revision.status)
    || revision.validationFailures.length > 0
  ) throw new BilanReportServiceError('REPORT_PREVIEW_UNAVAILABLE');
  return prepareCoachPreview(parseReportRenderContext(
    revision.scoreSnapshot.result,
    revision.content,
    requiredHumanRenderIdentity(revision.reportArtifact.student.user),
    buildAttemptEvidence(revision.reportArtifact.assessmentAttempt, input.resolvePack ?? resolveEnabledPack),
  ));
}

export async function renderReportRevisionAudiencePdf(input: Readonly<{
  prisma: Pick<PrismaClient, 'reportRevision'>;
  revisionId: string;
  audience: ReportAudience;
  resolvePack?: PackResolver;
  renderAudience?: (
    factSheet: Parameters<typeof renderDeterministicBilanPdf>[0],
    audience: ReportAudience,
    identity: Parameters<typeof renderDeterministicBilanPdf>[2],
    dependencies: BilanPdfDependencies,
  ) => ReturnType<typeof renderDeterministicBilanPdf>;
}>) {
  const revision = await input.prisma.reportRevision.findUnique({
    where: { id: input.revisionId },
    select: {
      status: true,
      validationFailures: true,
      content: true,
      scoreSnapshot: { select: { result: true } },
      reportArtifact: {
        select: {
          assessmentAttempt: {
            select: {
              answers: true,
              assessmentPackId: true,
              assessmentPackVersion: true,
              assessmentPackChecksum: true,
            },
          },
          student: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
  if (
    revision === null
    || !['PENDING_REVIEW', 'COACH_VALIDATED'].includes(revision.status)
    || revision.validationFailures.length > 0
  ) throw new BilanReportServiceError('REPORT_PREVIEW_UNAVAILABLE');

  const context = parseReportRenderContext(
    revision.scoreSnapshot.result,
    revision.content,
    requiredHumanRenderIdentity(revision.reportArtifact.student.user),
    buildAttemptEvidence(revision.reportArtifact.assessmentAttempt, input.resolvePack ?? resolveEnabledPack),
  );
  const rendered = await (input.renderAudience ?? renderDeterministicBilanPdf)(
    context.factSheet,
    input.audience,
    context.identity,
    { humanIdentity: context.humanIdentity, evidence: context.evidence },
  );
  if (rendered.status !== 'AVAILABLE') {
    throw new BilanReportServiceError('REPORT_PDF_UNAVAILABLE');
  }
  return Buffer.from(rendered.pdf);
}
