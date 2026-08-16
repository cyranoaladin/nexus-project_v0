'use server';

import type { GradeLevel, Subject } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { auth } from '@/auth';
import {
  completePaperEntryParentEmail,
  ParentContactError,
} from '@/lib/bilans/staff/parent-contact-service';
import {
  rejectPendingReport,
  requestCorrectionForPendingReport,
  resumeCorrectedReport,
  StaffReviewError,
  validateAndPublishPendingReport,
} from '@/lib/bilans/staff/review-service';
import type { ReportAnnotationSection, ReportReviewAnnotationInput } from '@/lib/bilans/core/report-service';
import { ReportTransmissionError, confirmWhatsAppTransmission } from '@/lib/bilans/staff/transmission-service';
import { prepareWhatsAppSend, WhatsAppSendError } from '@/lib/bilans/staff/whatsapp-send-service';
import { enqueueTeacherBriefGeneration } from '@/lib/bilans/llm/teacher-brief-enqueue';
import {
  approveTeacherBrief,
  requestTeacherBriefCorrection,
  TeacherBriefReviewError,
  type ReviewMotifCode,
} from '@/lib/bilans/staff/teacher-brief-review-service';
import {
  listStaffTeacherDossierActionableArtifactIds,
  StaffTeacherDossierError,
} from '@/lib/bilans/staff/teacher-dossier-service';
import { prisma } from '@/lib/prisma';

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

async function actor() {
  const session = await auth();
  if (session?.user?.id === undefined || session.user.role === undefined) notFound();
  return { userId: session.user.id, role: session.user.role } as const;
}

function handleAccessError(error: unknown): never {
  if (error instanceof StaffReviewError && error.code === 'NOT_FOUND') notFound();
  if (error instanceof ParentContactError && error.code === 'NOT_FOUND') notFound();
  throw error;
}

