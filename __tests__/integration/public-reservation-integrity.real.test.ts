/** PostgreSQL-only: public possession of an email cannot authorize an update. */
jest.unmock('@/lib/prisma');
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/reservation/route';
const slug = `synthetic-public-${randomUUID()}`;
const contact = `${slug}@example.test`;
const invoke = (email = contact, paymentMethod?: string) => POST(new NextRequest('http://localhost:3000/api/reservation', { method: 'POST', body: JSON.stringify({
  parent: 'New synthetic name', email, phone: '55000003', classe: 'Terminale',
  academyId: slug, academyTitle: 'Untrusted title', price: 1, paymentMethod,
}) }));
beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await prisma.stage.create({ data: { slug, title: 'Canonical synthetic stage', priceAmount: 350,
    startDate: new Date('2099-08-01T00:00:00Z'), endDate: new Date('2099-08-05T00:00:00Z'), isVisible: true, isOpen: true } });
});
afterAll(async () => {
  const ids = (await prisma.stageReservation.findMany({ where: { academyId: slug }, select: { id: true } })).map(row => row.id);
  await prisma.jobOutbox.deleteMany({ where: { aggregateType: 'STAGE_RESERVATION', aggregateId: { in: ids } } });
  await prisma.stageReservation.deleteMany({ where: { academyId: slug } });
  await prisma.stage.deleteMany({ where: { slug } });
  await prisma.$disconnect();
});
test('uses server price and stage identity, then leaves the complete row unchanged on unauthenticated retry', async () => {
  expect((await invoke()).status).toBe(201);
  const before = await prisma.stageReservation.findUniqueOrThrow({ where: { email_academyId: { email: contact, academyId: slug } } });
  expect(before.price).toBe(350);
  expect(before.academyTitle).toBe('Canonical synthetic stage');
  expect(before.stageId).toBeTruthy();
  const jobCount = await prisma.jobOutbox.count({ where: { aggregateId: before.id } });
  expect((await invoke()).status).toBe(201);
  const after = await prisma.stageReservation.findUniqueOrThrow({ where: { id: before.id } });
  expect(after).toEqual(before);
  expect(await prisma.jobOutbox.count({ where: { aggregateId: before.id } })).toBe(jobCount);
});

test('concurrent first submissions preserve one row and one notification intent', async () => {
  const concurrentContact = `race-${contact}`;
  const responses = await Promise.all([invoke(concurrentContact), invoke(concurrentContact)]);
  expect(responses.map(response => response.status)).toEqual([201, 201]);
  const rows = await prisma.stageReservation.findMany({ where: { academyId: slug, email: concurrentContact } });
  expect(rows).toHaveLength(1);
  expect(rows[0].price).toBe(350);
  expect(await prisma.jobOutbox.count({ where: { aggregateId: rows[0].id } })).toBe(1);
});

test('required intent failure rolls back the lead and a later retry can commit once', async () => {
  const failureContact = `failure-${contact}`;
  const previousKey = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
  try {
    delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
    expect((await invoke(failureContact)).status).toBe(500);
    expect(await prisma.stageReservation.count({ where: { academyId: slug, email: failureContact } })).toBe(0);
  } finally {
    if (previousKey === undefined) delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
    else process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = previousKey;
  }
  expect((await invoke(failureContact)).status).toBe(201);
  const row = await prisma.stageReservation.findUniqueOrThrow({ where: { email_academyId: { email: failureContact, academyId: slug } } });
  expect(await prisma.jobOutbox.count({ where: { aggregateId: row.id } })).toBe(1);
});

test('bank-transfer acknowledgment and internal alert are durable without marking payment as paid', async () => {
  const bankContact = `bank-${contact}`;
  expect((await invoke(bankContact, 'bank_transfer')).status).toBe(201);
  const row = await prisma.stageReservation.findUniqueOrThrow({ where: { email_academyId: { email: bankContact, academyId: slug } } });
  expect(row.status).toBe('PENDING_BANK_TRANSFER');
  expect(row.paymentStatus === null || row.paymentStatus === 'PENDING').toBe(true);
  expect(row.confirmedAt).toBeNull();
  expect(await prisma.jobOutbox.count({ where: { aggregateId: row.id, status: 'PENDING' } })).toBe(2);
  expect((await invoke(bankContact, 'bank_transfer')).status).toBe(201);
  expect(await prisma.jobOutbox.count({ where: { aggregateId: row.id } })).toBe(2);
});
