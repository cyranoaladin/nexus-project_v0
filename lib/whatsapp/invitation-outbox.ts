import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

const SCHEMA_VERSION = 'whatsapp-invitation/v1';
const KEY_VERSION = 'v1';
export const invitationSchema = z.object({
  userId: z.string().min(1).max(100),
  challengeId: z.string().min(1).max(100),
  rawToken: z.string().min(16).max(512),
  phoneNormalized: z.string().regex(/^[1-9]\d{7,14}$/),
  phoneVersion: z.number().int().nonnegative(),
  purpose: z.enum(['ACTIVATION', 'RECOVERY']),
  expiresAt: z.string().datetime(),
}).strict();
export type WhatsAppInvitation = z.infer<typeof invitationSchema>;
export type WhatsAppDeliveryState = 'PENDING' | 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'AMBIGUOUS';
const deliverySchema = z.object({
  state: z.enum(['PENDING', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'AMBIGUOUS']),
  providerMessageId: z.string().max(512).optional(),
  eventTimestamp: z.number().int().nonnegative().optional(),
});
export const whatsAppEnvelopeSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  keyVersion: z.literal(KEY_VERSION),
  correlationId: z.string().uuid(),
  iv: z.string().min(1), tag: z.string().min(1), ciphertext: z.string().min(1),
  delivery: deliverySchema,
}).strict();
export type WhatsAppEnvelope = z.infer<typeof whatsAppEnvelopeSchema>;

function key(): Buffer {
  const secret = process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error('WHATSAPP_OUTBOX_ENCRYPTION_KEY_INVALID');
  return createHmac('sha256', secret).update(KEY_VERSION).digest();
}
export function assertWhatsAppOutboxEncryptionConfiguration(): void { key(); }
function aad(correlationId: string): Buffer { return Buffer.from(`${SCHEMA_VERSION}\0${KEY_VERSION}\0${correlationId}`); }

export function decryptWhatsAppInvitation(payload: unknown): WhatsAppInvitation {
  const parsed = whatsAppEnvelopeSchema.parse(payload);
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(parsed.iv, 'base64url'), { authTagLength: 16 });
  decipher.setAAD(aad(parsed.correlationId));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'));
  const cleartext = Buffer.concat([decipher.update(Buffer.from(parsed.ciphertext, 'base64url')), decipher.final()]);
  return invitationSchema.parse(JSON.parse(cleartext.toString('utf8')));
}

/** Call inside the same transaction that creates the purpose-bound challenge.
 * Duplicate idempotency keys intentionally abort the transaction, as email outbox does.
 * Provider configuration is checked only by the worker; missing crypto config fails closed here.
 */
export async function enqueueParentWhatsAppInvitation(
  tx: Pick<Prisma.TransactionClient, 'jobOutbox'>,
  input: Omit<WhatsAppInvitation, 'expiresAt'> & { expiresAt: Date },
): Promise<{ id: string; sourceEventKey: string }> {
  const content = invitationSchema.parse({ ...input, expiresAt: input.expiresAt.toISOString() });
  const correlationId = randomUUID();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv, { authTagLength: 16 });
  cipher.setAAD(aad(correlationId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(content), 'utf8'), cipher.final()]);
  const payload: WhatsAppEnvelope = {
    schemaVersion: SCHEMA_VERSION, keyVersion: KEY_VERSION, correlationId,
    iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url'),
    delivery: { state: 'PENDING' },
  };
  const digest = createHmac('sha256', key()).update(`${SCHEMA_VERSION}\0${content.userId}\0${content.challengeId}\0${content.phoneVersion}\0${content.purpose}`).digest('hex');
  return tx.jobOutbox.create({
    data: {
      jobType: 'WHATSAPP_SEND', aggregateType: 'USER', aggregateId: content.userId,
      sourceEventKey: correlationId, idempotencyKey: `whatsapp:v1:${digest}`,
      status: 'PENDING', payload: payload as Prisma.InputJsonValue,
    },
    select: { id: true, sourceEventKey: true },
  });
}
