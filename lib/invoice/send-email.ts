/**
 * Invoice email sender — uses nodemailer transporter from lib/email pattern.
 * Separated from template for testability.
 *
 * Prod requirement: EMAIL_FROM (or SMTP_FROM) env var must be set.
 * In dev without SMTP_HOST, falls back to localhost:1025 (MailHog/MailCatcher).
 */

import { queueCommittedEmail } from '@/lib/email/queue';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import type { Prisma } from '@prisma/client';
import {
  getInvoiceEmailSubject,
  renderInvoiceEmailHtml,
  renderInvoiceEmailText,
} from './email-template';
import type { InvoiceEmailData } from './email-template';

/** Enqueue inside the caller's business transaction; never dispatch before commit. */
export async function enqueueInvoiceEmail(
  transaction: Pick<Prisma.TransactionClient, 'jobOutbox'>,
  input: Readonly<{ invoiceId: string; operationKey: string; recipientEmail: string; data: InvoiceEmailData; now: Date }>,
) {
  return enqueueEmailIntent(transaction, {
    aggregateType: 'INVOICE', aggregateId: input.invoiceId,
    messageType: 'TRANSACTIONAL_NOTIFICATION', dedupeKey: input.operationKey,
    to: input.recipientEmail,
    subject: getInvoiceEmailSubject(input.data.invoiceNumber),
    html: renderInvoiceEmailHtml(input.data), text: renderInvoiceEmailText(input.data),
    replyTo: process.env.EMAIL_REPLY_TO || undefined, now: input.now,
  });
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
