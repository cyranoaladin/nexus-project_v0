/** Real Core PostgreSQL: account issuance must have a recoverable encrypted mail intent. */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createHousehold, inviteAccount, resendInvitation, requestPasswordReset } from '@/lib/core-v2/services';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();
const previousKey = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
beforeAll(() => { process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = randomBytes(32).toString('hex'); });
afterAll(() => {
  if (previousKey === undefined) delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
  else process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = previousKey;
});

async function pendingParent() {
  const { parent } = await createHousehold(h.client, h.ctx(), { parent: {
    firstName: 'Synthetic', lastName: 'Parent', email: 'handoff-parent@example.test',
  } });
  return parent;
}

test('invitation issuance commits one durable encrypted handoff without a raw proof in the row', async () => {
  const parent = await pendingParent();
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  const jobs = await h.client.coreV2JobOutbox.findMany({ where: { aggregateType: 'ACCOUNT_EMAIL_HANDOFF', aggregateId: issued.invitation.id } });
  expect(jobs.length).toBe(1);
  expect(jobs[0].status).toBe('PENDING');
  expect(JSON.stringify(jobs).includes(issued.rawToken)).toBe(false);
  expect(JSON.stringify(jobs).includes(issued.email)).toBe(false);
});

test('resend retains a durable intent for each issuance while revoking the earlier proof', async () => {
  const parent = await pendingParent();
  const first = await inviteAccount(h.client, h.ctx(), parent.id);
  const second = await resendInvitation(h.client, h.ctx(), parent.id);
  expect((await h.client.invitation.findUniqueOrThrow({ where: { id: first.invitation.id } })).revokedAt !== null).toBe(true);
  expect(await h.client.coreV2JobOutbox.count({ where: {
    aggregateType: 'ACCOUNT_EMAIL_HANDOFF', aggregateId: { in: [first.invitation.id, second.invitation.id] },
  } })).toBe(2);
});

test('password-reset issuance commits a handoff independently of V1 availability', async () => {
  const parent = await pendingParent();
  await h.client.user.update({ where: { id: parent.id }, data: {
    accountStatus: 'ACTIVE', password: await bcrypt.hash('change_me_handoff_fixture', 4),
  } });
  const issued = await requestPasswordReset(h.client, { email: parent.email! });
  expect(issued !== null).toBe(true);
  const jobs = await h.client.coreV2JobOutbox.findMany({ where: { aggregateType: 'ACCOUNT_EMAIL_HANDOFF', aggregateId: issued!.resetId } });
  expect(jobs.length).toBe(1);
  expect(JSON.stringify(jobs).includes(issued!.rawToken)).toBe(false);
});

test('missing encryption configuration refuses issuance without leaving an invitation or issuance audit', async () => {
  const parent = await pendingParent();
  const key = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
  let rejected = false;
  try {
    delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
    try { await inviteAccount(h.client, h.ctx(), parent.id); }
    catch (error) { rejected = error instanceof Error && error.message === 'ACCOUNT_EMAIL_HANDOFF_KEY_INVALID'; }
  } finally {
    if (key === undefined) delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
    else process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = key;
  }
  expect(rejected).toBe(true);
  expect(await h.client.invitation.count({ where: { userId: parent.id } })).toBe(0);
  expect(await h.client.auditEvent.count({ where: { action: 'account.invited' } })).toBe(0);
});

test('the database rejects a plaintext proof field in the handoff envelope', async () => {
  const parent = await pendingParent();
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  const job = await h.client.coreV2JobOutbox.findUniqueOrThrow({ where: { id: issued.handoffId } });
  const payload = JSON.stringify({ ...(job.payload as Record<string, unknown>), rawToken: issued.rawToken });
  let databaseCode = '';
  try {
    await h.client.$executeRaw`UPDATE core_v2_job_outbox SET "payload" = ${payload}::jsonb WHERE "id" = ${job.id}`;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'meta' in error &&
      typeof error.meta === 'object' && error.meta !== null && 'code' in error.meta &&
      typeof error.meta.code === 'string') databaseCode = error.meta.code;
  }
  expect(databaseCode).toBe('23514');
  const stored = await h.client.coreV2JobOutbox.findUniqueOrThrow({ where: { id: job.id } });
  expect(JSON.stringify(stored.payload).includes(issued.rawToken)).toBe(false);
});
