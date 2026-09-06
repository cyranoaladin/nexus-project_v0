import { anonymiseParentPhoneCarriers } from '@/lib/rgpd/parent-phone-anonymisation';
import { TOMBSTONE } from '@/lib/rgpd/anonymisation';
const now = new Date('2026-09-06T12:00:00Z');
function database(status = 'PENDING') {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValueOnce([{ id: 'parent' }]).mockResolvedValueOnce([{ id: 'job', status }]),
    user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    parentPhoneChallenge: { findMany: jest.fn().mockResolvedValue([{ id: 'challenge', userId: 'parent' }]), updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn() },
    jobOutbox: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn() },
  };
  return { tx, $transaction: jest.fn(async action => action(tx)) };
}
it('scrubs every phone challenge and encrypted outbox while retaining provenance rows', async () => {
  const db = database();
  await anonymiseParentPhoneCarriers(db as never, { userIds: ['parent'], challengeIds: [], now });
  expect(db.tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phoneNormalized: null, activationToken: null, phoneVerifiedAt: null, sessionVersion: { increment: 1 } }) }));
  expect(db.tx.parentPhoneChallenge.updateMany).toHaveBeenCalledWith({ where: { userId: { in: ['parent'] } }, data: { phoneNormalized: TOMBSTONE } });
  expect(db.tx.parentPhoneChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: { in: ['parent'] }, revokedAt: null }, data: { revokedAt: now } }));
  expect(db.tx.jobOutbox.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ payload: { anonymised: true }, leaseOwner: null, leaseExpiresAt: null, lastError: null }) }));
  expect(db.tx.parentPhoneChallenge.deleteMany).not.toHaveBeenCalled(); expect(db.tx.jobOutbox.deleteMany).not.toHaveBeenCalled();
});
it('refuses a leased send before any mutation so completion cannot race an in-flight delivery', async () => {
  const db = database('LEASED');
  await expect(anonymiseParentPhoneCarriers(db as never, { userIds: ['parent'], challengeIds: [], now })).rejects.toThrow('WHATSAPP_SEND_IN_PROGRESS');
  expect(db.tx.user.updateMany).not.toHaveBeenCalled(); expect(db.tx.parentPhoneChallenge.updateMany).not.toHaveBeenCalled();
});
it('refuses challenge rows belonging to another proposed account before mutation', async () => {
  const db = database(); db.tx.parentPhoneChallenge.findMany.mockResolvedValue([{ id: 'challenge', userId: 'other' }]);
  await expect(anonymiseParentPhoneCarriers(db as never, { userIds: ['parent'], challengeIds: ['challenge'], now })).rejects.toThrow('PHONE_CHALLENGE_SCOPE_MISMATCH');
  expect(db.tx.user.updateMany).not.toHaveBeenCalled();
});
