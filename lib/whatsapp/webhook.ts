import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { whatsAppEnvelopeSchema, type WhatsAppEnvelope, type WhatsAppDeliveryState } from './invitation-outbox';

export function verifyMetaWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (secret.length < 32 || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}

type StatusEvent = { status: 'sent' | 'delivered' | 'read' | 'failed'; id: string; timestamp: number };
type Delivery = WhatsAppEnvelope['delivery'];
const RANK: Record<WhatsAppDeliveryState, number> = { PENDING: 0, AMBIGUOUS: 0, ACCEPTED: 1, SENT: 2, FAILED: 2, DELIVERED: 3, READ: 4 };

/** Delivery evidence can only advance; an older/later failure cannot erase a read receipt. */
export function mergeWhatsAppDelivery(current: Delivery, event: StatusEvent): Delivery | null {
  if (current.providerMessageId && current.providerMessageId !== event.id) return null;
  const state = event.status.toUpperCase() as 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  if (current.state === state || RANK[state] < RANK[current.state]) return null;
  if (current.state === 'FAILED' && state === 'SENT') return null;
  return { state, providerMessageId: event.id, eventTimestamp: Math.max(current.eventTimestamp ?? 0, event.timestamp) };
}

const statusSchema = z.object({
  id: z.string().startsWith('wamid.').max(512),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: z.string().regex(/^\d{1,13}$/).transform(Number),
  biz_opaque_callback_data: z.string().uuid(),
});
const callbackSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(z.object({ changes: z.array(z.object({
    field: z.string(),
    value: z.object({ metadata: z.object({ phone_number_id: z.string() }).optional(), statuses: z.array(z.unknown()).optional() }),
  })) })),
});

/** Only call after authenticating exact raw payload. No recipients or provider errors
 * are copied to the DB. Correlation is our random event id, not a telephone number.
 */
export async function applyWhatsAppStatusEvents(
  payload: unknown,
  expectedPhoneNumberId: string,
  db: Pick<PrismaClient, 'jobOutbox'> = prisma,
): Promise<number> {
  const parsed = callbackSchema.safeParse(payload);
  if (!parsed.success) throw new Error('WHATSAPP_WEBHOOK_INVALID');
  let updated = 0;
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages' || change.value.metadata?.phone_number_id !== expectedPhoneNumberId) continue;
      for (const raw of change.value.statuses ?? []) {
        const status = statusSchema.safeParse(raw);
        if (!status.success) continue;
        for (let retry = 0; retry < 3; retry++) {
          const job = await db.jobOutbox.findFirst({
            where: { jobType: 'WHATSAPP_SEND', sourceEventKey: status.data.biz_opaque_callback_data, status: { notIn: ['CANCELLED', 'PENDING'] } },
          });
          if (!job) break;
          const envelope = whatsAppEnvelopeSchema.safeParse(job.payload);
          if (!envelope.success || envelope.data.correlationId !== status.data.biz_opaque_callback_data) break;
          const delivery = mergeWhatsAppDelivery(envelope.data.delivery, status.data);
          if (!delivery) break;
          const saved = await db.jobOutbox.updateMany({
            where: { id: job.id, status: { not: 'CANCELLED' }, payload: { equals: job.payload as Prisma.InputJsonValue } },
            data: {
              status: delivery.state === 'FAILED' ? 'FAILED_FINAL' : 'COMPLETED',
              payload: { ...envelope.data, delivery } as Prisma.InputJsonValue,
              // Receipt evidence is not provider-call settlement. Only the worker
              // may release its lease after send returns (or throws).
              completedAt: new Date(),
              lastError: delivery.state === 'FAILED' ? 'WHATSAPP_DELIVERY_FAILED' : null,
            },
          });
          if (saved.count === 1) { updated++; break; }
          if (retry === 2) throw new Error('WHATSAPP_WEBHOOK_RETRY_REQUIRED');
        }
      }
    }
  }
  return updated;
}
