import type { Prisma } from '@prisma/client';

/** Durable send evidence, appended only by the MARK_SENT transition. */
const SENT_EVIDENCE_TYPE = 'INVOICE_SENT';

/**
 * Closed publication boundary for external or family invoice reads.
 * SENT and PAID are published by construction. CANCELLED alone proves nothing:
 * DRAFT → CANCELLED never reached the family, so it needs prior send evidence.
 */
export const PUBLISHED_INVOICE_WHERE: Prisma.InvoiceWhereInput = {
  OR: [
    { status: { in: ['SENT', 'PAID'] } },
    { status: 'CANCELLED', events: { array_contains: [{ type: SENT_EVIDENCE_TYPE }] } },
  ],
};

/** In-memory twin of PUBLISHED_INVOICE_WHERE for rows already read. */
export function isPublishedInvoice(invoice: { status: unknown; events?: unknown }): boolean {
  if (invoice.status === 'SENT' || invoice.status === 'PAID') return true;
  return invoice.status === 'CANCELLED'
    && Array.isArray(invoice.events)
    && invoice.events.some(event => (event as { type?: unknown } | null)?.type === SENT_EVIDENCE_TYPE);
}
