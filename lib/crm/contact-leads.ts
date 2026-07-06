import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email/mailer';
import { contactLeadNotification } from '@/lib/email/templates';
import { LEGAL } from '@/lib/legal';

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
  email: z.string().trim().toLowerCase().email().max(320),
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

export const CONTACT_LEAD_RETENTION_DAYS = 365;
export const CONTACT_LEAD_ERASURE_SLA_DAYS = 30;

export function buildContactLeadRetentionDecision() {
  return {
    dataCategory: 'public_lead_minor_related',
    legalBasis: 'parent_consent_and_precontractual_request',
    retentionDays: CONTACT_LEAD_RETENTION_DAYS,
    erasureSlaDays: CONTACT_LEAD_ERASURE_SLA_DAYS,
    deletionProcedure:
      'Supprimer ou anonymiser les lignes ContactLead à la demande parentale et purger les leads non convertis au-delà de la durée de conservation.',
    productionAction: 'schedule_retention_job_before_go_live_large',
  } as const;
}

function getLeadNotificationRecipient(): string {
  return (
    process.env.CRM_LEAD_NOTIFICATION_EMAIL ||
    process.env.INTERNAL_NOTIFICATION_EMAIL ||
    process.env.MAIL_REPLY_TO ||
    process.env.EMAIL_REPLY_TO ||
    LEGAL.contact.email
  );
}

export async function captureContactLead(payload: unknown) {
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

  const leadData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      profile: data.profile,
      interest: data.interest,
      urgency: data.urgency,
      source: data.source,
      status: 'NEW',
      notes: data.notes,
  } as const;

  const existingLead = typeof prisma.contactLead.findFirst === 'function'
    ? await prisma.contactLead.findFirst({
        where: {
          email: data.email,
          source: data.source,
          status: 'NEW',
        },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  const lead = existingLead && typeof prisma.contactLead.update === 'function'
    ? await prisma.contactLead.update({
        where: { id: existingLead.id },
        data: leadData,
      })
    : await prisma.contactLead.create({
        data: leadData,
      });

  const template = contactLeadNotification({
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    profile: lead.profile,
    interest: lead.interest,
    urgency: lead.urgency,
    source: lead.source,
    createdAt: lead.createdAt,
  });

  try {
    await sendMail({
      to: getLeadNotificationRecipient(),
      subject: template.subject,
      html: template.html,
      text: template.text,
      replyTo: lead.email,
    });
  } catch (error) {
    console.error('[contact] lead notification failed', {
      name: error instanceof Error ? error.name : 'Error',
    });
  }

  return lead;
}
