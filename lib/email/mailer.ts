/**
 * Centralized SMTP mailer for Nexus Réussite.
 *
 * Single source of truth for nodemailer transport configuration.
 * Reads SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS (or SMTP_PASSWORD),
 * MAIL_FROM, MAIL_REPLY_TO from environment.
 *
 * Safety:
 * - MAIL_DISABLED=true  → no email is ever sent (returns { skipped: true }).
 * - NODE_ENV=test        → MAIL_DISABLED defaults to true.
 * - Logs never contain recipient addresses or message bodies.
 */

import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SendMailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject */
  subject: string;
  /** HTML body */
  html: string;
  /** Plain-text fallback (recommended for deliverability) */
  text?: string;
  /** Override default reply-to */
  replyTo?: string;
}

export interface SendMailResult {
  /** true if the email was actually sent */
  ok: boolean;
  /** nodemailer messageId (only when sent) */
  messageId?: string;
  /** true if sending was skipped (MAIL_DISABLED) */
  skipped?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns true when email sending is disabled.
 * Disabled when MAIL_DISABLED=true or NODE_ENV=test (unless MAIL_DISABLED=false explicitly).
 */
export function isMailDisabled(): boolean {
  const explicit = process.env.MAIL_DISABLED;
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  // Default: disabled in test environment
  return process.env.NODE_ENV === 'test';
}

/**
 * Resolve the SMTP password from env (supports both SMTP_PASS and SMTP_PASSWORD).
 */
function resolveSmtpPassword(): string | undefined {
  return process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
}

/**
 * Resolve the sender address from env.
 * Priority: MAIL_FROM > EMAIL_FROM > SMTP_FROM > fallback.
 */
export function resolveFrom(): string {
  return (
    process.env.MAIL_FROM ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    'Nexus Réussite <no-reply@nexusreussite.academy>'
  );
}

/**
 * Resolve the reply-to address from env.
 */
export function resolveReplyTo(): string | undefined {
  return process.env.MAIL_REPLY_TO || process.env.EMAIL_REPLY_TO;
}

// ─── Transport ──────────────────────────────────────────────────────────────

let _transporter: Mail | null = null;

/**
 * Get or create the nodemailer transporter (singleton).
 * In development without SMTP_HOST, falls back to localhost:1025 (Mailpit/MailHog).
 */
export function getTransporter(): Mail {
  if (_transporter) return _transporter;

  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      secure: false,
      ignoreTLS: true,
    } as SMTPTransport.Options);
    return _transporter;
  }

  const smtpPassword = resolveSmtpPassword();

  const config: SMTPTransport.Options = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
  };

  if (process.env.SMTP_USER && smtpPassword) {
    config.auth = {
      user: process.env.SMTP_USER,
      pass: smtpPassword,
    };
  }

  _transporter = nodemailer.createTransport(config);
  return _transporter;
}

/**
 * Reset the cached transporter (useful for tests).
 */
export function resetTransporter(): void {
  _transporter = null;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Send an email via the centralized SMTP transport.
 *
 * When MAIL_DISABLED=true (or NODE_ENV=test), returns { ok: true, skipped: true }
 * without touching the network.
 *
 * @throws Error if sending fails in production.
 */
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  if (isMailDisabled()) {
    console.log(`[mailer] Skipped (MAIL_DISABLED): subject="${options.subject}"`);
    return { ok: true, skipped: true };
  }

  const transporter = getTransporter();
  const from = resolveFrom();
  const replyTo = options.replyTo || resolveReplyTo();

  try {
    const info = await transporter.sendMail({
      from,
      replyTo,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    const messageId = typeof info?.messageId === 'string' ? info.messageId : undefined;
    console.log(`[mailer] Sent: messageId=${messageId ?? 'unknown'}`);
    return { ok: true, messageId };
  } catch (error) {
    console.error('[mailer] Send failed:', error instanceof Error ? error.message : 'unknown');

    if (process.env.NODE_ENV === 'development') {
      console.log('[mailer] Swallowed in development');
      return { ok: false };
    }

    throw error;
  }
}

/**
 * Verify SMTP connection (useful for health checks).
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (isMailDisabled()) {
    return { ok: true };
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[mailer] SMTP verify failed:', message);
    return { ok: false, error: message };
  }
}
