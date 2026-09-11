/**
 * Delivery adapter for Core v2 invitations through the canonical email
 * outbox (retry, visibility, encryption at rest are the outbox's). Takes
 * plain values only — this file must stay free of any Core v2 import
 * (CORE_V2_MUST_NOT_BE_IMPORTED_BY_LIVE_RUNTIME) and never logs the token.
 */
import { getTrustedApplicationOrigin } from '@/lib/auth/parent-activation';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { escapeHtml } from '@/lib/email/templates';
import { prisma } from '@/lib/prisma';

export const CORE_V2_ACTIVATION_PATH = '/auth/activate';
export const CORE_V2_ACTIVATION_PURPOSE = 'core-v2';

export interface CoreV2InvitationMessage {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly activationUrl: string;
}

function sanitizeInline(value: string): string {
  return value.replace(/[\r\n<>]/g, '').trim();
}

export function buildCoreV2InvitationMessage(input: {
  readonly displayName: string;
  readonly rawToken: string;
  readonly expiresAt: Date;
}): CoreV2InvitationMessage {
  const url = new URL(CORE_V2_ACTIVATION_PATH, getTrustedApplicationOrigin());
  url.searchParams.set('purpose', CORE_V2_ACTIVATION_PURPOSE);
  url.searchParams.set('token', input.rawToken);
  const activationUrl = url.toString();
  const displayName = sanitizeInline(input.displayName) || 'Bonjour';
  const validity = input.expiresAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  return {
    subject: 'Activation de votre compte Nexus Réussite',
    activationUrl,
    text: [
      `Bonjour ${displayName},`,
      '',
      'Activez votre compte et choisissez votre mot de passe :',
      activationUrl,
      '',
      `Ce lien est personnel, utilisable une seule fois et valable jusqu'au ${validity}.`,
    ].join('\n'),
    html: [
      `<p>Bonjour ${escapeHtml(displayName)},</p>`,
      '<p>Activez votre compte et choisissez votre mot de passe :</p>',
      `<p><a href="${escapeHtml(activationUrl)}">Activer mon compte</a></p>`,
      `<p>Ce lien est personnel, utilisable une seule fois et valable jusqu'au ${escapeHtml(validity)}.</p>`,
    ].join(''),
  };
}

export interface DeliverCoreV2InvitationInput {
  readonly userId: string;
  readonly role: 'PARENT' | 'ELEVE' | 'COACH' | 'ADMIN' | 'ASSISTANTE';
  readonly email: string;
  readonly displayName: string;
  readonly rawToken: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

/** Enqueues the invitation email; dedupe on the token hash so a retried request never sends twice. */
export async function deliverCoreV2Invitation(input: DeliverCoreV2InvitationInput): Promise<{ messageId: string }> {
  const message = buildCoreV2InvitationMessage(input);
  const intent = await prisma.$transaction((tx) =>
    enqueueEmailIntent(tx, {
      aggregateId: input.userId,
      aggregateType: 'core-v2-invitation',
      messageType: input.role === 'ELEVE' ? 'STUDENT_ACTIVATION' : 'PARENT_ACTIVATION',
      dedupeKey: input.tokenHash,
      to: input.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  );
  kickEmailOutboxDrain();
  return { messageId: (intent as { messageId?: string }).messageId ?? '' };
}
