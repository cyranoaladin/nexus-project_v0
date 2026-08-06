import { createHmac } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import {
  enqueueEmailIntent,
  type EmailMessageType,
} from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';

type QueueCommittedEmailInput = Readonly<{
  aggregateType: string;
  aggregateKey: string;
  messageType?: EmailMessageType;
  dedupeKey: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}>;

function opaqueAggregateId(scope: string, value: string): string {
  const secret = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error('EMAIL_OUTBOX_ENCRYPTION_KEY_INVALID');
  return `email-aggregate:v1:${createHmac('sha256', secret)
    .update(`${scope}\0${value.normalize('NFC')}`)
    .digest('hex')}`;
}

/** Compatibility boundary for callers without an existing business transaction. */
export async function queueCommittedEmail(input: QueueCommittedEmailInput) {
  const intent = await enqueueEmailIntent(prisma, {
    aggregateType: input.aggregateType,
    aggregateId: opaqueAggregateId(input.aggregateType, input.aggregateKey),
    messageType: input.messageType ?? 'TRANSACTIONAL_NOTIFICATION',
    dedupeKey: input.dedupeKey,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
  kickEmailOutboxDrain();
  return intent;
}
