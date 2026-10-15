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

import nodemailer from 'nodemailer9';
import net from 'node:net';
import tls from 'node:tls';
import type Mail from 'nodemailer9/lib/mailer';
import type SMTPTransport from 'nodemailer9/lib/smtp-transport';
import { LEGAL } from '@/lib/legal';

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
  /** Stable RFC Message-ID supplied by the durable delivery intent. */
  messageId?: string;
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
  const configured = (
    process.env.MAIL_FROM ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM
  );
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('SMTP_FROM_REQUIRED');
  return `${LEGAL.entity.tradeName} <${LEGAL.contact.email}>`;
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
 * The host must be configured explicitly in every environment that sends mail.
 */
function smtpTransportOptions(): SMTPTransport.Options {
  if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST_REQUIRED');

  const smtpPassword = resolveSmtpPassword();

  const config: SMTPTransport.Options = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10_000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10_000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15_000),
  };

  if (process.env.SMTP_USER && smtpPassword) {
    config.auth = {
      user: process.env.SMTP_USER,
      pass: smtpPassword,
    };
  }

  return config;
}

export function getTransporter(): Mail {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport(smtpTransportOptions());
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
export async function sendMail(options: SendMailOptions, control?: { deadlineAt: Date; signal?: AbortSignal }): Promise<SendMailResult> {
  if (isMailDisabled()) {
    return { ok: true, skipped: true };
  }
  const from = resolveFrom();
  const replyTo = options.replyTo || resolveReplyTo();

  let socket: net.Socket | undefined;
  let timer: NodeJS.Timeout | undefined;
  let abort: (() => void) | undefined;
  let stopped = false;
  let interrupted: Promise<never> | undefined;
  let transporter: Mail;
  if (control) {
    const budget = control.deadlineAt.getTime() - Date.now();
    if (!Number.isFinite(budget) || budget <= 0 || control.signal?.aborted)
      throw Object.assign(new Error('SMTP_DEADLINE_EXCEEDED'), { code: 'ETIMEDOUT' });
    const config = smtpTransportOptions();
    interrupted = new Promise<never>((_resolve, reject) => {
      abort = () => {
        stopped = true;
        const failure = Object.assign(new Error('SMTP_DEADLINE_EXCEEDED'), { code: 'ETIMEDOUT' });
        // This is the actual connected TCP socket, including the underlying STARTTLS socket.
        reject(failure);
        socket?.destroy();
      };
      timer = setTimeout(abort, budget);
      control.signal?.addEventListener('abort', abort, { once: true });
    });
    config.connectionTimeout = Math.min(config.connectionTimeout ?? budget, budget);
    config.greetingTimeout = Math.min(config.greetingTimeout ?? budget, budget);
    config.socketTimeout = Math.min(config.socketTimeout ?? budget, budget);
    config.getSocket = (_options, callback) => {
      if (stopped) { callback(Object.assign(new Error('SMTP_DEADLINE_EXCEEDED'), { code: 'ETIMEDOUT' })); return; }
      const host = config.host!;
      socket = config.secure
        ? tls.connect({ host, port: Number(config.port), servername: net.isIP(host) ? undefined : host })
        : net.connect({ host, port: Number(config.port) });
      let returned = false;
      socket.on('error', error => { if (!returned) { returned = true; callback(error); } });
      socket.once(config.secure ? 'secureConnect' : 'connect', () => {
        if (returned || stopped) { socket?.destroy(); return; }
        returned = true;
        callback(null, { connection: socket });
      });
    };
    transporter = nodemailer.createTransport(config);
  } else transporter = getTransporter();

  try {
    const pending = transporter.sendMail({
      from,
      replyTo,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      messageId: options.messageId,
    });
    const info = interrupted ? await Promise.race([pending, interrupted]) : await pending;

    const messageId = typeof info?.messageId === 'string' ? info.messageId : undefined;
    return { ok: true, messageId };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'SMTP_SEND_FAILED';
    console.error('[mailer] Send failed', { code, at: new Date().toISOString() });

    if (process.env.NODE_ENV === 'development') {
      return { ok: false };
    }

    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (abort) control?.signal?.removeEventListener('abort', abort);
    if (control) { socket?.destroy(); transporter.close(); }
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
    const code = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'SMTP_VERIFY_FAILED';
    console.error('[mailer] SMTP verify failed', { code, at: new Date().toISOString() });
    return { ok: false, error: code };
  }
}
