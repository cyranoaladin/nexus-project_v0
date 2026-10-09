import { consumeParentPhoneChallenge, verifyParentPhoneChallenge, hashParentPhoneToken } from '@/lib/auth/parent-phone';
import { canApplyV1CredentialProof } from '@/lib/auth/password-reset-authority';

jest.mock('bcryptjs', () => ({ hash: jest.fn(async () => 'synthetic-new-hash') }));
jest.mock('@/lib/auth/password-reset-authority', () => ({ canApplyV1CredentialProof: jest.fn(async () => false) }));

const now = new Date('2026-10-03T12:00:00Z');
const rawToken = 'pprst_' + 'x'.repeat(43);
beforeEach(() => { jest.mocked(canApplyV1CredentialProof).mockReset().mockResolvedValue(false); });
function database() {
  const user = { id: 'synthetic-parent', role: 'PARENT', email: null,
    activatedAt: now, phoneNormalized: '20101010', parentPhoneVersion: 1,
    parentPhoneState: 'VERIFIED', phoneVerifiedAt: now, mergedIntoUserId: null };
  const challenge = { id: 'synthetic-challenge', userId: user.id, user, purpose: 'RECOVERY',
    tokenHash: hashParentPhoneToken(rawToken), phoneNormalized: user.phoneNormalized,
    phoneVersion: 1, expiresAt: new Date(now.getTime() + 3600000), consumedAt: null, revokedAt: null };
  const db = { user: { updateMany: jest.fn(async () => ({ count: 1 })) },
    parentPhoneChallenge: { findUnique: jest.fn(async () => challenge), updateMany: jest.fn(async () => ({ count: 1 })) },
    $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => callback(db),
  };
  return db;
}
test('an old V1 phone proof cannot overwrite a now Core-owned identity', async () => {
  const db = database();
  const result = await consumeParentPhoneChallenge(rawToken, ['synthetic', 'new', 'password'].join('-'), {
    prisma: db as unknown as NonNullable<Parameters<typeof consumeParentPhoneChallenge>[2]>['prisma'], now,
  });
  expect(result.success).toBe(false);
  expect(db.user.updateMany).not.toHaveBeenCalled();
  expect(db.parentPhoneChallenge.updateMany).not.toHaveBeenCalled();
});
test('an old V1 phone proof is not reported valid after its identity moves to Core-v2', async () => {
  const db = database();
  const result = await verifyParentPhoneChallenge(rawToken, {
    prisma: db as unknown as NonNullable<Parameters<typeof verifyParentPhoneChallenge>[1]>['prisma'], now,
  });
  expect(result.valid).toBe(false);
});
test('an unavailable phone authority leaves both the user and the proof untouched', async () => {
  jest.mocked(canApplyV1CredentialProof).mockRejectedValue(new Error('synthetic authority unavailable'));
  const db = database();
  await expect(consumeParentPhoneChallenge(rawToken, ['synthetic', 'new', 'password'].join('-'), {
    prisma: db as unknown as NonNullable<Parameters<typeof consumeParentPhoneChallenge>[2]>['prisma'], now,
  })).rejects.toThrow('synthetic authority unavailable');
  expect(db.user.updateMany).not.toHaveBeenCalled();
  expect(db.parentPhoneChallenge.updateMany).not.toHaveBeenCalled();
});
test('a proof still owned by V1 completes the existing atomic consumption', async () => {
  jest.mocked(canApplyV1CredentialProof).mockResolvedValue(true);
  const db = database();
  const result = await consumeParentPhoneChallenge(rawToken, ['synthetic', 'new', 'password'].join('-'), {
    prisma: db as unknown as NonNullable<Parameters<typeof consumeParentPhoneChallenge>[2]>['prisma'], now,
  });
  expect(result.success).toBe(true);
  expect(canApplyV1CredentialProof).toHaveBeenCalledWith({ userId: 'synthetic-parent' });
  expect(db.user.updateMany).toHaveBeenCalledTimes(1);
  expect(db.parentPhoneChallenge.updateMany).toHaveBeenCalledTimes(2);
});
