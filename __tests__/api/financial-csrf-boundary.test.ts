import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { POST as create } from '@/app/api/admin/invoices/route';
import { PATCH as status } from '@/app/api/admin/invoices/[id]/route';
import { POST as send } from '@/app/api/admin/invoices/[id]/send/route';
import { POST as validate } from '@/app/api/payments/validate/route';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/invoice', () => ({
  canPerformStatusAction: jest.requireActual('@/lib/invoice/transitions').canPerformStatusAction,
  validateTransition: jest.fn(), createInvoiceEvent: jest.fn(), appendInvoiceEvent: jest.fn(),
  generateInvoiceNumber: jest.fn(), renderInvoicePDF: jest.fn(), storeInvoicePDF: jest.fn(), getInvoiceUrl: jest.fn(),
  assertMillimes: jest.fn(), TOKEN_EXPIRY_HOURS: 72,
}));
const originalEnv = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...process.env, NODE_ENV: 'production' };
  delete process.env.NEXTAUTH_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-admin', role: 'ADMIN' } });
});
afterEach(() => { process.env = { ...originalEnv }; });
describe.each(['create', 'status', 'send', 'validate'])('%s financial mutation', route => {
  it('accepts the configured origin and preserves business validation', async () => {
    const request = new NextRequest('https://nexusreussite.academy/api/synthetic-financial', {
      method: route === 'status' ? 'PATCH' : 'POST',
      headers: { origin: 'https://nexusreussite.academy' }, body: '{}',
    });
    const params = { params: Promise.resolve({ id: 'synthetic-invoice' }) };
    const response = route === 'create' ? await create(request)
      : route === 'status' ? await status(request, params)
      : route === 'send' ? await send(request, params) : await validate(request);
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each(['https://hostile.example', 'null', 'https://nexusreussite.academy.hostile.example', undefined])(
    'rejects untrusted origin %s before reading the body or accessing financial data', async origin => {
      const request = new NextRequest('https://nexusreussite.academy/api/synthetic-financial', {
        method: route === 'status' ? 'PATCH' : 'POST',
        headers: origin ? { origin } : {}, body: '{}',
      });
      const read = jest.spyOn(request, 'json');
      const params = { params: Promise.resolve({ id: 'synthetic-invoice' }) };
      const response = route === 'create' ? await create(request)
        : route === 'status' ? await status(request, params)
        : route === 'send' ? await send(request, params) : await validate(request);
      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(read).not.toHaveBeenCalled();
      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
