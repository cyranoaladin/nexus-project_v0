import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email/mailer';
import { contactLeadNotification } from '@/lib/email/templates';
import { LEGAL } from '@/lib/legal';
import { serializeError } from '@/lib/utils/serialize-error';
import {
  synchronizePreRentreeCampaignContext,
  type PreRentreeBilanPrefill,
} from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';
import { bilanGratuitSchema } from '@/lib/validations';

export class BilanLeadValidationError extends Error {
  constructor() {
    super('BILAN_LEAD_VALIDATION_FAILED');
    this.name = 'BilanLeadValidationError';
  }
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

function buildProfileLabel(input: {
  gradeLevel: string;
  studentFirstName: string;
  establishment?: string | null;
  campaignContext: PreRentreeBilanPrefill | null;
}): string {
  const parts = [
    input.gradeLevel,
    input.studentFirstName,
    input.establishment?.trim() || null,
  ].filter(Boolean);

  if (input.campaignContext?.profile) {
    parts.push(
      [
        input.campaignContext.profile.voie,
        input.campaignContext.profile.mathsProfile,
        input.campaignContext.profile.eafProfile,
      ]
        .filter(Boolean)
        .join(' / '),
    );
  }

  return parts.join(' · ');
}

function buildInterestLabel(
  campaignContext: PreRentreeBilanPrefill | null,
  subjects: string[],
): string {
  if (campaignContext) {
    return `${campaignContext.packCode} · ${campaignContext.level} · ${campaignContext.subjectIds.join(', ')}`;
  }
  return subjects.join(', ');
}

/**
 * Capture a bilan-gratuit request as a ContactLead only.
 * No User / ParentProfile / Student is created at this stage.
 */
export async function captureBilanGratuitLead(payload: unknown) {
  const parsed = bilanGratuitSchema.safeParse(payload);
  if (!parsed.success) {
    throw new BilanLeadValidationError();
  }

  const data = parsed.data;
  const raw = (payload ?? {}) as Record<string, unknown>;
  const offerCode =
    typeof raw.offerId === 'string' && raw.offerId.trim().length > 0
      ? raw.offerId.trim().slice(0, 120)
      : data.offerId?.trim() || null;

  const campaignContext = synchronizePreRentreeCampaignContext({
    campaignContext: data.campaignContext ?? undefined,
    studentGrade: data.studentGrade,
    subjects: data.subjects,
  });

  const name = `${data.parentFirstName.trim()} ${data.parentLastName.trim()}`.trim();
  const email = data.parentEmail.trim().toLowerCase();
  const profile = buildProfileLabel({
    gradeLevel: data.studentGrade,
    studentFirstName: data.studentFirstName,
    establishment: data.studentSchool,
    campaignContext,
  });
  const interest = buildInterestLabel(campaignContext, data.subjects);
  const source = campaignContext?.programme ?? 'bilan-gratuit';

  const lead = await prisma.contactLead.create({
    data: {
      name,
      email,
      phone: data.parentPhone.trim(),
      profile,
      interest,
      source,
      status: 'NOUVEAU',
      notes: null,
      studentFirstName: data.studentFirstName.trim(),
      gradeLevel: data.studentGrade,
      establishment: data.studentSchool?.trim() || null,
      subjects: data.subjects,
      mainNeed: data.objectives?.trim() || null,
      message: data.difficulties?.trim() || null,
      offerCode,
      campaignContext: campaignContext ?? undefined,
      consentAt: data.acceptTerms ? new Date() : null,
    },
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
      subject: `[Nexus] Demande de bilan — ${lead.name}`,
      html: template.html,
      text: template.text,
      replyTo: lead.email,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[bilan-gratuit] lead notification failed', serializeError(error));
    }
  }

  return lead;
}

export function isBilanLeadValidationError(error: unknown): error is BilanLeadValidationError {
  return error instanceof BilanLeadValidationError;
}
