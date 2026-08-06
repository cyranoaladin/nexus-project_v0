/**
 * Invoice email sender — uses nodemailer transporter from lib/email pattern.
 * Separated from template for testability.
 *
 * Prod requirement: EMAIL_FROM (or SMTP_FROM) env var must be set.
 * In dev without SMTP_HOST, falls back to localhost:1025 (MailHog/MailCatcher).
 */

import { queueCommittedEmail } from '@/lib/email/queue';
import {
  getInvoiceEmailSubject,
  renderInvoiceEmailHtml,
  renderInvoiceEmailText,
} from './email-template';
import type { InvoiceEmailData } from './email-template';

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

  const replyTo = process.env.EMAIL_REPLY_TO || undefined;
  await queueCommittedEmail({
    aggregateType: 'INVOICE',
    aggregateKey: data.invoiceNumber,
    dedupeKey: data.invoiceNumber,
    replyTo,
    to: recipientEmail,
    subject,
    html,
    text,
  });
}
