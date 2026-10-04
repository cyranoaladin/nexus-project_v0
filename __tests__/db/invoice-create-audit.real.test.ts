/** @jest-environment node */
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';
let mockFailCreationAudit = false;
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => {
  const { PrismaClient }: typeof import('@prisma/client') = jest.requireActual('@prisma/client');
  const client = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } }, log: [] });
  return { prisma: client.$extends({ query: { invoiceFinancialAccessAudit: { create: async ({ args, query }) => {
    if (mockFailCreationAudit && args.data.action === 'INVOICE_CREATED') throw new Error('SYNTHETIC_AUDIT_UNAVAILABLE');
    return query(args);
  } } } }) };
});
jest.mock('@/lib/invoice', () => ({
  ...jest.requireActual('@/lib/invoice'),
  renderInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('synthetic-pdf')),
  storeInvoicePDF: jest.fn().mockResolvedValue('synthetic-storage-key'),
}));
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/admin/invoices/route';
import { renderInvoicePDF } from '@/lib/invoice';
let actorId: string;
beforeAll(async () => {
  const database = process.env.TEST_DATABASE_URL;
  if (!database) throw new Error('DISPOSABLE_DATABASE_REQUIRED');
  assertDisposablePostgresUrl(database);
  actorId = randomUUID();
  await prisma.user.create({ data: { id: actorId, role: 'ADMIN' } });
});
afterAll(async () => { await prisma.$disconnect(); });
beforeEach(() => {
  jest.clearAllMocks(); mockFailCreationAudit = false;
  (auth as jest.Mock).mockResolvedValue({ user: { id: actorId, role: 'ADMIN' } });
});
function create(number: string) {
  return POST(new NextRequest('https://nexusreussite.academy/api/admin/invoices', {
    method: 'POST', body: JSON.stringify({ number, customer: { name: 'Synthetic fixture' },
      items: [{ label: 'Synthetic fixture', qty: 1, unitPrice: 1000 }] }),
  }));
}
it('commits one private draft, its items and immutable creation evidence', async () => {
  const number = `SYNTHETIC-${randomUUID()}`;
  expect((await create(number)).status).toBe(201);
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { number }, include: { items: true } });
  expect(invoice.status).toBe('DRAFT'); expect(invoice.items).toHaveLength(1);
  expect(await prisma.invoiceFinancialAccessAudit.count({ where: { invoiceId: invoice.id,
    actorUserId: actorId, action: 'INVOICE_CREATED' } })).toBe(1);
});
it('rolls back invoice and nested items on audit failure and allows a subsequent successful operation', async () => {
  const number = `SYNTHETIC-${randomUUID()}`;
  const auditCountBefore = await prisma.invoiceFinancialAccessAudit.count({ where: { actorUserId: actorId } });
  mockFailCreationAudit = true;
  const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try { expect((await create(number)).status).toBe(500); }
  finally { logger.mockRestore(); }
  expect(await prisma.invoice.count({ where: { number } })).toBe(0);
  expect(await prisma.invoiceItem.count({ where: { invoice: { number } } })).toBe(0);
  expect(await prisma.invoiceFinancialAccessAudit.count({ where: { actorUserId: actorId } })).toBe(auditCountBefore);
  expect(renderInvoicePDF).not.toHaveBeenCalled();
  mockFailCreationAudit = false;
  expect((await create(number)).status).toBe(201);
  expect(await prisma.invoice.count({ where: { number } })).toBe(1);
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { number } });
  expect(await prisma.invoiceFinancialAccessAudit.count({ where: { invoiceId: invoice.id,
    actorUserId: actorId, action: 'INVOICE_CREATED' } })).toBe(1);
  expect(await prisma.invoiceFinancialAccessAudit.count({ where: { actorUserId: actorId } })).toBe(auditCountBefore + 1);
});
