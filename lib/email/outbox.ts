import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
} from 'node:crypto';

import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const EMAIL_OUTBOX_SCHEMA_VERSION = 'email-intent/v1' as const;
export const EMAIL_OUTBOX_KEY_VERSION = 'v1' as const;

export type EmailMessageType =
  | 'PARENT_ACTIVATION'
  | 'STUDENT_ACTIVATION'
  | 'PASSWORD_RESET'
  | 'TRANSACTIONAL_NOTIFICATION';

export type EmailIntentContent = Readonly<{
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  messageId: string;
}>;

const encryptedPayloadSchema = z.object({
  schemaVersion: z.literal(EMAIL_OUTBOX_SCHEMA_VERSION),
  keyVersion: z.literal(EMAIL_OUTBOX_KEY_VERSION),
  messageType: z.enum([
    'PARENT_ACTIVATION',
    'STUDENT_ACTIVATION',
    'PASSWORD_RESET',
    'TRANSACTIONAL_NOTIFICATION',
  ]),
  messageId: z.string().min(3).max(255),
  iv: z.string().min(1),
  tag: z.string().min(1),
  ciphertext: z.string().min(1),
}).strict();

type EncryptedPayload = z.infer<typeof encryptedPayloadSchema>;
type OutboxTransaction = Pick<Prisma.TransactionClient, 'jobOutbox'>;

function dedicatedSecret(): Buffer {
  const value = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY?.trim();
  if (!value || value.length < 32) throw new Error('EMAIL_OUTBOX_ENCRYPTION_KEY_INVALID');
  return createHmac('sha256', value).update(EMAIL_OUTBOX_KEY_VERSION).digest();
}

function messageIdDomain(): string {
  const value = process.env.EMAIL_MESSAGE_ID_DOMAIN?.trim().toLowerCase()
    || 'mail.nexusreussite.academy';
  if (!/^[a-z0-9.-]+$/.test(value) || value.startsWith('.') || value.endsWith('.')) {
    throw new Error('EMAIL_MESSAGE_ID_DOMAIN_INVALID');
  }
  return value;
}

function encryptContent(
  content: EmailIntentContent,
  messageType: EmailMessageType,
): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dedicatedSecret(), iv, { authTagLength: 16 });
  const aad = Buffer.from(`${EMAIL_OUTBOX_SCHEMA_VERSION}\0${content.messageId}\0${messageType}`);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(content), 'utf8'),
    cipher.final(),
  ]);
  return {
    schemaVersion: EMAIL_OUTBOX_SCHEMA_VERSION,
    keyVersion: EMAIL_OUTBOX_KEY_VERSION,
    messageType,
    messageId: content.messageId,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  };
}

export function decryptEmailIntent(payload: unknown): Readonly<{
  messageType: EmailMessageType;
  content: EmailIntentContent;
}> {
  const parsed = encryptedPayloadSchema.parse(payload);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    dedicatedSecret(),
    Buffer.from(parsed.iv, 'base64url'),
    { authTagLength: 16 },
  );
  decipher.setAAD(Buffer.from(
    `${parsed.schemaVersion}\0${parsed.messageId}\0${parsed.messageType}`,
  ));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'));
  const cleartext = Buffer.concat([
    decipher.update(Buffer.from(parsed.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  const content = z.object({
    to: z.string().email(),
    subject: z.string().min(1).max(998),
    html: z.string().min(1),
    text: z.string().optional(),
    replyTo: z.string().email().optional(),
    messageId: z.literal(parsed.messageId),
  }).strict().parse(JSON.parse(cleartext));
  return Object.freeze({ messageType: parsed.messageType, content: Object.freeze(content) });
}

function idempotencyKey(input: Readonly<{
  messageType: EmailMessageType;
  aggregateId: string;
  dedupeKey: string;
}>): string {
  const digest = createHmac('sha256', dedicatedSecret())
    .update(`${EMAIL_OUTBOX_SCHEMA_VERSION}\0${input.messageType}\0${input.aggregateId}\0${input.dedupeKey}`)
    .digest('hex');
  return `email:v1:${digest}`;
}

export async function enqueueEmailIntent(
  transaction: OutboxTransaction,
  input: Readonly<{
    aggregateId: string;
    aggregateType?: string;
    messageType: EmailMessageType;
    dedupeKey: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
    now?: Date;
  }>,
) {
  const intentId = randomUUID();
  const messageId = `<${intentId}@${messageIdDomain()}>`;
  const encrypted = encryptContent({
    to: input.to.trim().normalize('NFC').toLowerCase(),
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
    messageId,
  }, input.messageType);
  return transaction.jobOutbox.create({
    data: {
      jobType: 'SEND_EMAIL',
      aggregateType: input.aggregateType ?? 'USER',
      aggregateId: input.aggregateId,
      sourceEventKey: intentId,
      idempotencyKey: idempotencyKey(input),
      status: 'PENDING',
      payload: encrypted as Prisma.InputJsonValue,
      availableAt: input.now ?? new Date(),
    },
    select: { id: true, sourceEventKey: true },
  });
}
