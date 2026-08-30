import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { contactLeadNotification } from '@/lib/email/templates';
import { LEGAL } from '@/lib/legal';
import { normalizeUserEmail } from '@/lib/contact/user-email';

const optionalText = z
  .preprocess(
    (value) => {
      if (value === null || value === undefined) return null;
      const text = String(value).trim();
      return text.length > 0 ? text : null;
    },
    z.string().max(500).nullable()
  )
  .default(null);

const contactLeadPayloadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).transform(normalizeUserEmail),
  phone: optionalText,
  profile: optionalText,
  interest: optionalText,
  urgency: optionalText,
  source: optionalText,
  notes: optionalText,
  type: optionalText,
  consent: z.boolean().optional(),
});

export class ContactLeadValidationError extends Error {
  code: 'missing_required' | 'invalid_payload';

  constructor(code: 'missing_required' | 'invalid_payload' = 'invalid_payload') {
    super('CONTACT_LEAD_VALIDATION_FAILED');
    this.code = code;
  }
}

export type ContactLeadInput = z.input<typeof contactLeadPayloadSchema>;

type ContactLeadTransaction = Pick<Prisma.TransactionClient, 'contactLead' | 'jobOutbox' | '$executeRawUnsafe'>;

function getLeadNotificationRecipient(): string {
  return (
    process.env.CRM_LEAD_NOTIFICATION_EMAIL ||
    process.env.INTERNAL_NOTIFICATION_EMAIL ||
    process.env.MAIL_REPLY_TO ||
    process.env.EMAIL_REPLY_TO ||
    LEGAL.contact.email
  );
}

function parseContactLeadPayload(payload: unknown) {
  const rawPayload = payload as Record<string, unknown> | null;
  const rawName = String(rawPayload?.name ?? '').trim();
  const rawEmail = String(rawPayload?.email ?? '').trim();

  if (!rawName || !rawEmail) {
    throw new ContactLeadValidationError('missing_required');
  }

  const parsed = contactLeadPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ContactLeadValidationError('invalid_payload');
  }

  const data = parsed.data;
  if ((data.type === 'newsletter' || data.type === 'callback' || data.type === 'contact') && data.consent !== true) {
    throw new ContactLeadValidationError('missing_required');
  }

  return data;
}

/** Create the lead and its notification intent inside the caller's transaction. */
export async function captureContactLeadInTransaction(transaction: ContactLeadTransaction, payload: unknown) {
  const data = parseContactLeadPayload(payload);
  const created = await transaction.contactLead.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      profile: data.profile,
      interest: data.interest,
      urgency: data.urgency,
      source: data.source,
      status: 'NEW',
      notes: data.notes,
    },
  });
  const template = contactLeadNotification({
    id: created.id,
    name: created.name,
    email: created.email,
    phone: created.phone,
    profile: created.profile,
    interest: created.interest,
    urgency: created.urgency,
    source: created.source,
    createdAt: created.createdAt,
  });
  await enqueueEmailIntent(transaction, {
    aggregateType: 'CONTACT_LEAD',
    aggregateId: created.id,
    messageType: 'TRANSACTIONAL_NOTIFICATION',
    dedupeKey: created.id,
    to: getLeadNotificationRecipient(),
    subject: template.subject,
    html: template.html,
    text: template.text,
    replyTo: created.email,
  });
  return created;
}

/**
 * Resolve the canonical responsible lead inside the caller transaction.
 *
 * ContactLead.email is indexed but intentionally not schema-unique. The
 * transaction-scoped advisory lock serializes this governed staff creation
 * path by normalized email, so concurrent parent + student creations reuse
 * the same lead without requiring a schema migration.
 */
export async function findOrCaptureResponsableLeadInTransaction(
  transaction: ContactLeadTransaction,
  payload: unknown,
  options: { emailLockAlreadyHeld?: boolean } = {},
) {
  const data = parseContactLeadPayload(payload);
  const lockKey = getContactLeadEmailLockKey(data.email);

  if (!options.emailLockAlreadyHeld) {
    await transaction.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      lockKey,
    );
  }

  const existing = await transaction.contactLead.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  return captureContactLeadInTransaction(transaction, data);
}

export function getContactLeadEmailLockKey(email: string): string {
  return `nexus:contact-lead:${normalizeUserEmail(email)}`;
}

/** Call only after the transaction containing the outbox row has committed. */
export function notifyContactLeadCaptureCommitted(): void {
  kickEmailOutboxDrain();
}

export async function captureContactLead(payload: unknown) {
  const lead = await prisma.$transaction((transaction) => captureContactLeadInTransaction(transaction, payload));
  notifyContactLeadCaptureCommitted();
  return lead;
}
