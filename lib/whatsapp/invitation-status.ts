import type { PrismaClient, JobOutbox } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { whatsAppEnvelopeSchema } from './invitation-outbox';

export type WhatsAppInvitationUiStatus = 'PENDING' | 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'AMBIGUOUS' | 'RETRY_SCHEDULED' | 'SERVICE_UNAVAILABLE' | 'CANCELLED';

/** Public-facing dispatch status only: activation remains a separate identity fact. */
export function getWhatsAppInvitationStatus(job: Pick<JobOutbox, 'status' | 'payload' | 'lastError'>): WhatsAppInvitationUiStatus {
  if (job.status === 'CANCELLED') return 'CANCELLED';
  const parsed = whatsAppEnvelopeSchema.safeParse(job.payload);
  if (parsed.success && ['DELIVERED', 'READ', 'SENT'].includes(parsed.data.delivery.state)) return parsed.data.delivery.state as 'DELIVERED' | 'READ' | 'SENT';
  if (job.status === 'AMBIGUOUS') return 'AMBIGUOUS';
  if (job.status === 'FAILED_FINAL' || job.status === 'FAILED') return 'FAILED';
  if (job.status === 'RETRY_SCHEDULED') return job.lastError === 'WHATSAPP_SERVICE_UNAVAILABLE' ? 'SERVICE_UNAVAILABLE' : 'RETRY_SCHEDULED';
  if (job.status === 'COMPLETED' && parsed.success && parsed.data.delivery.state === 'ACCEPTED') return 'ACCEPTED';
  return 'PENDING';
}

/** Caller must authenticate staff/parent ownership before supplying userId.
 * This reports the LAST dispatch only, never current account activation/verification.
 */
export async function getLatestParentWhatsAppInvitationStatus(userId: string, db: Pick<PrismaClient, 'jobOutbox'> = prisma) {
  const job = await db.jobOutbox.findFirst({
    where: { jobType: 'WHATSAPP_SEND', aggregateType: 'USER', aggregateId: userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { status: true, payload: true, lastError: true, createdAt: true, updatedAt: true },
  });
  return job ? { status: getWhatsAppInvitationStatus(job), queuedAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString() } : null;
}
