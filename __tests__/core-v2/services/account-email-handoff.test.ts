import { openAccountEmailHandoff, sealAccountEmailHandoff } from '@/lib/email/account-handoff-envelope';
import { drainAccountEmailHandoffs } from '@/lib/core-v2/accounts/email-handoff-worker';
/** Real Core PostgreSQL: account issuance must have a recoverable encrypted mail intent. */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createHousehold, inviteAccount, resendInvitation, requestPasswordReset } from '@/lib/core-v2/services';
import { setupServiceHarness, waitForLockWaiter } from '../helpers/service-harness';

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


test('a failed transfer remains retryable and a recovered transfer uses the original issuance', async () => {
  const parent = await pendingParent();
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  const at = new Date(issued.invitation.createdAt.getTime() + 1000);
  const first = await drainAccountEmailHandoffs(h.client, {
    now: () => at, owner: 'synthetic-worker-first',
    transfer: async () => { throw new Error('synthetic-provider-failure'); },
  });
  expect(first.retried).toBe(1);
  const pending = await h.client.coreV2JobOutbox.findUniqueOrThrow({ where: { id: issued.handoffId } });
  expect(pending.status).toBe('RETRY_SCHEDULED');
  expect(pending.lastError).toBe('ACCOUNT_EMAIL_TRANSFER_FAILED');
  let sameIssuance = false;
  const second = await drainAccountEmailHandoffs(h.client, {
    now: () => new Date(at.getTime() + 60_000), owner: 'synthetic-worker-second',
    transfer: async (content) => { sameIssuance = content.issuanceId === issued.invitation.id && content.rawToken === issued.rawToken; },
  });
  expect(second.completed).toBe(1);
  expect(await h.client.auditEvent.count({ where: { action: 'account.email_handoff_transferred', subjectId: issued.invitation.id } })).toBe(1);
  expect(sameIssuance).toBe(true);
});

test('a revoked invitation is finalized without transferring its proof', async () => {
  const parent = await pendingParent();
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  await h.client.invitation.update({ where: { id: issued.invitation.id }, data: { revokedAt: issued.invitation.createdAt } });
  let transfers = 0;
  const result = await drainAccountEmailHandoffs(h.client, {
    now: () => new Date(issued.invitation.createdAt.getTime() + 1000), owner: 'synthetic-worker-revoked',
    transfer: async () => { transfers += 1; },
  });
  expect(result.discarded).toBe(1);
  expect(transfers).toBe(0);
});


test('an expired final-attempt lease is finalized instead of disappearing from recovery', async () => {
  const parent = await pendingParent();
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  const at = new Date(issued.invitation.createdAt.getTime() + 60_000);
  await h.client.coreV2JobOutbox.update({ where: { id: issued.handoffId }, data: {
    status: 'LEASED', attemptCount: 20, leaseOwner: 'synthetic-interrupted-final-worker',
    leaseExpiresAt: new Date(at.getTime() - 1),
  } });
  let transfers = 0;
  await drainAccountEmailHandoffs(h.client, { now: () => at, owner: 'synthetic-recovery-worker', transfer: async () => { transfers += 1; } });
  const job = await h.client.coreV2JobOutbox.findUniqueOrThrow({ where: { id: issued.handoffId } });
  expect(job.status).toBe('FAILED_FINAL');
  expect(job.leaseOwner === null).toBe(true);
  expect(transfers).toBe(0);
});


test('a worker whose lease has expired does not transfer a pending proof', async () => {
  const parent = await pendingParent();
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  const at = new Date(issued.invitation.createdAt.getTime() + 1000);
  let clockReads = 0; let transfers = 0;
  const result = await drainAccountEmailHandoffs(h.client, {
    owner: 'synthetic-expired-worker', limit: 1,
    now: () => new Date(at.getTime() + (clockReads++ * 31_000)),
    transfer: async () => { transfers += 1; },
  });
  expect(transfers).toBe(0);
  expect(result.leaseLost).toBe(1);
});


