/**
 * Delivery adapter for Core v2 password-reset links through the canonical
 * email outbox (retry, visibility, encryption at rest are the outbox's).
 * Plain values only — this file must stay free of any Core v2 import
 * (CORE_V2_MUST_NOT_BE_IMPORTED_BY_LIVE_RUNTIME) and never logs the token.
 * The link host comes from the trusted application origin (configuration).
 */
import { getTrustedApplicationOrigin } from '@/lib/auth/parent-activation';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { escapeHtml } from '@/lib/email/templates';
import { prisma } from '@/lib/prisma';

export const CORE_V2_PASSWORD_RESET_PATH = '/auth/reset-password';
export const CORE_V2_PASSWORD_RESET_PURPOSE = 'core-v2';

export interface CoreV2PasswordResetMessage {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly resetUrl: string;
}

function sanitizeInline(value: string): string {
  return value.replace(/[\r\n<>]/g, '').trim();
}

export function buildCoreV2PasswordResetMessage(input: { readonly displayName: string; readonly rawToken: string; readonly expiresAt: Date }): CoreV2PasswordResetMessage {
  const url = new URL(CORE_V2_PASSWORD_RESET_PATH, getTrustedApplicationOrigin());
  url.searchParams.set('purpose', CORE_V2_PASSWORD_RESET_PURPOSE);
  url.searchParams.set('token', input.rawToken);
  const resetUrl = url.toString();
  const displayName = sanitizeInline(input.displayName) || 'Bonjour';
  const validity = input.expiresAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  return {
    subject: 'Réinitialisation de votre mot de passe — Nexus Réussite',
    resetUrl,
    text: [
      `Bonjour ${displayName},`,
      '',
      'Choisissez un nouveau mot de passe avec ce lien :',
      resetUrl,
      '',
      `Ce lien est personnel, utilisable une seule fois et valable jusqu'au ${validity}.`,
      "Si vous n'avez pas demandé cette réinitialisation, ignorez ce message : votre mot de passe reste inchangé.",
    ].join('\n'),
    html: [
      `<p>Bonjour ${escapeHtml(displayName)},</p>`,
      '<p>Choisissez un nouveau mot de passe avec ce lien :</p>',
      `<p><a href="${escapeHtml(resetUrl)}">Réinitialiser mon mot de passe</a></p>`,
      `<p>Ce lien est personnel, utilisable une seule fois et valable jusqu'au ${escapeHtml(validity)}.</p>`,
      "<p>Si vous n'avez pas demandé cette réinitialisation, ignorez ce message : votre mot de passe reste inchangé.</p>",
    ].join(''),
  };
}

export interface DeliverCoreV2PasswordResetInput {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly rawToken: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

/** Enqueues the reset email; dedupe on the token hash so a retried request never sends twice. */
export async function deliverCoreV2PasswordReset(input: DeliverCoreV2PasswordResetInput): Promise<{ messageId: string }> {
  const message = buildCoreV2PasswordResetMessage(input);
  const intent = await prisma.$transaction((tx) =>
    enqueueEmailIntent(tx, {
      aggregateId: input.userId,
      aggregateType: 'core-v2-password-reset',
      messageType: 'PASSWORD_RESET',
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
