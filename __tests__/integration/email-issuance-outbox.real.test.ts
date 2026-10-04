jest.unmock('@/lib/prisma');
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { decryptEmailIntent, enqueueEmailIntentForIssuance } from '@/lib/email/outbox';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

const aggregateId = `synthetic-issuance-${randomUUID()}`;
let disposable = false;
beforeAll(() => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  disposable = true;
});
afterAll(async () => {
  if (disposable) await prisma.jobOutbox.deleteMany({ where: { aggregateId, aggregateType: 'synthetic-password-reset' } });
  await prisma.$disconnect();
});
test('concurrent retries create exactly one encrypted job with one persistent Message-ID', async () => {
  const input = { aggregateId, aggregateType: 'synthetic-password-reset', issuanceId: 'synthetic-event-1', messageType: 'PASSWORD_RESET' as const, to: 'synthetic@example.test', subject: 'Reset', html: '<p>synthetic-link</p>' };
  const results = await Promise.all(Array.from({ length: 8 }, () => prisma.$transaction(tx => enqueueEmailIntentForIssuance(tx, input))));
  expect(new Set(results.map(result => result.id)).size).toBe(1);
  expect(new Set(results.map(result => result.messageId)).size).toBe(1);
  const rows = await prisma.jobOutbox.findMany({ where: { aggregateId } });
  expect(rows).toHaveLength(1);
  expect(JSON.stringify(rows[0].payload)).not.toContain('synthetic-link');
  expect(decryptEmailIntent(rows[0].payload).content.messageId).toBe(results[0].messageId);
  const originalPayload = rows[0].payload;
  await prisma.jobOutbox.update({ where: { id: rows[0].id }, data: { status: 'COMPLETED' } });
  const retry = await prisma.$transaction(tx => enqueueEmailIntentForIssuance(tx, { ...input, html: '<p>different</p>' }));
  expect(retry).toEqual(results[0]);
  expect(await prisma.jobOutbox.findUniqueOrThrow({ where: { id: retry.id } })).toMatchObject({ status: 'COMPLETED', payload: originalPayload });
  const next = await prisma.$transaction(tx => enqueueEmailIntentForIssuance(tx, { ...input, issuanceId: 'synthetic-event-2' }));
  expect(next.id).not.toBe(retry.id);
  expect(next.messageId).not.toBe(retry.messageId);
  expect(await prisma.jobOutbox.count({ where: { aggregateId } })).toBe(2);
});
