import type { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Relecture obligatoire du brief enseignant.
 *
 * Aucun contenu généré n'atteint un enseignant sans validation explicite :
 * l'état PENDING_REVIEW est distinct de tout état utilisable ; seul un
 * brief APPROVED est montré comme prêt. La relectrice peut approuver
 * (éventuellement en corrigeant à la main — sa correction prime toujours),
 * ou annoter et renvoyer en correction ; la régénération crée une nouvelle
 * version, l'historique reste intact (append-only).
 */

export class TeacherBriefReviewError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'TeacherBriefReviewError';
  }
}

type ReviewDatabase = Pick<PrismaClient, '$transaction' | 'teacherBrief' | 'teacherBriefAnnotation'>;

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

export async function approveTeacherBrief(input: Readonly<{
  prisma?: ReviewDatabase;
  actor: Actor;
  briefId: string;
  motif: string;
  /** Correction manuelle facultative — si présente, elle PRIME sur le contenu généré. */
  editedContent?: string;
  now?: () => Date;
}>) {
  const database = input.prisma ?? prisma;
  const reviewerId = assertAssistante(input.actor);
  const motif = assertMotif(input.motif);
  const now = (input.now ?? (() => new Date()))();
  const edited = input.editedContent?.trim();

  return database.$transaction(async (transaction) => {
    const brief = await transaction.teacherBrief.findUnique({
      where: { id: input.briefId },
      select: { id: true, status: true },
    });
    if (brief === null || brief.status !== 'PENDING_REVIEW') {
      throw new TeacherBriefReviewError('BRIEF_NOT_PENDING_REVIEW');
    }
    const updated = await transaction.teacherBrief.updateMany({
      where: { id: brief.id, status: 'PENDING_REVIEW' },
      data: {
        status: 'APPROVED',
        reviewedById: reviewerId,
        reviewedAt: now,
        reviewMotif: motif,
        ...(edited ? { editedContent: edited } : {}),
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
  motif: string;
  annotation: Readonly<{ section: string; remark: string }>;
  now?: () => Date;
}>) {
  const database = input.prisma ?? prisma;
  const reviewerId = assertAssistante(input.actor);
  const motif = assertMotif(input.motif);
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
