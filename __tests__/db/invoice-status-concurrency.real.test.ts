/** @jest-environment node */
import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';
let mockGateEnabled = false;
let mockReadCount = 0;
let mockReadBarrier: Promise<void>;
let mockReleaseReads: () => void;
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => {
  const { PrismaClient }: typeof import('@prisma/client') = jest.requireActual('@prisma/client');
  const client = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } }, log: [] });
  return { prisma: client.$extends({ query: { invoice: { findFirst: async ({ args, query }) => {
    const result = await query(args);
    if (mockGateEnabled) {
      mockReadCount += 1;
      if (mockReadCount === 2) mockReleaseReads();
      await mockReadBarrier;
    }
    return result;
  } } } }) };
});
jest.mock('@/lib/entitlement', () => ({
  activateEntitlements: jest.fn().mockResolvedValue({ created: 0, extended: 0, creditsGranted: 0,
    activatedCodes: [], noBeneficiary: false, skippedItems: 0 }),
  suspendEntitlements: jest.fn().mockResolvedValue({ suspended: 0, suspendedCodes: [] }),
  isCanonicalAriaAccessUniquenessConflict: jest.fn().mockReturnValue(false),
}));
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { activateEntitlements, suspendEntitlements } from '@/lib/entitlement';
import { PATCH } from '@/app/api/admin/invoices/[id]/route';
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
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: actorId, role: 'ADMIN' } });
  mockReadCount = 0;
  mockReadBarrier = new Promise(resolve => { mockReleaseReads = resolve; });
  mockGateEnabled = true;
});
afterEach(() => { mockGateEnabled = false; });
async function fixture(status: 'SENT' | 'DRAFT' = 'SENT') {
  return prisma.invoice.create({ data: { number: `SYNTHETIC-${randomUUID()}`, status,
    customerName: 'Synthetic fixture', createdByUserId: actorId, issuerName: 'Synthetic issuer',
    issuerAddress: 'Synthetic fixture', issuerMF: 'SYNTHETIC', total: 1000, events: [] } });
}
async function action(id: string, kind: 'CANCEL' | 'MARK_PAID' | 'MARK_SENT') {
  return PATCH(new NextRequest(`http://localhost/api/admin/invoices/${id}`, { method: 'PATCH',
    body: JSON.stringify({ action: kind, ...(kind === 'MARK_PAID'
      ? { meta: { payment: { method: 'CASH', amountPaid: 1000 } } } : {}) }),
    headers: { 'Content-Type': 'application/json' },
  }), { params: Promise.resolve({ id }) });
}
it('competing paid/cancel decisions with the same read snapshot have one winner', async () => {
  const invoice = await fixture();
  const responses = await Promise.all([action(invoice.id, 'MARK_PAID'), action(invoice.id, 'CANCEL')]);
  expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
  const winner = responses.find(response => response.status === 200);
  if (!winner) throw new Error('SYNTHETIC_WINNER_MISSING');
  const body = await winner.json();
  expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe(body.status);
  expect((activateEntitlements as jest.Mock).mock.calls.length + (suspendEntitlements as jest.Mock).mock.calls.length).toBe(1);
});
it('concurrent non-terminal MARK_SENT does not overwrite a previously accepted snapshot', async () => {
  const invoice = await fixture('DRAFT');
  const responses = await Promise.all([action(invoice.id, 'MARK_SENT'), action(invoice.id, 'MARK_SENT')]);
  expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
  mockGateEnabled = false;
  const retry = await action(invoice.id, 'MARK_SENT');
  expect(retry.status).toBe(200);
  expect((await retry.json()).noop).toBe(true);
});
it('a cancelled terminal invoice remains terminal after the losing mutation is retried', async () => {
  const invoice = await fixture();
  await prisma.invoiceAccessToken.create({ data: { invoiceId: invoice.id, createdByUserId: actorId, tokenHash: randomBytes(32).toString('hex'),
    expiresAt: new Date('2030-01-01T00:00:00Z') } });
  const responses = await Promise.all([action(invoice.id, 'CANCEL'), action(invoice.id, 'CANCEL')]);
  expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
  mockGateEnabled = false;
  const retry = await action(invoice.id, 'CANCEL');
  expect(retry.status).toBe(200);
  expect((await retry.json()).noop).toBe(true);
  expect(suspendEntitlements).toHaveBeenCalledTimes(1);
  expect(await prisma.invoiceAccessToken.count({ where: { invoiceId: invoice.id, revokedAt: { not: null } } })).toBe(1);
});
it('independent invoice transitions are not globally serialized or refused', async () => {
  const [first, second] = await Promise.all([fixture(), fixture()]);
  const responses = await Promise.all([action(first.id, 'CANCEL'), action(second.id, 'CANCEL')]);
  expect(responses.map(response => response.status)).toEqual([200, 200]);
});
