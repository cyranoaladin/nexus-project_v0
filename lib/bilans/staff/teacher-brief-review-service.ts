import type { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import type { FactSheet } from '../facts/fact-sheet';
import {
  assertBriefRespectsFacts,
  buildStudentFactsPayload,
  TeacherBriefError,
} from '../llm/teacher-brief-service';
import { teacherBriefSchema, type TeacherBriefContent } from '../llm/teacher-brief-schema';

/**
 * Relecture obligatoire du brief enseignant.
 *
 * Aucun contenu généré n'atteint un enseignant sans validation explicite :
 * l'état PENDING_REVIEW est distinct de tout état utilisable ; seul un
 * brief APPROVED — ET rattaché au scoreSnapshot COURANT du bilan (§5 de
 * l'incident P0) — est montré comme prêt. La relectrice peut approuver
 * (éventuellement avec une correction STRUCTURÉE — jamais un texte libre
 * re-parsé, voir §6), ou annoter et renvoyer en correction ; la
 * régénération crée une nouvelle version, l'historique reste intact
 * (append-only).
 */

export class TeacherBriefReviewError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'TeacherBriefReviewError';
  }
}

/** Motifs structurés (§13) : un choix standard alimente `reviewMotif`, un commentaire libre reste possible en complément. */
export const REVIEW_MOTIF_CODES = Object.freeze([
  'VALIDATION_PEDAGOGIQUE',
  'VALIDATION_APRES_CORRECTION_MANUELLE',
  'CORRECTION_FACTUELLE',
  'CORRECTION_DIDACTIQUE',
  'CORRECTION_FORMULATION',
  'AUTRE',
] as const);
export type ReviewMotifCode = (typeof REVIEW_MOTIF_CODES)[number];

const REVIEW_MOTIF_LABELS: Readonly<Record<ReviewMotifCode, string>> = Object.freeze({
  VALIDATION_PEDAGOGIQUE: 'Validation pédagogique',
  VALIDATION_APRES_CORRECTION_MANUELLE: 'Validation après correction manuelle',
  CORRECTION_FACTUELLE: 'Correction factuelle',
  CORRECTION_DIDACTIQUE: 'Correction didactique',
  CORRECTION_FORMULATION: 'Correction de formulation',
  AUTRE: 'Autre',
});

export function buildReviewMotif(code: ReviewMotifCode, freeComment: string): string {
  const comment = freeComment.trim();
  const label = REVIEW_MOTIF_LABELS[code];
  return comment.length === 0 ? label : `${label} — ${comment}`;
}

type ReviewDatabase = Pick<PrismaClient, '$transaction' | 'teacherBrief' | 'teacherBriefAnnotation' | 'reportArtifact'>;

type Actor = Readonly<{ userId: string; role: string }>;

function assertAssistante(actor: Actor): string {
  if (actor.role !== 'ASSISTANTE' || !actor.userId.trim()) throw new TeacherBriefReviewError('NOT_FOUND');
  return actor.userId;
}

function assertMotif(motif: string): string {
  const value = motif.trim();
  if (!value) throw new TeacherBriefReviewError('BRIEF_REVIEW_MOTIF_REQUIRED');
  return value;
}

/**
 * Reconstruit les faits pédagogiques du bilan pour le ré-ancrage
 * (`assertBriefRespectsFacts`) d'une correction manuelle structurée — mêmes
 * données que celles envoyées au modèle à la génération, jamais réinventées.
 */
async function loadFactsForReanchoring(
  transaction: Pick<PrismaClient, 'reportArtifact'>,
  reportArtifactId: string,
  resolvePack: PackResolver,
): Promise<ReturnType<typeof buildStudentFactsPayload>> {
  const artifact = await transaction.reportArtifact.findUnique({
    where: { id: reportArtifactId },
    select: {
      assessmentAttempt: {
        select: { subject: true, answers: true, assessmentPackId: true, assessmentPackVersion: true },
      },
      revisions: {
        orderBy: { createdAt: 'desc' as const }, take: 1,
        select: { scoreSnapshot: { select: { result: true } } },
      },
    },
  });
  if (artifact === null || artifact.revisions.length === 0) throw new TeacherBriefReviewError('BRIEF_ARTIFACT_NOT_FOUND');
  const resolved = resolvePack(artifact.assessmentAttempt.assessmentPackId, Number(artifact.assessmentAttempt.assessmentPackVersion));
  if (resolved === null) throw new TeacherBriefReviewError('BRIEF_PACK_UNAVAILABLE');
  const factSheet = artifact.revisions[0].scoreSnapshot.result as unknown as FactSheet;
  return buildStudentFactsPayload(factSheet, resolved.pack, artifact.assessmentAttempt.answers, artifact.assessmentAttempt.subject);
}

