import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';

/** Awaited append-only evidence of an authorized, prepared response, not proof of client receipt. */
export async function recordInvoiceDownload(input: Readonly<{
  invoiceId: string;
  actorUserId: string;
  action: 'PDF_READ' | 'RECEIPT_READ';
}>): Promise<void> {
  await prisma.invoiceFinancialAccessAudit.create({
    data: { ...input, requestKey: `invoice-access:${randomUUID()}` },
  });
}
