/** @jest-environment node */
import { randomUUID, randomBytes } from 'node:crypto';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';
let mockFailAfterEnqueue = false;
jest.mock('@/lib/prisma', () => {
  const { PrismaClient } = jest.requireActual('@prisma/client');
  return { prisma: new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } }, log: [] }) };
});
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
jest.mock('@/lib/email/outbox', () => {
  const original = jest.requireActual('@/lib/email/outbox');
  return { ...original, enqueueEmailIntent: async (...args: unknown[]) => {
    const result = await original.enqueueEmailIntent(...args);
    if (mockFailAfterEnqueue) throw new Error('SYNTHETIC_FAILURE_AFTER_ENQUEUE');
    return result;
  } };
});
import { prisma } from '@/lib/prisma';
import { decryptEmailIntent } from '@/lib/email/outbox';
import { queueInvoiceEmailRequest } from '@/lib/invoice/queue-email-request';
const oldKey = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
let actorUserId: string;
let payerUserId: string;
beforeAll(async () => {
  const database = process.env.TEST_DATABASE_URL;
  if (!database) throw new Error('DISPOSABLE_DATABASE_REQUIRED');
  assertDisposablePostgresUrl(database);
  process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  actorUserId = randomUUID(); payerUserId = randomUUID();
  await prisma.user.createMany({ data: [
    { id: actorUserId, role: 'ADMIN' },
    { id: payerUserId, role: 'PARENT', email: `${payerUserId}@synthetic.test`, emailVerifiedAt: new Date() },
  ] });
});
afterAll(async () => {
  if (oldKey === undefined) delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
  else process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = oldKey;
  await prisma.$disconnect();
});
beforeEach(() => { mockFailAfterEnqueue = false; });
async function invoice() {
  return prisma.invoice.create({ data: { number: `SYNTHETIC-${randomUUID()}`, status: 'SENT',
    customerName: 'Synthetic fixture', payerUserId, createdByUserId: actorUserId,
    issuerName: 'Synthetic issuer', issuerAddress: 'Synthetic fixture only', issuerMF: 'SYNTHETIC', total: 1000 } });
}
function input(invoiceId: string, operationKey = randomUUID()) {
  return { invoiceId, actorUserId, role: 'ADMIN', operationKey };
}
async function counts(invoiceId: string) {
  return Promise.all([
    prisma.invoiceAccessToken.count({ where: { invoiceId } }),
    prisma.jobOutbox.count({ where: { aggregateId: invoiceId, aggregateType: 'INVOICE' } }),
    prisma.invoiceFinancialAccessAudit.count({ where: { invoiceId, action: 'INVOICE_EMAIL_QUEUED' } }),
  ]);
}
it('six concurrent retries commit exactly one token, encrypted intent and queue audit', async () => {
  const created = await invoice(); const request = input(created.id);
  const results = await Promise.all(Array.from({ length: 6 }, () => queueInvoiceEmailRequest(request)));
  expect(await counts(created.id)).toEqual([1, 1, 1]);
  expect(new Set(results.map(result => result.expiresAt.toISOString())).size).toBe(1);
  const intent = await prisma.jobOutbox.findFirstOrThrow({ where: { aggregateId: created.id } });
  const nonce = decryptEmailIntent(intent.payload).content.html.match(/token=([a-f0-9]{64})/)?.[1];
  expect(typeof nonce === 'string' && nonce.length === 64).toBe(true);
  if (!nonce) throw new Error('SYNTHETIC_LINK_NONCE_MISSING');
  const stored = await prisma.invoiceAccessToken.findFirstOrThrow({ where: { invoiceId: created.id } });
  expect(stored.tokenHash === nonce).toBe(false);
  expect(JSON.stringify(intent.payload).includes(nonce)).toBe(false);
  const evidence = await prisma.invoiceFinancialAccessAudit.findMany({ where: { invoiceId: created.id } });
  expect(JSON.stringify(evidence).includes(nonce)).toBe(false);
});
it('four concurrent distinct operations enforce the three-per-day invoice cap', async () => {
  const created = await invoice();
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => queueInvoiceEmailRequest(input(created.id))));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(3);
  const refused = results.filter(result => result.status === 'rejected');
  expect(refused).toHaveLength(1);
  expect(refused[0]).toMatchObject({ reason: { status: 429 } });
  expect(await counts(created.id)).toEqual([3, 3, 3]);
});
it('failure after outbox insertion rolls back nonce, intention and audit; retry succeeds', async () => {
  const created = await invoice(); const request = input(created.id);
  mockFailAfterEnqueue = true;
  await expect(queueInvoiceEmailRequest(request)).rejects.toThrow('SYNTHETIC_FAILURE_AFTER_ENQUEUE');
  expect(await counts(created.id)).toEqual([0, 0, 0]);
  mockFailAfterEnqueue = false;
  await queueInvoiceEmailRequest(request);
  expect(await counts(created.id)).toEqual([1, 1, 1]);
});
it('a new explicit resend commits a separate intention instead of colliding on invoice number', async () => {
  const created = await invoice();
  await queueInvoiceEmailRequest(input(created.id));
  await queueInvoiceEmailRequest(input(created.id));
  expect(await counts(created.id)).toEqual([2, 2, 2]);
});
