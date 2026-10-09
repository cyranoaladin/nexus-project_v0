jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { randomBytes } from 'node:crypto';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { decryptEmailIntent } from '@/lib/email/outbox';
import { transferAccountEmailHandoff } from '@/lib/core-v2/accounts/email-handoff-destination';
import { drainAccountEmailHandoffs } from '@/lib/core-v2/accounts/email-handoff-worker';
import { createHousehold, inviteAccount } from '@/lib/core-v2/services';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();
const previousOrigin = process.env.NEXTAUTH_URL;
const previousKey = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
const aggregateIds: string[] = [];
beforeAll(() => {
  assertDisposablePostgresUrl(process.env.DATABASE_URL ?? '');
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = randomBytes(32).toString('hex');
});
afterAll(async () => {
  await prisma.jobOutbox.deleteMany({ where: { aggregateId: { in: aggregateIds }, aggregateType: 'core-v2-invitation' } });
  await prisma.$disconnect();
  if (previousOrigin === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = previousOrigin;
  if (previousKey === undefined) delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY; else process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = previousKey;
});

test('real Core retry after a committed V1 intent preserves exactly one encrypted message and Message-ID', async () => {
  const { parent } = await createHousehold(h.client, h.ctx(), { parent: {
    firstName: 'Synthetic', lastName: 'Destination', email: 'synthetic-destination@example.test',
  } });
  aggregateIds.push(parent.id);
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  const at = new Date(issued.invitation.createdAt.getTime() + 1000);
  const first = await drainAccountEmailHandoffs(h.client, {
    now: () => at, owner: 'synthetic-destination-lost-ack',
    transfer: async (content) => { await transferAccountEmailHandoff(content); throw new Error('SYNTHETIC_LOST_ACK'); },
  });
  expect(first.retried).toBe(1);
  expect(kickEmailOutboxDrain).not.toHaveBeenCalled();
  const before = await prisma.jobOutbox.findMany({ where: { aggregateId: parent.id, aggregateType: 'core-v2-invitation' } });
  expect(before.length).toBe(1);
  expect(JSON.stringify(before).includes(issued.rawToken)).toBe(false);
  const messageId = decryptEmailIntent(before[0].payload).content.messageId;
  const second = await drainAccountEmailHandoffs(h.client, {
    now: () => new Date(at.getTime() + 60_000), owner: 'synthetic-destination-recovered', transfer: transferAccountEmailHandoff,
  });
  expect(second.completed).toBe(1);
  const after = await prisma.jobOutbox.findMany({ where: { aggregateId: parent.id, aggregateType: 'core-v2-invitation' } });
  expect(after.length).toBe(1);
  expect(after[0].id === before[0].id).toBe(true);
  expect(decryptEmailIntent(after[0].payload).content.messageId === messageId).toBe(true);
  expect(JSON.stringify(after[0].payload) === JSON.stringify(before[0].payload)).toBe(true);
});
