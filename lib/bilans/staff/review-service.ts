import { ReportRevisionStatus, type PrismaClient, type UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import { bilanPackSubjectLabel } from '../catalog/subjects';
import {
  BilanReportServiceError,
  previewReportRevision,
  publishReportRevision,
  rejectReportRevision,
  renderReportRevisionAudiencePdf,
  requestReportCorrection,
  resumeReportReview,
  validateReportRevision,
  type ReportReviewAnnotationInput,
} from '../core/report-service';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';

import { buildHumanRenderIdentity } from '../render/human-identity';
import { buildParentReportAvailableEmail } from './parent-notification';
import type { ReportAudience } from '../render/profile-copy';
import { bilanPackLevelLabel } from '../render/stage-label';

export type PendingReportReview = Readonly<{
  id: string;
  status: string;
  generation: number;
  validationFailures: readonly string[];
  reportPackId: string;
  reportPackVersion: string;
  createdAt: Date;
  reportArtifact: Readonly<{
    id: string;
    assessmentAttemptId: string;
    studentId: string;
    status: string;
    assessmentAttempt: Readonly<{ provenance: string }>;
    student: Readonly<{
      user: Readonly<{ firstName: string | null; lastName: string | null }>;
      parent: Readonly<{ user: Readonly<{
        id: string;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        phoneNormalized: string | null;
      }> }>;
    }>;
    transmissions: readonly Readonly<{ channel: string; confirmedAt: Date }>[];
  }>;
  reviews: readonly Readonly<{
    id: string;
    decision: string;
    motif: string;
    reviewedAt: Date;
    reviewer: Readonly<{ firstName: string | null; lastName: string | null }> | null;
    annotations: readonly Readonly<{
      audience: string;
      section: string;
      remark: string;
      createdAt: Date;
    }>[];
  }>[];
}>;

export type RecentReportReview = PendingReportReview & Readonly<{
  studentName: string;
  packLabel: string;
  displayStatus: 'Prêt — contact parent manquant' | 'En attente de diffusion' | 'Correction demandée' | 'Diffusé' | 'Transmis au parent' | 'Rejeté';
  actionable: boolean;
  parentEmailMissing: boolean;
  parentPhoneMissing: boolean;
  parentContactMissing: boolean;
  diffusable: boolean;
  /** Envoi WhatsApp possible : diffusé, téléphone présent, pas encore transmis. */
  whatsappReady: boolean;
  transmittedAt: Date | null;
  correctionRequested: boolean;
}>;

type ReviewActor = Readonly<{ userId: string; role: UserRole | string }>;
type ReviewAction = ReviewActor & Readonly<{ revisionId: string; motif: string }>;

const revisionSelection = {
  id: true,
  status: true,
  generation: true,
  validationFailures: true,
  reportPackId: true,
  reportPackVersion: true,
  createdAt: true,
  reportArtifact: {
    select: {
      id: true,
      assessmentAttemptId: true,
      studentId: true,
      status: true,
      assessmentAttempt: { select: { provenance: true } },
      student: {
        select: {
          user: { select: { firstName: true, lastName: true } },
          parent: {
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  phoneNormalized: true,
                },
              },
            },
          },
        },
      },
      transmissions: {
        select: { channel: true, confirmedAt: true },
        orderBy: { confirmedAt: 'desc' as const },
        take: 1,
      },
    },
  },
  reviews: {
    select: {
      id: true,
      decision: true,
      motif: true,
      reviewedAt: true,
      reviewer: { select: { firstName: true, lastName: true } },
      annotations: {
        select: { audience: true, section: true, remark: true, createdAt: true },
        orderBy: { createdAt: 'asc' as const },
      },
    },
    orderBy: { reviewedAt: 'desc' as const },
  },
} as const;