export async function approveTeacherBrief(input: Readonly<{
  prisma?: ReviewDatabase;
  actor: Actor;
  briefId: string;
  motifCode: ReviewMotifCode;
  freeComment?: string;
  /**
   * Correction manuelle STRUCTURÉE — même schéma que le contenu généré,
   * jamais un texte libre. `undefined` = "Valider sans modification".
   */
  approvedContent?: unknown;
  resolvePack?: PackResolver;
  now?: () => Date;
}>) {
  const database = input.prisma ?? prisma;
  const reviewerId = assertAssistante(input.actor);
  const motif = assertMotif(buildReviewMotif(input.motifCode, input.freeComment ?? ''));
  const now = (input.now ?? (() => new Date()))();
  const resolvePack = input.resolvePack ?? resolveEnabledPack;

  let approvedContent: TeacherBriefContent | undefined;
  if (input.approvedContent !== undefined) {
    const parsed = teacherBriefSchema.safeParse(input.approvedContent);
    if (!parsed.success) throw new TeacherBriefReviewError('BRIEF_APPROVED_CONTENT_INVALID_SCHEMA');
    approvedContent = parsed.data;
  }

  return database.$transaction(async (transaction) => {
    const brief = await transaction.teacherBrief.findUnique({
      where: { id: input.briefId },
      select: { id: true, status: true, reportArtifactId: true, scoreSnapshotId: true },
    });
    if (brief === null || brief.status !== 'PENDING_REVIEW') {
      throw new TeacherBriefReviewError('BRIEF_NOT_PENDING_REVIEW');
    }

    // Concurrence optimiste (§5) : le bilan a pu être régénéré (nouveau
    // scoreSnapshot courant) entre l'ouverture de la relecture et ce clic.
    // Un brief qui n'est plus rattaché au snapshot courant ne doit jamais
    // être approuvé.
    const artifact = await transaction.reportArtifact.findUnique({
      where: { id: brief.reportArtifactId },
      select: { revisions: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { scoreSnapshotId: true } } },
    });
    const currentSnapshotId = artifact?.revisions[0]?.scoreSnapshotId;
    if (currentSnapshotId === undefined || currentSnapshotId !== brief.scoreSnapshotId) {
      throw new TeacherBriefReviewError('BRIEF_STALE_SNAPSHOT');
    }

    if (approvedContent !== undefined) {
      try {
        const facts = await loadFactsForReanchoring(transaction, brief.reportArtifactId, resolvePack);
        assertBriefRespectsFacts(approvedContent, facts);
      } catch (error) {
        if (error instanceof TeacherBriefError) throw new TeacherBriefReviewError(`BRIEF_APPROVED_CONTENT_${error.code}`);
        throw error;
      }
    }

    const updated = await transaction.teacherBrief.updateMany({
      where: { id: brief.id, status: 'PENDING_REVIEW' },
      data: {
        status: 'APPROVED',
        reviewedById: reviewerId,
        reviewedAt: now,
        reviewMotif: motif,
        ...(approvedContent !== undefined ? { approvedContent: approvedContent as unknown as object } : {}),
      },
    });
    if (updated.count !== 1) throw new TeacherBriefReviewError('BRIEF_CONCURRENT_REVIEW');
    return Object.freeze({ briefId: brief.id, status: 'APPROVED' as const });
  });
}

export async function requestTeacherBriefCorrection(input: Readonly<{
  prisma?: ReviewDatabase;
  actor: Actor;
  briefId: string;
  motifCode: ReviewMotifCode;
  freeComment?: string;
  annotation: Readonly<{ section: string; remark: string }>;
  now?: () => Date;
}>) {
  const database = input.prisma ?? prisma;
  const reviewerId = assertAssistante(input.actor);
  const motif = assertMotif(buildReviewMotif(input.motifCode, input.freeComment ?? ''));
  const now = (input.now ?? (() => new Date()))();
  const section = input.annotation.section.trim();
  const remark = input.annotation.remark.trim();
  if (!section || !remark) throw new TeacherBriefReviewError('BRIEF_ANNOTATION_REQUIRED');

  return database.$transaction(async (transaction) => {
    const brief = await transaction.teacherBrief.findUnique({
      where: { id: input.briefId },
      select: { id: true, status: true },
    });
    if (brief === null || brief.status !== 'PENDING_REVIEW') {
      throw new TeacherBriefReviewError('BRIEF_NOT_PENDING_REVIEW');
    }
    await transaction.teacherBriefAnnotation.create({
      data: { teacherBriefId: brief.id, section, remark, authorId: reviewerId },
    });
    const updated = await transaction.teacherBrief.updateMany({
      where: { id: brief.id, status: 'PENDING_REVIEW' },
      data: {
        status: 'CORRECTION_REQUESTED',
        reviewedById: reviewerId,
        reviewedAt: now,
        reviewMotif: motif,
      },
    });
    if (updated.count !== 1) throw new TeacherBriefReviewError('BRIEF_CONCURRENT_REVIEW');
    return Object.freeze({ briefId: brief.id, status: 'CORRECTION_REQUESTED' as const });
  });
}

/** Une régénération après correction marque l'ancienne version SUPERSEDED. */
export async function supersedeCorrectedBrief(
  transaction: Pick<PrismaClient, 'teacherBrief'>,
  reportArtifactId: string,
): Promise<void> {
  await transaction.teacherBrief.updateMany({
    where: { reportArtifactId, status: 'CORRECTION_REQUESTED' },
    data: { status: 'SUPERSEDED' },
  });
}
