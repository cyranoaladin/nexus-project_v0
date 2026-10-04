import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { canPerformStatusAction } from './transitions';
import { createAccessToken, TOKEN_EXPIRY_HOURS } from './access-token';
import { enqueueInvoiceEmail } from './send-email';
import { millimesToDisplay } from './types';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';

export class InvoiceEmailRequestError extends Error {
  constructor(readonly status: 400 | 404 | 409 | 422 | 429) {
    super('INVOICE_EMAIL_REQUEST_REFUSED');
  }
}

/** The invoice row serializes requests; nonce, encrypted intent and evidence commit together. */
export async function queueInvoiceEmailRequest(input: Readonly<{
  invoiceId: string; actorUserId: string; role?: string; operationKey: string | null;
}>) {
  if (!input.actorUserId || !canPerformStatusAction(input.role)) throw new InvoiceEmailRequestError(404);
  if (!input.operationKey || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.operationKey)) {
    throw new InvoiceEmailRequestError(400);
  }
  const requestKey = `invoice-email:v1:${createHash('sha256')
    .update(JSON.stringify([input.invoiceId, input.actorUserId, input.operationKey.toLowerCase()])).digest('hex')}`;
  const result = await prisma.$transaction(async transaction => {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM invoices WHERE id = ${input.invoiceId} FOR UPDATE`;
    if (locked.length !== 1) throw new InvoiceEmailRequestError(404);
    const invoice = await transaction.invoice.findUnique({ where: { id: input.invoiceId }, select: {
      id: true, number: true, status: true, total: true, customerName: true, payerUserId: true,
      payer: { select: { id: true, email: true, emailVerifiedAt: true } }, events: true,
    } });
    if (!invoice) throw new InvoiceEmailRequestError(404);
    if (invoice.status !== 'SENT') throw new InvoiceEmailRequestError(409);
    const recipientEmail = invoice.payer?.email;
    if (!invoice.payerUserId || invoice.payer?.id !== invoice.payerUserId
      || !invoice.payer.emailVerifiedAt || !recipientEmail) throw new InvoiceEmailRequestError(422);
    const previous = await transaction.invoiceFinancialAccessAudit.findUnique({
      where: { requestKey }, select: { occurredAt: true },
    });
    if (previous) return { expiresAt: new Date(previous.occurredAt.getTime() + TOKEN_EXPIRY_HOURS * 3_600_000) };
    const now = new Date();
    const cutoff = new Date(now.getTime() - 86_400_000);
    const count = await transaction.invoiceFinancialAccessAudit.count({ where: {
      invoiceId: invoice.id, action: 'INVOICE_EMAIL_QUEUED', occurredAt: { gte: cutoff },
    } });
    const historical = Array.isArray(invoice.events) ? invoice.events.filter(event => {
      if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
      return (event.type === 'INVOICE_SENT_EMAIL' || event.type === 'INVOICE_EMAIL_QUEUED')
        && typeof event.at === 'string' && event.at >= cutoff.toISOString();
    }).length : 0;
    if (count + historical >= 3) throw new InvoiceEmailRequestError(429);
    const token = await createAccessToken(invoice.id, input.actorUserId, TOKEN_EXPIRY_HOURS, transaction, now);
    const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';
    await enqueueInvoiceEmail(transaction, {
      invoiceId: invoice.id, operationKey: requestKey, recipientEmail, now,
      data: { invoiceNumber: invoice.number, customerName: invoice.customerName,
        formattedTotal: millimesToDisplay(invoice.total), expiryHours: TOKEN_EXPIRY_HOURS,
        pdfUrl: `${baseUrl}/api/invoices/${invoice.id}/pdf?token=${token.rawToken}` },
    });
    await transaction.invoiceFinancialAccessAudit.create({ data: {
      invoiceId: invoice.id, actorUserId: input.actorUserId, action: 'INVOICE_EMAIL_QUEUED', requestKey, occurredAt: now,
    } });
    return { expiresAt: token.expiresAt };
  });
  kickEmailOutboxDrain();
  return result;
}
