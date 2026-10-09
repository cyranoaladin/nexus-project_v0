import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { GET as pending } from '@/app/api/payments/pending/route';
import { POST as validate } from '@/app/api/payments/validate/route';
import { GET as invoices, POST as create } from '@/app/api/admin/invoices/route';
import { PATCH } from '@/app/api/admin/invoices/[id]/route';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/invoice', () => ({
  canPerformStatusAction: jest.requireActual('@/lib/invoice/transitions').canPerformStatusAction,
  validateTransition: jest.fn(), createInvoiceEvent: jest.fn(), appendInvoiceEvent: jest.fn(),
  generateInvoiceNumber: jest.fn(), renderInvoicePDF: jest.fn(), storeInvoicePDF: jest.fn(), getInvoiceUrl: jest.fn(),
  assertMillimes: jest.fn(),
}));
const endpoint = 'http://localhost/api/synthetic-financial';
beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-read-only', role: 'ASSISTANTE' } });
  (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.invoice.count as jest.Mock).mockResolvedValue(0);
});
it.each(['pending', 'invoices', 'validate', 'create', 'status'])('financial %s response is private even for refusal', async route => {
  const response = route === 'pending' ? await pending()
    : route === 'invoices' ? await invoices(new NextRequest(endpoint))
    : route === 'validate' ? await validate(new NextRequest(endpoint, { method: 'POST' }))
    : route === 'create' ? await create(new NextRequest(endpoint, { method: 'POST' }))
    : await PATCH(new NextRequest(endpoint, { method: 'PATCH' }), { params: Promise.resolve({ id: 'synthetic-invoice' }) });
  expect(response.status).toBe(route === 'pending' || route === 'invoices' ? 200 : route === 'status' ? 404 : 403);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('vary')?.split(/,\s*/)).toEqual(expect.arrayContaining(['Cookie', 'Authorization']));
});
it('pending payment database errors never serialize private details into logs or the response', async () => {
  const error = new Error('SYNTHETIC_PRIVATE_ERROR_DETAIL');
  (prisma.payment.findMany as jest.Mock).mockRejectedValue(error);
  const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = await pending();
    expect(response.status).toBe(500);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(error.message);
    expect(JSON.stringify(await response.json())).not.toContain(error.message);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  } finally { logger.mockRestore(); }
});

it.each(['invoices', 'validate', 'status'])('%s database failure logs only a fixed financial marker', async route => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-admin', role: 'ADMIN' } });
  const error = new Error('SYNTHETIC_PRIVATE_ERROR_DETAIL');
  (prisma.invoice.findMany as jest.Mock).mockRejectedValue(error);
  (prisma.invoice.findFirst as jest.Mock).mockRejectedValue(error);
  (prisma.payment.findUnique as jest.Mock).mockRejectedValue(error);
  const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = route === 'invoices' ? await invoices(new NextRequest(endpoint))
      : route === 'validate' ? await validate(new NextRequest(endpoint, {
        method: 'POST', body: JSON.stringify({ paymentId: 'synthetic-payment', action: 'approve' }),
      })) : await PATCH(new NextRequest(endpoint, { method: 'PATCH', body: JSON.stringify({ action: 'CANCEL' }) }),
        { params: Promise.resolve({ id: 'synthetic-invoice' }) });
    expect(response.status).toBe(500);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(error.message);
    expect(JSON.stringify(await response.json())).not.toContain(error.message);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  } finally { logger.mockRestore(); }
});
