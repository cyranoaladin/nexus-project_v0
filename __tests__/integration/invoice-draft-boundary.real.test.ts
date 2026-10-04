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

const prefix = `draft-boundary-${randomUUID()}`;
const userId = `${prefix}-parent`;
const email = `${prefix}@synthetic.test`;
let invoiceId: string;
let rawToken: string;
beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await prisma.user.create({ data: { id: userId, role: 'PARENT', email, emailVerifiedAt: new Date(), lastName: prefix } });
  await prisma.parentProfile.create({ data: { userId } });
  invoiceId = (await prisma.invoice.create({ data: { number: prefix, customerName: 'Synthetic', customerEmail: email, createdByUserId: userId, payerUserId: userId, status: 'DRAFT', pdfPath: `${prefix}.pdf` } })).id;
  rawToken = (await createAccessToken(invoiceId, userId)).rawToken;
  mockAuth.mockResolvedValue({ user: { id: userId, role: 'PARENT', email } });
  mockRead.mockResolvedValue(Buffer.from('%PDF-synthetic'));
});
afterAll(async () => {
  // These uniquely named synthetic records live only in the guarded disposable DB.
  // Preserve append-only download evidence; the harness disposes the instance.
  await prisma.$disconnect();
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
  expect(await prisma.invoiceFinancialAccessAudit.count({ where: { invoiceId, actorUserId: userId, action: 'PDF_READ' } })).toBe(1);
});
test('a published signed link still refuses an anonymous reader', async () => {
  mockAuth.mockResolvedValue(null); mockRead.mockClear();
  const response = await GET(new NextRequest(`http://localhost/api/invoices/${invoiceId}/pdf?token=${rawToken}`), { params: Promise.resolve({ id: invoiceId }) });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  expect(mockRead).not.toHaveBeenCalled();
});
test('a published signed link still refuses an out-of-scope parent', async () => {
  mockAuth.mockResolvedValue({ user: { id: `${prefix}-unrelated`, role: 'PARENT' } }); mockRead.mockClear();
  const response = await GET(new NextRequest(`http://localhost/api/invoices/${invoiceId}/pdf?token=${rawToken}`), { params: Promise.resolve({ id: invoiceId }) });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  expect(mockRead).not.toHaveBeenCalled();
});
