/** @jest-environment node */
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
const enqueue = jest.fn();
const kick = jest.fn();
jest.mock('@/auth', () => ({ auth: jest.fn(async () => ({ user: { id: 'synthetic-staff', role: 'ADMIN' } })) }));
jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: (...args: unknown[]) => enqueue(...args) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: () => kick() }));
import { POST } from '@/app/api/admin/invoices/[id]/send/route';
const operation = randomUUID();
function request(key: string | null = operation) {
  return new NextRequest('http://localhost/api/admin/invoices/synthetic-invoice/send', {
    method: 'POST', headers: key === null ? {} : { 'Idempotency-Key': key },
  });
}
const params = { params: Promise.resolve({ id: 'synthetic-invoice' }) };
beforeEach(() => {
  jest.clearAllMocks();
  (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
    id: 'synthetic-invoice', number: 'SYNTHETIC-ONLY', status: 'SENT', total: 1000,
    customerName: 'Synthetic fixture', payerUserId: 'synthetic-payer',
    payer: { id: 'synthetic-payer', email: 'fixture@synthetic.test', emailVerifiedAt: new Date() }, events: [],
  });
  (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'synthetic-invoice' }]);
  (prisma.invoiceFinancialAccessAudit.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.invoiceFinancialAccessAudit.count as jest.Mock).mockResolvedValue(0);
  (prisma.invoiceFinancialAccessAudit.create as jest.Mock).mockResolvedValue({ id: 'synthetic-audit' });
  (prisma.invoiceAccessToken.create as jest.Mock).mockResolvedValue({ id: 'synthetic-token-id' });
  enqueue.mockResolvedValue({ id: 'synthetic-outbox', sourceEventKey: 'synthetic-event' });
});
it.each([null, '', 'not-an-operation-key'])('requires a bounded explicit operation key before business writes', async key => {
  const response = await POST(request(key), params);
  expect(response.status).toBe(400);
  expect(prisma.invoiceAccessToken.create).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
});
it('commits token, intent and append-only queue evidence through one transaction', async () => {
  const response = await POST(request(), params);
  expect(response.status).toBe(202);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  expect(prisma.invoiceFinancialAccessAudit.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    invoiceId: 'synthetic-invoice', actorUserId: 'synthetic-staff', action: 'INVOICE_EMAIL_QUEUED',
  }) }));
  expect(prisma.invoice.update).not.toHaveBeenCalled();
  expect(kick).toHaveBeenCalledTimes(1);
});
it('replays the same operation without creating another nonce or intention', async () => {
  (prisma.invoiceFinancialAccessAudit.findUnique as jest.Mock).mockResolvedValue({ occurredAt: new Date('2026-10-04T12:00:00Z') });
  const response = await POST(request(), params);
  expect(response.status).toBe(202);
  expect(await response.json()).not.toHaveProperty('sentTo');
  expect(prisma.invoiceAccessToken.create).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
  expect(prisma.invoiceFinancialAccessAudit.create).not.toHaveBeenCalled();
});
it('counts committed queue requests before generating another nonce', async () => {
  (prisma.invoiceFinancialAccessAudit.count as jest.Mock).mockResolvedValue(3);
  const response = await POST(request(), params);
  expect(response.status).toBe(429);
  expect(prisma.invoiceAccessToken.create).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
});
it('a new resend operation receives a distinct outbox dedupe key', async () => {
  expect((await POST(request(), params)).status).toBe(202);
  expect((await POST(request(randomUUID()), params)).status).toBe(202);
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(enqueue.mock.calls[0][1].dedupeKey).not.toEqual(enqueue.mock.calls[1][1].dedupeKey);
  expect(prisma.invoiceAccessToken.create).toHaveBeenCalledTimes(2);
});
it('outbox failure is not recorded as successful queue acceptance or dispatched', async () => {
  enqueue.mockRejectedValueOnce(new Error('SYNTHETIC_OUTBOX_FAILURE'));
  const logging = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = await POST(request(), params);
    expect(response.status).toBe(500);
    expect(prisma.invoiceFinancialAccessAudit.create).not.toHaveBeenCalled();
    expect(kick).not.toHaveBeenCalled();
    expect(logging).toHaveBeenCalledWith('INVOICE_EMAIL_REQUEST_FAILED');
    expect(JSON.stringify(logging.mock.calls)).not.toContain('SYNTHETIC_OUTBOX_FAILURE');
  } finally { logging.mockRestore(); }
});
