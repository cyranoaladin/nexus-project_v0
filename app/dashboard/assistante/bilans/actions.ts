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
import { generateTeacherBrief, TeacherBriefError } from '@/lib/bilans/llm/teacher-brief-service';
import {
  approveTeacherBrief,
  requestTeacherBriefCorrection,
  TeacherBriefReviewError,
} from '@/lib/bilans/staff/teacher-brief-review-service';
import {
  listStaffTeacherDossierArtifactIds,
  StaffTeacherDossierError,
} from '@/lib/bilans/staff/teacher-dossier-service';

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

export async function generateTeacherBriefAction(formData: FormData): Promise<void> {
  try {
    await generateTeacherBrief({
      actor: await actor(),
      reportArtifactId: field(formData, 'artifactId'),
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    if (error instanceof TeacherBriefError) notFound();
    handleAccessError(error);
  }
}

/**
 * Régénère les briefs enseignant manquants pour tout un groupe (matière ×
 * niveau) en un clic, plutôt qu'un par un. `generateTeacherBrief` est déjà
 * idempotent (mode `ALREADY_PRESENT`) : reboucler sur des bilans déjà
 * pourvus ne recoûte rien — le bouton est donc sûr à re-cliquer quand des
 * bilans s'ajoutent au groupe. Séquentiel (pas de Promise.all) : le cache de
 * prompt du modèle s'amortit d'un appel à l'autre (mesuré ~112 s/bilan,
 * ~0,10 $/bilan), et le plafond budgétaire mensuel du service reste la seule
 * limite.
 */
export async function generateGroupTeacherBriefsAction(formData: FormData): Promise<void> {
  try {
    const current = await actor();
    const subject = field(formData, 'subject') as Subject;
    const level = field(formData, 'level') as GradeLevel;
    const artifactIds = await listStaffTeacherDossierArtifactIds(current, subject, level);
    for (const artifactId of artifactIds) {
      try {
        await generateTeacherBrief({ actor: current, reportArtifactId: artifactId });
      } catch (error) {
        // Un bilan en échec (budget dépassé, PLANCHER, etc.) ne doit pas
        // bloquer les autres élèves du groupe — chacun est indépendant.
        if (!(error instanceof TeacherBriefError)) throw error;
      }
    }
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    if (error instanceof StaffTeacherDossierError && error.code === 'NOT_FOUND') notFound();
    handleAccessError(error);
  }
}

export async function approveTeacherBriefAction(formData: FormData): Promise<void> {
  try {
    const edited = field(formData, 'editedContent').trim();
    await approveTeacherBrief({
      actor: await actor(),
      briefId: field(formData, 'briefId'),
      motif: field(formData, 'motif'),
      ...(edited ? { editedContent: edited } : {}),
    });
    revalidatePath('/dashboard/assistante/bilans');
  } catch (error) {
    if (error instanceof TeacherBriefReviewError) notFound();
    handleAccessError(error);
  }
}

export async function requestTeacherBriefCorrectionAction(formData: FormData): Promise<void> {
  try {
    await requestTeacherBriefCorrection({
      actor: await actor(),
      briefId: field(formData, 'briefId'),
      motif: field(formData, 'motif'),
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