test('revocation waits for the eligible transfer transaction and two workers do not transfer twice', async () => {
  const parent = await pendingParent();
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  const at = new Date(issued.invitation.createdAt.getTime() + 1000);
  let release!: () => void; let entered!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { entered = resolve; });
  let transfers = 0;
  const first = drainAccountEmailHandoffs(h.client, {
    now: () => at, owner: 'synthetic-lock-worker',
    transfer: async () => { transfers += 1; entered(); await barrier; },
  });
  await ready;
  let revoked = false;
  const revoke = h.client.invitation.update({ where: { id: issued.invitation.id }, data: { revokedAt: at } }).then(() => { revoked = true; });
  try {
    await waitForLockWaiter(h.client);
    expect(revoked).toBe(false);
    const second = await drainAccountEmailHandoffs(h.client, {
      now: () => at, owner: 'synthetic-competing-worker', transfer: async () => { transfers += 1; },
    });
    expect(second.claimed).toBe(0);
  } finally { release(); }
  await Promise.all([first, revoke]);
  expect(transfers).toBe(1);
  expect(revoked).toBe(true);
});

test('a destination commit followed by lost acknowledgment replays the same issuance', async () => {
  const parent = await pendingParent();
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  const at = new Date(issued.invitation.createdAt.getTime() + 1000);
  const committed = new Set<string>();
  await drainAccountEmailHandoffs(h.client, {
    now: () => at, owner: 'synthetic-crashed-ack-worker',
    transfer: async (content) => { committed.add(content.issuanceId); throw new Error('synthetic-lost-ack'); },
  });
  const result = await drainAccountEmailHandoffs(h.client, {
    now: () => new Date(at.getTime() + 60_000), owner: 'synthetic-replay-worker',
    transfer: async (content) => { committed.add(content.issuanceId); },
  });
  expect(result.completed).toBe(1);
  expect(committed.size).toBe(1);
});


test('an authenticated envelope with the wrong proof is discarded before destination access', async () => {
  const parent = await pendingParent();
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  const job = await h.client.coreV2JobOutbox.findUniqueOrThrow({ where: { id: issued.handoffId } });
  const content = openAccountEmailHandoff(job.payload, issued.invitation.id);
  const envelope = sealAccountEmailHandoff({ ...content, rawToken: 'synthetic_wrong_opaque_proof_256_bits_not_a_credential' });
  await h.client.coreV2JobOutbox.update({ where: { id: job.id }, data: { payload: envelope } });
  let transfers = 0;
  const result = await drainAccountEmailHandoffs(h.client, {
    now: () => new Date(issued.invitation.createdAt.getTime() + 1000), owner: 'synthetic-mismatched-proof-worker',
    transfer: async () => { transfers += 1; },
  });
  expect(result.discarded).toBe(1);
  expect(transfers).toBe(0);
});


test('slow sequential destination commits receive fresh leases rather than exhausting later jobs', async () => {
  const parent = await pendingParent();
  const first = await inviteAccount(h.client, h.ctx(), parent.id);
  for (let i = 0; i < 2; i += 1) {
    const user = await h.client.user.create({ data: { role: 'PARENT', email: `synthetic-slow-handoff-${i}@example.test`, accountStatus: 'PENDING_ACTIVATION' } });
    await inviteAccount(h.client, h.ctx(), user.id);
  }
  let clock = first.invitation.createdAt.getTime() + 1000;
  const result = await drainAccountEmailHandoffs(h.client, {
    now: () => new Date(clock), owner: 'synthetic-slow-worker',
    transfer: async () => { clock += 16_000; },
  });
  expect(result.completed).toBe(3);
  const jobs = await h.client.coreV2JobOutbox.findMany({ where: { aggregateType: 'ACCOUNT_EMAIL_HANDOFF' } });
  expect(jobs.every((job) => job.attemptCount === 1 && job.status === 'COMPLETED')).toBe(true);
});
