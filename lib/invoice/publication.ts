/** Closed publication boundary for external or family invoice reads. */
export function isPublishedInvoiceStatus(status: unknown): boolean {
  return status === 'SENT' || status === 'PAID' || status === 'CANCELLED';
}
