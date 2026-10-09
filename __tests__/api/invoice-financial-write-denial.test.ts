import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PATCH } from '@/app/api/admin/invoices/[id]/route';
import { POST as send } from '@/app/api/admin/invoices/[id]/send/route';
import { queueInvoiceEmailRequest } from '@/lib/invoice/queue-email-request';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/invoice', () => ({
  canPerformStatusAction: jest.requireActual('@/lib/invoice/transitions').canPerformStatusAction,
  validateTransition: jest.fn(), createInvoiceEvent: jest.fn(), appendInvoiceEvent: jest.fn(), TOKEN_EXPIRY_HOURS: 72,
}));
beforeEach(() => jest.clearAllMocks());
it.each(['ASSISTANTE', 'PARENT', 'ELEVE', 'COACH', 'UNKNOWN'])('denies %s status mutation before database access using real RBAC', async role => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-actor', role } });
  const response = await PATCH(new NextRequest('http://localhost/api/admin/invoices/synthetic-invoice', {
    method: 'PATCH', body: JSON.stringify({ action: 'MARK_PAID' }),
  }), { params: Promise.resolve({ id: 'synthetic-invoice' }) });
  expect(response.status).toBe(404);
  expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
it.each(['ASSISTANTE', 'PARENT', 'ELEVE', 'COACH', 'UNKNOWN'])('denies %s email route and direct queue service before writes', async role => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-actor', role } });
  const response = await send(new NextRequest('http://localhost/api/admin/invoices/synthetic-invoice/send', {
    method: 'POST', headers: { 'Idempotency-Key': randomUUID() },
  }), { params: Promise.resolve({ id: 'synthetic-invoice' }) });
  expect(response.status).toBe(404);
  await expect(queueInvoiceEmailRequest({ invoiceId: 'synthetic-invoice', actorUserId: 'synthetic-actor', role,
    operationKey: randomUUID() })).rejects.toMatchObject({ status: 404 });
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
