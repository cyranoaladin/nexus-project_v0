import { createHash } from 'node:crypto';
import { enqueueParentWhatsAppInvitation } from '@/lib/whatsapp/invitation-outbox';
import { drainWhatsAppInvitations } from '@/lib/whatsapp/invitation-worker';

const input = { userId: 'parent-1', challengeId: 'challenge-1', rawToken: 'ppact_' + 'x'.repeat(43), phoneNormalized: '99123456', phoneVersion: 2, purpose: 'ACTIVATION' as const, expiresAt: new Date('2099-01-01') };
const savedKey = process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY;
beforeEach(() => { process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = 'test-only-whatsapp-key-'.repeat(3); });
afterAll(() => { if (savedKey === undefined) delete process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY; else process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = savedKey; });
async function harness(challengeOverride = {}, userOverride = {}) {
  let stored: any;
  await enqueueParentWhatsAppInvitation({ jobOutbox: { create: async ({ data }: any) => { stored = { ...data, id: 'job-1', attemptCount: 0, availableAt: new Date(0), leaseOwner: null, leaseExpiresAt: null }; return stored; } } } as never, input);
  const findMany = jest.fn(async () => [{ ...stored, payload: JSON.parse(JSON.stringify(stored.payload)) }]);
  const updateMany = jest.fn(async ({ where, data }: any) => {
    if (where.id && where.id !== stored.id) return { count: 0 };
    if (where.status && typeof where.status === 'string' && where.status !== stored.status) return { count: 0 };
    if (where.status?.in && !where.status.in.includes(stored.status)) return { count: 0 };
    if (where.leaseOwner && stored.leaseOwner !== where.leaseOwner) return { count: 0 };
    if (where.leaseExpiresAt?.lte && (!stored.leaseExpiresAt || stored.leaseExpiresAt > where.leaseExpiresAt.lte)) return { count: 0 };
    if (where.payload?.equals && JSON.stringify(where.payload.equals) !== JSON.stringify(stored.payload)) return { count: 0 };
    const count = data.attemptCount?.increment;
    stored = { ...stored, ...data, attemptCount: count ? stored.attemptCount + count : stored.attemptCount };
    return { count: 1 };
  });
  const db: any = {
    jobOutbox: { findMany, updateMany },
    parentPhoneChallenge: { findUnique: jest.fn(async () => ({
      id: input.challengeId, userId: input.userId, tokenHash: createHash('sha256').update(input.rawToken).digest('hex'),
      phoneNormalized: input.phoneNormalized, phoneVersion: 2, purpose: 'ACTIVATION', expiresAt: input.expiresAt,
      revokedAt: null, consumedAt: null,
      user: { id: input.userId, role: 'PARENT', parentPhoneVersion: 2, parentPhoneState: 'RESERVED', activatedAt: null, mergedIntoUserId: null, phoneVerifiedAt: null, phoneNormalized: input.phoneNormalized, ...userOverride },
      ...challengeOverride,
    })) },
  };
  db.$transaction = async (fn: any) => fn(db);
  const send = jest.fn().mockResolvedValue({ status: 'ACCEPTED', providerMessageId: 'wamid.test' });
  const deps = { prisma: db, send, now: () => new Date('2026-09-07') };
  return { deps, send, getJob: () => stored, updateMany };
}

test('valid invitation completes dispatch as ACCEPTED, never DELIVERED', async () => {
  const h = await harness();
  await drainWhatsAppInvitations({}, h.deps);
  expect(h.send).toHaveBeenCalledTimes(1);
  expect(h.getJob().status).toBe('COMPLETED');
  expect(h.getJob().payload.delivery).toEqual({ state: 'ACCEPTED', providerMessageId: 'wamid.test' });
});

test.each([{ revokedAt: new Date() }, { consumedAt: new Date() }, { expiresAt: new Date(0) }, { tokenHash: 'mismatch' }, { purpose: 'RECOVERY' }, { phoneVersion: 1 }, { phoneNormalized: '99888888' }])('invalid challenge is cancelled without sending (%j)', async (override) => {
  const h = await harness(override);
  await drainWhatsAppInvitations({}, h.deps);
  expect(h.send).not.toHaveBeenCalled();
  expect(h.getJob().status).toBe('CANCELLED');
});
test.each([{ parentPhoneVersion: 3 }, { parentPhoneState: 'NONE' }, { phoneNormalized: '99888888' }, { role: 'ELEVE' }, { mergedIntoUserId: 'other-user' }, { activatedAt: new Date() }])('invalid current identity blocks old destination (%j)', async (override) => {
  const h = await harness({}, override);
  await drainWhatsAppInvitations({}, h.deps);
  expect(h.send).not.toHaveBeenCalled();
});
test('simultaneous workers claim each invitation only once', async () => {
  const h = await harness();
  await Promise.all([drainWhatsAppInvitations({ owner: 'one' }, h.deps), drainWhatsAppInvitations({ owner: 'two' }, h.deps)]);
  expect(h.send).toHaveBeenCalledTimes(1);
});
test.each(['UNAVAILABLE', 'RETRYABLE', 'AMBIGUOUS', 'FAILED'])('persists honest provider outcome %s', async (status) => {
  const h = await harness();
  h.send.mockResolvedValue({ status, code: 'WHATSAPP_TEST_FAILURE' });
  await drainWhatsAppInvitations({}, h.deps);
  expect(h.getJob().status).toBe(status === 'AMBIGUOUS' ? 'AMBIGUOUS' : status === 'FAILED' ? 'FAILED_FINAL' : 'RETRY_SCHEDULED');
  expect(h.getJob().payload.delivery.state).not.toBe('DELIVERED');
});
test('callback delivered during provider request cannot be downgraded to ACCEPTED', async () => {
  const h = await harness();
  h.send.mockImplementation(async () => {
    await h.updateMany({ where: { id: 'job-1' }, data: { status: 'COMPLETED', leaseOwner: null, payload: { ...h.getJob().payload, delivery: { state: 'DELIVERED', providerMessageId: 'wamid.test', eventTimestamp: 123 } } } });
    return { status: 'ACCEPTED', providerMessageId: 'wamid.test' };
  });
  await drainWhatsAppInvitations({}, h.deps);
  expect(h.getJob().payload.delivery.state).toBe('DELIVERED');
});

test('expired lease stays ambiguous and cannot resend after worker crash', async () => {
  const h = await harness();
  h.getJob().status = 'LEASED';
  h.getJob().leaseExpiresAt = new Date(0);
  await drainWhatsAppInvitations({}, h.deps);
  expect(h.getJob().status).toBe('AMBIGUOUS');
  expect(h.send).not.toHaveBeenCalled();
});
test('definite rejections stop after the retry budget', async () => {
  const h = await harness();
  h.getJob().attemptCount = 4;
  h.send.mockResolvedValue({ status: 'RETRYABLE', code: 'WHATSAPP_RATE_LIMITED' });
  await drainWhatsAppInvitations({}, h.deps);
  expect(h.getJob().status).toBe('FAILED_FINAL');
});

test('temporary validation database failure retries safely without any provider call', async () => {
  const h = await harness();
  h.deps.prisma.parentPhoneChallenge.findUnique.mockRejectedValueOnce(new Error('db details must not escape'));
  await drainWhatsAppInvitations({}, h.deps);
  expect(h.send).not.toHaveBeenCalled();
  expect(h.getJob().status).toBe('RETRY_SCHEDULED');
  expect(h.getJob().lastError).toBe('WHATSAPP_VALIDATION_UNAVAILABLE');
});
