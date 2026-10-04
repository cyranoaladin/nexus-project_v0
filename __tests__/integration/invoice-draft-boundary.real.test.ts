jest.unmock('@/lib/prisma');
const mockAuth = jest.fn();
const mockRead = jest.fn();
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/invoice', () => ({
  readInvoicePDF: (...args: unknown[]) => mockRead(...args),
  verifyAccessToken: (...args: unknown[]) => jest.requireActual<typeof import('@/lib/invoice/access-token')>('@/lib/invoice/access-token').verifyAccessToken(String(args[0])),
}));
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/invoices/[id]/pdf/route';
import { createAccessToken } from '@/lib/invoice/access-token';
import { buildInvoiceAccessWhere } from '@/lib/invoice/not-found';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { cleanupDisposableTestFixture } from '@/__tests__/helpers/real-db-fixture-cleanup';

const prefix = `draft-boundary-${randomUUID()}`;
const userId = `${prefix}-parent`;
const email = `${prefix}@synthetic.test`;
let invoiceId: string;
let rawToken: string;
let verified = false;
beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''); verified = true;
  await prisma.user.create({ data: { id: userId, role: 'PARENT', email, emailVerifiedAt: new Date(), lastName: prefix } });
  await prisma.parentProfile.create({ data: { userId } });
  invoiceId = (await prisma.invoice.create({ data: { number: prefix, customerName: 'Synthetic', customerEmail: email, createdByUserId: userId, status: 'DRAFT', pdfPath: `${prefix}.pdf` } })).id;
  rawToken = (await createAccessToken(invoiceId, userId)).rawToken;
  mockAuth.mockResolvedValue({ user: { id: userId, role: 'PARENT', email } });
  mockRead.mockResolvedValue(Buffer.from('%PDF-synthetic'));
});
afterAll(async () => {
  if (verified) {
    if (invoiceId) {
      await prisma.invoiceAccessToken.deleteMany({ where: { invoiceId } });
      await prisma.invoice.deleteMany({ where: { id: invoiceId } });
    }
    await cleanupDisposableTestFixture(prisma, { userIds: [userId] });
    await prisma.$disconnect();
  }
});
test.each([false, true])('real DRAFT stays private despite PDF and token path=%s', async token => {
  mockRead.mockClear();
  const request = new NextRequest(`http://localhost/api/invoices/${invoiceId}/pdf${token ? `?token=${rawToken}` : ''}`);
  const response = await GET(request, { params: Promise.resolve({ id: invoiceId }) });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  expect(mockRead).not.toHaveBeenCalled();
  const where = await buildInvoiceAccessWhere(invoiceId, { id: userId, role: 'PARENT', email });
  expect(where).not.toBeNull();
  expect(await prisma.invoice.findFirst({ where: where! })).toBeNull();
});
test('the same persisted token reads only after explicit publication', async () => {
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'SENT' } });
  const response = await GET(new NextRequest(`http://localhost/api/invoices/${invoiceId}/pdf?token=${rawToken}`), { params: Promise.resolve({ id: invoiceId }) });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});