type ReviewServiceDependencies = Readonly<{
  listPending(): Promise<readonly PendingReportReview[]>;
  listRecent(): Promise<readonly PendingReportReview[]>;
  findPending(revisionId: string): Promise<PendingReportReview | null>;
  resolvePack: PackResolver;
  validate(input: Readonly<{ revisionId: string; reviewerId: string; motif: string; reviewedAt: Date }>): Promise<unknown>;
  publish(input: Readonly<{ revisionId: string; reviewerId: string; publishedAt: Date }>): Promise<unknown>;
  preview(input: Readonly<{ revisionId: string }>): Promise<unknown>;
  renderPdf(input: Readonly<{ revisionId: string; audience: ReportAudience }>): Promise<Buffer>;
  reject(input: Readonly<{ revisionId: string; reviewerId: string; motif: string; reviewedAt: Date }>): Promise<unknown>;
  requestCorrection(input: Readonly<{
    revisionId: string; reviewerId: string; motif: string; reviewedAt: Date;
    annotations: readonly ReportReviewAnnotationInput[];
  }>): Promise<unknown>;
  resumeReview(input: Readonly<{ revisionId: string; reviewerId: string; motif: string; reviewedAt: Date }>): Promise<unknown>;
  findCorrectionRequested(revisionId: string): Promise<PendingReportReview | null>;
  notifyParentPublished(revision: PendingReportReview): Promise<void>;
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
  listRecent: () => prisma.reportRevision.findMany({
    where: {
      OR: [
        { status: { in: [
          ReportRevisionStatus.PENDING_REVIEW,
          ReportRevisionStatus.CORRECTION_REQUESTED,
          ReportRevisionStatus.COACH_VALIDATED,
          ReportRevisionStatus.REJECTED,
        ] } },
        { reportArtifact: { status: 'PUBLISHED' } },
      ],
    },
    select: revisionSelection,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 60,
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
  requestCorrection: (input) => requestReportCorrection({ prisma, ...input }),
  resumeReview: (input) => resumeReportReview({ prisma, ...input }),
  findCorrectionRequested: (revisionId) => prisma.reportRevision.findFirst({
    where: { id: revisionId, status: ReportRevisionStatus.CORRECTION_REQUESTED },
    select: revisionSelection,
  }),
  notifyParentPublished: async (revision) => {
    const parentUser = revision.reportArtifact.student.parent?.user;
    const parentEmail = parentUser?.email?.trim();
    const studentFirstName = revision.reportArtifact.student.user.firstName?.trim();
    if (!parentUser || !parentEmail || !studentFirstName) return;
    const origin = (process.env.NEXTAUTH_URL ?? 'https://nexusreussite.academy').replace(/\/$/, '');
    const parentDisplayName = buildHumanRenderIdentity({
      firstName: parentUser.firstName,
      lastName: parentUser.lastName,
    }).displayName;
    const resolved = resolveEnabledPack(revision.reportPackId, Number(revision.reportPackVersion));
    const message = buildParentReportAvailableEmail({
      parentDisplayName,
      studentFirstName: buildHumanRenderIdentity({ firstName: studentFirstName, lastName: null }).displayName,
      subjectLabel: resolved === null ? 'la matière évaluée' : bilanPackSubjectLabel(resolved.pack.subject),
      dashboardUrl: `${origin}/dashboard/parent`,
    });
    await prisma.$transaction(async (transaction) => {
      await enqueueEmailIntent(transaction, {
        aggregateId: parentUser.id,
        messageType: 'TRANSACTIONAL_NOTIFICATION',
        dedupeKey: `bilan-published:${revision.reportArtifact.id}`,
        to: parentEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    });
    kickEmailOutboxDrain();
  },
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

const MISSING_STUDENT_IDENTITY_MESSAGE = 'Identité élève incomplète : prénom ou nom requis avant rendu.';

function studentName(revision: PendingReportReview): string | null {
  try {
    return buildHumanRenderIdentity(revision.reportArtifact.student.user).displayName;
  } catch (error) {
    if (error instanceof Error && error.message === 'HUMAN_RENDER_IDENTITY_MISSING') return null;
    throw error;
  }
}

function assertStudentIdentity(revision: PendingReportReview): void {
  if (studentName(revision) === null) {
    throw new StaffReviewError('REPORT_STUDENT_IDENTITY_REQUIRED');
  }
}

/** Point d'extension : un autre canal d'activation pourra satisfaire ce
 * prédicat sans modifier le state machine du bilan. Seul l'e-mail existe ici. */
/**
 * Un canal de contact suffit pour diffuser : téléphone (voie WhatsApp, #124)
 * OU e-mail. Exiger l'e-mail annulait exprès deux décisions d'architecture —
 * la saisie papier sans e-mail (#116) et l'envoi WhatsApp sans compte (#124) :
 * un foyer au téléphone seul restait bloqué à jamais (contradiction constatée
 * le 13/08/2026). Sans AUCUN canal, la diffusion reste bloquée — ce garde-là
 * est légitime.
 */
export function hasAvailableParentContact(revision: PendingReportReview): boolean {
  const parentUser = revision.reportArtifact.student.parent?.user;
  return Boolean(parentUser?.email?.trim()) || Boolean(parentUser?.phoneNormalized?.trim());
}

/**
 * Pourquoi « Valider et diffuser aux familles » est inactif — en toutes
 * lettres. Un bouton désactivé sans explication est un bug d'UX, pas une
 * sécurité : l'assistante doit savoir exactement quel prérequis manque
 * (défaut constaté le 13/08/2026 sur un bilan au parent sans e-mail).
 * Renvoie une liste vide quand la diffusion est possible.
 */
export function diffusionBlockedReasons(review: RecentReportReview): readonly string[] {
  if (review.diffusable && review.validationFailures.length === 0) return Object.freeze([]);
  const reasons: string[] = [];
  if (review.validationFailures.length > 0) {
    reasons.push('Corrigez d’abord les points bloquants signalés en haut de la carte.');
  }
  if (review.parentContactMissing) {
    reasons.push('Renseignez un contact parent — téléphone ou e-mail (encadré « Compléter le contact parent » ci-dessus) : aucun bilan ne part sans canal vers la famille.');
  }
  if (!review.actionable && review.validationFailures.length === 0) {
    reasons.push('Ce bilan n’est plus en attente de diffusion (déjà diffusé, rejeté ou en correction).');
  }
  return Object.freeze(reasons);
}

function latestWhatsAppTransmission(revision: PendingReportReview): Date | null {
  const transmission = revision.reportArtifact.transmissions
    .find(({ channel }) => channel === 'WHATSAPP');
  return transmission?.confirmedAt ?? null;
}

function displayStatus(revision: PendingReportReview): RecentReportReview['displayStatus'] {
  if (revision.status === ReportRevisionStatus.REJECTED) return 'Rejeté';
  if (revision.status === ReportRevisionStatus.CORRECTION_REQUESTED) return 'Correction demandée';
  if (revision.reportArtifact.status === 'PUBLISHED') {
    return latestWhatsAppTransmission(revision) !== null ? 'Transmis au parent' : 'Diffusé';
  }
  if (!hasAvailableParentContact(revision)) return 'Prêt — contact parent manquant';
  return 'En attente de diffusion';
}

function recentReview(
  revision: PendingReportReview,
  dependencies: ReviewServiceDependencies,
): RecentReportReview {
  const resolved = dependencies.resolvePack(revision.reportPackId, versionOf(revision));
  const resolvedStudentName = studentName(revision);
  const validationFailures = resolvedStudentName === null
    ? Object.freeze([...revision.validationFailures, MISSING_STUDENT_IDENTITY_MESSAGE])
    : revision.validationFailures;
  const actionable = resolved !== null
    && resolvedStudentName !== null
    && (
      revision.status === ReportRevisionStatus.PENDING_REVIEW
      || revision.status === ReportRevisionStatus.COACH_VALIDATED
    )
    && revision.reportArtifact.status === 'PENDING_REVIEW';
  const parentEmailMissing = !revision.reportArtifact.student.parent?.user.email?.trim();
  const parentPhoneMissing = !revision.reportArtifact.student.parent?.user.phoneNormalized?.trim();
  const parentContactMissing = !hasAvailableParentContact(revision);
  const transmittedAt = latestWhatsAppTransmission(revision);
  return Object.freeze({
    ...revision,
    validationFailures,
    studentName: resolvedStudentName ?? 'Identité élève à compléter',
    packLabel: resolved === null
      ? `${revision.reportPackId} · v${revision.reportPackVersion}`
      : `${bilanPackLevelLabel(resolved.pack.level)} · ${bilanPackSubjectLabel(resolved.pack.subject)}`,
    displayStatus: displayStatus(revision),
    actionable,
    parentEmailMissing,
    parentPhoneMissing,
    parentContactMissing,
    diffusable: actionable && !parentContactMissing,
    whatsappReady: revision.reportArtifact.status === 'PUBLISHED'
      && !parentPhoneMissing
      && transmittedAt === null,
    transmittedAt,
    correctionRequested: revision.status === ReportRevisionStatus.CORRECTION_REQUESTED,
  });
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

/**
 * Une régénération crée une nouvelle génération À CÔTÉ de l'ancienne
 * (append-only : rien n'est supprimé). Sur le tableau de bord, l'assistante
 * ne doit voir qu'UNE ligne par bilan — la génération courante. Les
 * générations remplacées (rejetées à la régénération, ou anciennes versions
 * publiées) sont masquées : ni encombrement, ni confusion, aucun sélecteur.
 * La trace de régénération, elle, subsiste en base (audit sur requête).
 *
 * « Génération courante » = la génération maximale pour un même artefact.
 * Un bilan simplement rejeté (jamais régénéré) reste visible : sa génération
 * est la seule, donc la maximale.
 */
function onlyCurrentGeneration(
  revisions: readonly PendingReportReview[],
): readonly PendingReportReview[] {
  const maxGenByArtifact = new Map<string, number>();
  for (const revision of revisions) {
    const artifactId = revision.reportArtifact.id;
    const current = maxGenByArtifact.get(artifactId);
    if (current === undefined || revision.generation > current) {
      maxGenByArtifact.set(artifactId, revision.generation);
    }
  }
  return revisions.filter(
    (revision) => revision.generation === maxGenByArtifact.get(revision.reportArtifact.id),
  );
}

export async function listRecentReportReviews(
  actor: ReviewActor,
  overrides: Partial<ReviewServiceDependencies> = {},
): Promise<readonly RecentReportReview[]> {
  const dependencies = { ...defaultDependencies, ...overrides };
  assertAssistante(actor);
  const recent = await dependencies.listRecent();
  return Object.freeze(
    onlyCurrentGeneration(recent).map((revision) => recentReview(revision, dependencies)),
  );
}

export type ScoringFailure = Readonly<{
  attemptId: string;
  studentName: string;
  provenance: string;
  submittedAt: Date | null;
  attempts: number;
  quarantined: boolean;
  lastError: string | null;
}>;

/**
 * Les élèves restés SANS bilan parce que leur passation ne se score pas : une
 * passation SOUMISE dont le job de scoring est en échec (et non un bilan déjà
 * produit). Sans cette liste, un échec de scoring disparaît silencieusement —
 * personne ne sait qu'un élève attend son bilan (défaut du 13/08/2026, copie
 * « Sans réponse » rejetée par le worker). L'assistante voit l'état explicite
 * « scoring impossible — à reprendre » et peut agir (re-saisir la copie).
 */
export async function listScoringFailures(
  actor: ReviewActor,
  overrides: Readonly<{ prisma?: Pick<PrismaClient, 'jobOutbox'>; maxAttempts?: number }> = {},
): Promise<readonly ScoringFailure[]> {
  assertAssistante(actor);
  const database = overrides.prisma ?? prisma;
  const maxAttempts = overrides.maxAttempts ?? 20;
  const jobs = await database.jobOutbox.findMany({
    where: { jobType: 'SCORE_ATTEMPT', status: 'FAILED', attemptCount: { gt: 0 } },
    select: { aggregateId: true, attemptCount: true, lastError: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  if (jobs.length === 0) return Object.freeze([]);
  const attemptIds = jobs.map((job) => job.aggregateId);
  const attempts = await prisma.canonicalAssessmentAttempt.findMany({
    where: { id: { in: attemptIds }, status: 'SUBMITTED' },
    select: {
      id: true, provenance: true, submittedAt: true,
      student: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  });
  const byId = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const failures: ScoringFailure[] = [];
  for (const job of jobs as ReadonlyArray<{ aggregateId: string; attemptCount: number; lastError: string | null }>) {
    const attempt = byId.get(job.aggregateId);
    if (attempt === undefined) continue; // job d'une passation déjà scorée ou disparue
    failures.push(Object.freeze({
      attemptId: attempt.id,
      studentName: buildHumanRenderIdentity({
        firstName: attempt.student.user.firstName,
        lastName: attempt.student.user.lastName,
      }).displayName,
      provenance: attempt.provenance,
      submittedAt: attempt.submittedAt,
      attempts: job.attemptCount,
      quarantined: job.attemptCount >= maxAttempts,
      lastError: job.lastError,
    }));
  }
  return Object.freeze(failures);
}

export async function validateAndPublishPendingReport(
  action: ReviewAction,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const { revision, reviewerId, motif } = await pendingReview(action, dependencies);
  assertStudentIdentity(revision);
  if (!hasAvailableParentContact(revision)) throw new StaffReviewError('REPORT_PARENT_EMAIL_REQUIRED');
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
  const published = await dependencies.publish({ revisionId: revision.id, reviewerId, publishedAt: reviewedAt });
  // La notification parent est un confort, jamais une condition : une
  // publication réussie ne se défait pas parce qu'un e-mail a échoué.
  try {
    await dependencies.notifyParentPublished(revision);
  } catch (error) {
    console.error(
      'BILAN_PARENT_PUBLISH_NOTIFICATION_FAILED',
      revision.id,
      error instanceof Error ? error.name : 'UNKNOWN',
    );
  }
  return published;
}

export async function previewPendingReport(
  action: ReviewActor & Readonly<{ revisionId: string }>,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  assertAssistante(action);
  const revision = await dependencies.findPending(action.revisionId);
  if (revision === null || !packIsEnabled(revision, dependencies)) throw new StaffReviewError('NOT_FOUND');
  assertStudentIdentity(revision);
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
  assertStudentIdentity(revision);
  if (revision.validationFailures.length > 0) throw new StaffReviewError('REPORT_VALIDATION_FAILURES');
  let pdf: Buffer;
  try {
    pdf = await dependencies.renderPdf({ revisionId: revision.id, audience: action.audience });
  } catch (error) {
    if (error instanceof BilanReportServiceError) {
      throw new StaffReviewError(
        ['REPORT_PDF_UNAVAILABLE', 'REPORT_STUDENT_IDENTITY_REQUIRED'].includes(error.code)
          ? error.code
          : 'NOT_FOUND',
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

/**
 * « Demander une correction » : l'assistante cible une audience et une
 * section, écrit sa remarque, et le bilan passe en « Correction demandée » —
 * état distinct du rejet, visible dans la file avec son annotation. Aucune
 * donnée de mesure n'est touchée : revue et annotations sont des métadonnées.
 */
export async function requestCorrectionForPendingReport(
  action: ReviewAction & Readonly<{ annotations: readonly ReportReviewAnnotationInput[] }>,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const { revision, reviewerId, motif } = await pendingReview(action, dependencies);
  if (revision.status !== 'PENDING_REVIEW') throw new StaffReviewError('REPORT_ALREADY_VALIDATED');
  return dependencies.requestCorrection({
    revisionId: revision.id,
    reviewerId,
    motif,
    reviewedAt: dependencies.now(),
    annotations: action.annotations,
  });
}

/**
 * Reprise de revue une fois la correction apportée : le bilan revient en
 * « À revoir », l'historique d'annotations intact et visible.
 */
export async function resumeCorrectedReport(
  action: ReviewAction,
  overrides: Partial<ReviewServiceDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const reviewerId = assertAssistante(action);
  const revision = await dependencies.findCorrectionRequested(action.revisionId);
  if (revision === null || !packIsEnabled(revision, dependencies)) throw new StaffReviewError('NOT_FOUND');
  const motif = action.motif.trim();
  if (!motif) throw new StaffReviewError('REPORT_REVIEW_MOTIF_REQUIRED');
  return dependencies.resumeReview({
    revisionId: revision.id,
    reviewerId,
    motif,
    reviewedAt: dependencies.now(),
  });
}
