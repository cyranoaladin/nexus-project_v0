/**
 * Invoice email sender — uses nodemailer transporter from lib/email pattern.
 * Separated from template for testability.
 *
 * Prod requirement: EMAIL_FROM (or SMTP_FROM) env var must be set.
 * In dev without SMTP_HOST, falls back to localhost:1025 (MailHog/MailCatcher).
 */

import nodemailer from 'nodemailer';
import {
  getInvoiceEmailSubject,
  renderInvoiceEmailHtml,
  renderInvoiceEmailText,
} from './email-template';
import type { InvoiceEmailData } from './email-template';

// ─── Transporter (same pattern as lib/email.ts) ─────────────────────────────

function createTransporter() {
  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      secure: false,
      ignoreTLS: true,
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

/**
 * Resolve the sender address. In production, EMAIL_FROM (or SMTP_FROM) is required.
 * @throws Error in production if neither EMAIL_FROM nor SMTP_FROM is set.
 */
function resolveFrom(): string {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from && process.env.NODE_ENV === 'production') {
    throw new Error('[Invoice] EMAIL_FROM or SMTP_FROM env var is required in production.');
  }
  return from || 'Nexus Réussite <contact@nexusreussite.academy>';
}

// ─── Send ────────────────────────────────────────────────────────────────────

/**
 * Send an invoice email to the customer.
 *
 * @param recipientEmail - Customer email address
 * @param data - Invoice email data (number, name, total, pdfUrl, expiryHours)
 * @throws Error if email sending fails (in production) or EMAIL_FROM missing in prod
 */
export async function sendInvoiceEmail(
  recipientEmail: string,
  data: InvoiceEmailData
): Promise<void> {
  const subject = getInvoiceEmailSubject(data.invoiceNumber);
  const html = renderInvoiceEmailHtml(data);
  const text = renderInvoiceEmailText(data);

  const from = resolveFrom();
  const replyTo = process.env.EMAIL_REPLY_TO || undefined;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from,
      replyTo,
      to: recipientEmail,
      subject,
      html,
      text,
    });
    console.log(`[Invoice] Email envoyé à ${recipientEmail} pour facture ${data.invoiceNumber}`);
  } catch (error) {
    console.error('[Invoice] Erreur envoi email:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log('[Invoice] Email non envoyé en mode développement');
      return;
    }
    throw error;
  }
}