export async function addParentEmailAction(formData: FormData): Promise<void> {
  try {
    await completePaperEntryParentEmail({
      ...await actor(),
      revisionId: field(formData, 'revisionId'),
      email: field(formData, 'email'),
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    handleAccessError(error);
  }
}

export async function validateAndPublishReportAction(formData: FormData): Promise<void> {
  try {
    await validateAndPublishPendingReport({
      ...await actor(),
      revisionId: field(formData, 'revisionId'),
      motif: field(formData, 'motif'),
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    handleAccessError(error);
  }
}

export async function rejectReportAction(formData: FormData): Promise<void> {
  try {
    await rejectPendingReport({
      ...await actor(),
      revisionId: field(formData, 'revisionId'),
      motif: field(formData, 'motif'),
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    handleAccessError(error);
  }
}

export async function requestCorrectionAction(formData: FormData): Promise<void> {
  const annotation: ReportReviewAnnotationInput = {
    audience: field(formData, 'audience') as ReportReviewAnnotationInput['audience'],
    section: field(formData, 'section') as ReportAnnotationSection,
    remark: field(formData, 'remark'),
  };
  try {
    await requestCorrectionForPendingReport({
      ...await actor(),
      revisionId: field(formData, 'revisionId'),
      motif: field(formData, 'motif'),
      annotations: [annotation],
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    handleAccessError(error);
  }
}

export async function resumeReviewAction(formData: FormData): Promise<void> {
  try {
    await resumeCorrectedReport({
      ...await actor(),
      revisionId: field(formData, 'revisionId'),
      motif: field(formData, 'motif'),
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    handleAccessError(error);
  }
}

export async function prepareWhatsAppSendAction(formData: FormData): Promise<void> {
  let whatsappUrl: string;
  try {
    const current = await actor();
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
    const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https';
    const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, '')
      ?? (host !== null ? `${protocol}://${host}` : 'https://nexusreussite.academy');
    const prepared = await prepareWhatsAppSend({
      actor: current,
      reportArtifactId: field(formData, 'artifactId'),
      origin,
    });
    whatsappUrl = prepared.whatsappUrl;
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    if (error instanceof WhatsAppSendError) notFound();
    handleAccessError(error);
  }
  redirect(whatsappUrl);
}

export async function confirmWhatsAppTransmissionAction(formData: FormData): Promise<void> {
  try {
    const current = await actor();
    if (current.role !== 'ASSISTANTE') notFound();
    await confirmWhatsAppTransmission({
      reportArtifactId: field(formData, 'artifactId'),
      confirmedById: current.userId,
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    if (error instanceof ReportTransmissionError) notFound();
    if (error instanceof WhatsAppSendError) notFound();
    handleAccessError(error);
  }
}

/**
 * ADMIN : consultation et supervision en lecture seule uniquement (§14 de
 * l'incident P0) — aucune génération, aucune relecture tant qu'une
 * délégation explicite n'a pas été décidée. Refusé côté serveur, jamais
 * seulement caché côté UI.
 */
function assertAssistanteOnly(current: Readonly<{ role: string }>): void {
  if (current.role !== 'ASSISTANTE') notFound();
}

/**
 * Met en file la génération — jamais d'appel LLM synchrone dans cette
 * requête (§10 de l'incident P0). Répond en dessous de la seconde : une
 * seule écriture `INSERT ... ON CONFLICT DO NOTHING` dans le job outbox.
 */
export async function generateTeacherBriefAction(formData: FormData): Promise<void> {
  try {
    const current = await actor();
    assertAssistanteOnly(current);
    const reportArtifactId = field(formData, 'artifactId');
    const artifact = await prisma.reportArtifact.findUnique({
      where: { id: reportArtifactId },
      select: { revisions: { orderBy: { createdAt: 'desc' }, take: 1, select: { scoreSnapshotId: true } } },
    });
    const expectedScoreSnapshotId = artifact?.revisions[0]?.scoreSnapshotId;
    if (expectedScoreSnapshotId === undefined) notFound();
    await enqueueTeacherBriefGeneration(reportArtifactId, expectedScoreSnapshotId, current.userId);
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    handleAccessError(error);
  }
}

/**
 * Met en file la génération des briefs enseignant RÉELLEMENT ACTIONNABLES
 * (`listStaffTeacherDossierActionableArtifactIds` — jamais un brief déjà
 * PENDING_REVIEW/APPROVED-courant, jamais un DETERMINISTIC_ONLY, jamais un
 * bilan déjà en file) pour tout un groupe (matière × niveau) en un clic.
 * Chaque insertion est individuellement idempotente (`idempotencyKey`
 * unique) : répond en dessous de la seconde, sans appeler le moindre
 * modèle — le worker en process (`lib/bilans/worker/scheduler.ts`) traite
 * la file séquentiellement, un brief à la fois (§10).
 */
export async function generateGroupTeacherBriefsAction(formData: FormData): Promise<void> {
  try {
    const current = await actor();
    assertAssistanteOnly(current);
    const subject = field(formData, 'subject') as Subject;
    const level = field(formData, 'level') as GradeLevel;
    const targets = await listStaffTeacherDossierActionableArtifactIds(current, subject, level);
    for (const target of targets) {
      await enqueueTeacherBriefGeneration(target.reportArtifactId, target.expectedScoreSnapshotId, current.userId);
    }
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    if (error instanceof StaffTeacherDossierError && error.code === 'NOT_FOUND') notFound();
    handleAccessError(error);
  }
}

export async function approveTeacherBriefAction(formData: FormData): Promise<void> {
  try {
    const current = await actor();
    assertAssistanteOnly(current);
    const approvedContentRaw = field(formData, 'approvedContentJson').trim();
    let approvedContent: unknown;
    if (approvedContentRaw) {
      try {
        approvedContent = JSON.parse(approvedContentRaw);
      } catch {
        notFound();
      }
    }
    await approveTeacherBrief({
      actor: current,
      briefId: field(formData, 'briefId'),
      motifCode: field(formData, 'motifCode') as ReviewMotifCode,
      freeComment: field(formData, 'freeComment'),
      ...(approvedContent !== undefined ? { approvedContent } : {}),
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    if (error instanceof TeacherBriefReviewError) notFound();
    handleAccessError(error);
  }
}

export async function requestTeacherBriefCorrectionAction(formData: FormData): Promise<void> {
  try {
    const current = await actor();
    assertAssistanteOnly(current);
    await requestTeacherBriefCorrection({
      actor: current,
      briefId: field(formData, 'briefId'),
      motifCode: field(formData, 'motifCode') as ReviewMotifCode,
      freeComment: field(formData, 'freeComment'),
      annotation: {
        section: field(formData, 'section'),
        remark: field(formData, 'remark'),
      },
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    if (error instanceof TeacherBriefReviewError) notFound();
    handleAccessError(error);
  }
}

export async function executeRegenerationAction(formData: FormData): Promise<void> {
  const { executeReportRegeneration, ReportRegenerationError } = await import('@/lib/bilans/staff/regeneration-service');
  try {
    await executeReportRegeneration({
      actor: await actor(),
      revisionId: field(formData, 'revisionId'),
      motif: field(formData, 'motif'),
      confirmAlreadyPublished: formData.get('confirmAlreadyPublished') === 'on',
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    if (error instanceof ReportRegenerationError) notFound();
    handleAccessError(error);
  }
  redirect('/dashboard/assistante/bilans');
}

export async function prepareUpdateInfoMessageAction(formData: FormData): Promise<void> {
  const { prepareUpdateInfoMessage } = await import('@/lib/bilans/staff/whatsapp-send-service');
  let whatsappUrl: string;
  try {
    const prepared = await prepareUpdateInfoMessage({
      actor: await actor(),
      reportArtifactId: field(formData, 'artifactId'),
    });
    whatsappUrl = prepared.whatsappUrl;
  } catch (error) {
    if (error instanceof WhatsAppSendError) notFound();
    handleAccessError(error);
  }
  redirect(whatsappUrl);
}
