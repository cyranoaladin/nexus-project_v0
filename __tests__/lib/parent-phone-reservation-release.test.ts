import { releaseExpiredParentPhoneReservation } from '@/lib/auth/parent-phone';

const now = new Date('2026-09-06T12:00:00Z');
const parent = { id: 'parent', role: 'PARENT', mergedIntoUserId: null, activatedAt: null, parentPhoneState: 'RESERVED', parentPhoneVersion: 2 };
function transaction(user: unknown = parent, liveChallenge: unknown = null) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue(user), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    parentPhoneChallenge: { findFirst: jest.fn().mockResolvedValue(liveChallenge), updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn() },
  };
}
it.each([{ ...parent, activatedAt: now }, { ...parent, role: 'ELEVE' }, { ...parent, mergedIntoUserId: 'merged' }])('refuses active, foreign-role or merged identities without mutation', async user => {
  const tx = transaction(user);
  expect(await releaseExpiredParentPhoneReservation(tx as never, parent.id, now, 2)).toBe(false);
  expect(tx.user.updateMany).not.toHaveBeenCalled();
});
it('refuses stale staff confirmation before touching the reservation', async () => {
  const tx = transaction();
  await expect(releaseExpiredParentPhoneReservation(tx as never, parent.id, now, 1)).rejects.toThrow('PHONE_IDENTITY_CHANGED');
  expect(tx.user.updateMany).not.toHaveBeenCalled();
});
it('leaves a live renewed challenge reserved', async () => {
  const tx = transaction(parent, { id: 'live' });
  expect(await releaseExpiredParentPhoneReservation(tx as never, parent.id, now, 2)).toBe(false);
  expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
  expect(tx.parentPhoneChallenge.updateMany).not.toHaveBeenCalled();
});
it('releases only the expected inactive expired reservation while preserving identity and history', async () => {
  const tx = transaction();
  expect(await releaseExpiredParentPhoneReservation(tx as never, parent.id, now, 2)).toBe(true);
  expect(tx.user.updateMany).toHaveBeenLastCalledWith({
    where: expect.objectContaining({ id: parent.id, parentPhoneState: 'RESERVED', parentPhoneVersion: 2, activatedAt: null, role: 'PARENT', mergedIntoUserId: null }),
    data: { parentPhoneState: 'NONE', phoneVerifiedAt: null, parentPhoneVersion: { increment: 1 } },
  });
  expect(tx.parentPhoneChallenge.deleteMany).not.toHaveBeenCalled();
  expect(tx.parentPhoneChallenge.updateMany).toHaveBeenCalledWith({ where: { userId: parent.id, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
});
it('does not mutate when the parent no longer exists', async () => {
  const tx = transaction(null);
  expect(await releaseExpiredParentPhoneReservation(tx as never, parent.id, now, 2)).toBe(false);
  expect(tx.user.updateMany).not.toHaveBeenCalled();
  expect(tx.parentPhoneChallenge.findFirst).not.toHaveBeenCalled();
});
it('stops if the identity changed before acquiring its lock', async () => {
  const tx = transaction();
  tx.user.updateMany.mockResolvedValueOnce({ count: 0 });
  await expect(releaseExpiredParentPhoneReservation(tx as never, parent.id, now, 2)).rejects.toThrow('PHONE_IDENTITY_CHANGED');
  expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
  expect(tx.parentPhoneChallenge.findFirst).not.toHaveBeenCalled();
  expect(tx.parentPhoneChallenge.updateMany).not.toHaveBeenCalled();
});
it('does not revoke challenges if the final guarded release fails', async () => {
  const tx = transaction();
  tx.user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  await expect(releaseExpiredParentPhoneReservation(tx as never, parent.id, now, 2)).rejects.toThrow('PHONE_IDENTITY_CHANGED');
  expect(tx.user.updateMany).toHaveBeenCalledTimes(2);
  expect(tx.parentPhoneChallenge.findFirst).toHaveBeenCalled();
  expect(tx.parentPhoneChallenge.updateMany).not.toHaveBeenCalled();
});
