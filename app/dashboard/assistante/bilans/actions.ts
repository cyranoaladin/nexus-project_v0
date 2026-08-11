'use server';

import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import {
  completePaperEntryParentEmail,
  ParentContactError,
} from '@/lib/bilans/staff/parent-contact-service';
import {
  rejectPendingReport,
  StaffReviewError,
  validateAndPublishPendingReport,
} from '@/lib/bilans/staff/review-service';

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
