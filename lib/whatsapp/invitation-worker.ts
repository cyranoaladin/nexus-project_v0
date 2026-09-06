import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isParentPhoneChallengeValid } from '@/lib/auth/parent-phone';
import { decryptWhatsAppInvitation, whatsAppEnvelopeSchema, type WhatsAppInvitation, type WhatsAppEnvelope } from './invitation-outbox';
import { sendMetaWhatsAppInvitation } from './meta-provider';

type WorkerDatabase = Pick<PrismaClient, 'jobOutbox' | 'parentPhoneChallenge'>;
export type WhatsAppWorkerDependencies = { prisma: WorkerDatabase; send: typeof sendMetaWhatsAppInvitation; now: () => Date };
const MAX_ATTEMPTS = 5;
const LEASE_MS = 60_000;
const SAFE_ERRORS = new Set(['WHATSAPP_SERVICE_UNAVAILABLE', 'WHATSAPP_RATE_LIMITED', 'WHATSAPP_PROVIDER_UNCERTAIN', 'WHATSAPP_PROVIDER_REJECTED', 'WHATSAPP_ACCEPTANCE_UNKNOWN', 'WHATSAPP_TRANSPORT_UNCERTAIN']);

async function currentChallengeIsValid(db: WorkerDatabase, input: WhatsAppInvitation, now: Date): Promise<boolean> {
  const challenge = await db.parentPhoneChallenge.findUnique({
    where: { id: input.challengeId },
    include: { user: true },
  });
  return isParentPhoneChallengeValid(challenge, input.rawToken, now)
    && challenge.id === input.challengeId && challenge.userId === input.userId
    && challenge.purpose === input.purpose && challenge.phoneVersion === input.phoneVersion
    && challenge.phoneNormalized === input.phoneNormalized
    && challenge.expiresAt.toISOString() === input.expiresAt;
}

/** Expired leases and uncertain network outcomes are NEVER automatically retried.
 * A provider callback may reconcile them later. Only definite rejection (429) or
 * unavailable configuration is retryable. Tokens are revalidated before every attempt.
 */
export async function drainWhatsAppInvitations(
  options: { limit?: number; owner?: string } = {},
  dependencies: Partial<WhatsAppWorkerDependencies> = {},
) {
  const deps: WhatsAppWorkerDependencies = { prisma, send: sendMetaWhatsAppInvitation, now: () => new Date(), ...dependencies };
  const limit = options.limit ?? 20;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('WHATSAPP_BATCH_INVALID');
  const owner = options.owner ?? `whatsapp-${randomUUID()}`;
  const now = deps.now();
  await deps.prisma.jobOutbox.updateMany({
    where: { jobType: 'WHATSAPP_SEND', status: 'LEASED', leaseExpiresAt: { lte: now } },
    data: { status: 'AMBIGUOUS', leaseOwner: null, leaseExpiresAt: null, lastError: 'WHATSAPP_LEASE_EXPIRED' },
  });
  const jobs = await deps.prisma.jobOutbox.findMany({
    where: { jobType: 'WHATSAPP_SEND', status: { in: ['PENDING', 'RETRY_SCHEDULED'] }, availableAt: { lte: now } },
    orderBy: [{ availableAt: 'asc' }, { id: 'asc' }], take: limit,
  });
  const metrics = { claimed: 0, accepted: 0, cancelled: 0, retryScheduled: 0, ambiguous: 0, failed: 0 };
  for (const job of jobs) {
    const claimed = await deps.prisma.jobOutbox.updateMany({
      where: { id: job.id, jobType: 'WHATSAPP_SEND', status: { in: ['PENDING', 'RETRY_SCHEDULED'] }, availableAt: { lte: now } },
      data: { status: 'LEASED', leaseOwner: owner, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), attemptCount: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;
    metrics.claimed++;
    const owned = { id: job.id, status: 'LEASED' as const, leaseOwner: owner };
    let sendStarted = false;
    let intentDecrypted = false;
    try {
      const envelope = whatsAppEnvelopeSchema.parse(job.payload);
      const invitation = decryptWhatsAppInvitation(job.payload);
      intentDecrypted = true;
      if (job.aggregateType !== 'USER' || job.aggregateId !== invitation.userId || job.sourceEventKey !== envelope.correlationId
        || !await currentChallengeIsValid(deps.prisma, invitation, deps.now())) {
        await deps.prisma.jobOutbox.updateMany({ where: owned, data: { status: 'CANCELLED', lastError: 'WHATSAPP_CHALLENGE_INVALID', leaseOwner: null, leaseExpiresAt: null } });
        metrics.cancelled++;
        continue;
      }
      sendStarted = true;
      const outcome = await deps.send(invitation, envelope.correlationId);
      const data: Prisma.JobOutboxUpdateManyMutationInput = { leaseOwner: null, leaseExpiresAt: null };
      if (outcome.status === 'ACCEPTED') {
        data.status = 'COMPLETED';
        data.completedAt = deps.now();
        data.lastError = null;
        data.payload = { ...envelope, delivery: { state: 'ACCEPTED', providerMessageId: outcome.providerMessageId } } as Prisma.InputJsonValue;
        metrics.accepted++;
      } else {
        data.lastError = SAFE_ERRORS.has(outcome.code) ? outcome.code : 'WHATSAPP_SEND_FAILED';
        if (outcome.status === 'AMBIGUOUS') {
          data.status = 'AMBIGUOUS';
          data.payload = deliveryPayload(envelope, 'AMBIGUOUS');
          metrics.ambiguous++;
        } else if (outcome.status === 'FAILED' || job.attemptCount + 1 >= MAX_ATTEMPTS) {
          data.status = 'FAILED_FINAL';
          data.payload = deliveryPayload(envelope, 'FAILED');
          metrics.failed++;
        } else {
          data.status = 'RETRY_SCHEDULED';
          data.availableAt = new Date(deps.now().getTime() + Math.min(15 * 60_000, 30_000 * 2 ** job.attemptCount));
          metrics.retryScheduled++;
        }
      }
      // A signed webhook can arrive before the provider call returns. Never overwrite it.
      await deps.prisma.jobOutbox.updateMany({ where: { ...owned, payload: { equals: job.payload as Prisma.InputJsonValue } }, data });
    } catch {
      const retryBeforeSend = !sendStarted && intentDecrypted && job.attemptCount + 1 < MAX_ATTEMPTS;
      await deps.prisma.jobOutbox.updateMany({
        where: owned,
        data: {
          status: sendStarted ? 'AMBIGUOUS' : retryBeforeSend ? 'RETRY_SCHEDULED' : 'FAILED_FINAL',
          leaseOwner: null, leaseExpiresAt: null,
          ...(retryBeforeSend ? { availableAt: new Date(deps.now().getTime() + 30_000 * 2 ** job.attemptCount) } : {}),
          lastError: sendStarted ? 'WHATSAPP_DISPATCH_UNCERTAIN' : intentDecrypted ? 'WHATSAPP_VALIDATION_UNAVAILABLE' : 'WHATSAPP_INTENT_INVALID',
        },
      });
      if (sendStarted) metrics.ambiguous++; else if (retryBeforeSend) metrics.retryScheduled++; else metrics.failed++;
    }
  }
  return metrics;
}
function deliveryPayload(envelope: WhatsAppEnvelope, state: 'AMBIGUOUS' | 'FAILED'): Prisma.InputJsonValue {
  return { ...envelope, delivery: { state } } as Prisma.InputJsonValue;
}
