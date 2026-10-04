/** @jest-environment node */
import { requireParentOwnsStudent } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/core-v2/client', () => ({
  requireCoreV2Client: jest.fn(),
  Prisma: { TransactionIsolationLevel: { RepeatableRead: 'RepeatableRead' } },
}));

describe('parent ownership after a Core family authority decision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CORE_V2_AUTH_MODE = 'HYBRID';
    jest.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      id: 'legacy-parent-profile', userId: 'synthetic-parent',
      children: [{ id: 'synthetic-student' }],
    } as never);
    jest.mocked(prisma.student.findUnique).mockResolvedValue({
      id: 'synthetic-student', userId: 'synthetic-student-user',
      parent: { userId: 'synthetic-parent' },
    } as never);
  });

  afterEach(() => { process.env.CORE_V2_AUTH_MODE = 'V1_ONLY'; });

  test.each(['revoked', 'missing', 'identity_mismatch'])('refuses an existing V1 relation when Core denies %s', async (reason) => {
    const query = jest.requireMock<{ requireCoreV2Client: jest.Mock }>('@/lib/core-v2/client');
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'synthetic-parent', role: 'PARENT', accountStatus: 'ACTIVE',
          householdParent: reason === 'missing' ? null : {
            householdId: 'synthetic-household', verificationStatus: 'VERIFIED',
            verifiedAt: new Date('2026-10-01T10:00:00Z'), verifiedById: 'synthetic-staff',
            verificationEvidenceDigest: 'a'.repeat(64),
            revokedAt: reason === 'revoked' ? new Date('2026-10-02T10:00:00Z') : null,
          },
        }),
        findMany: jest.fn().mockResolvedValue([{ id: 'synthetic-student-user' }]),
      },
      student: { findMany: jest.fn().mockResolvedValue([{
        id: 'synthetic-student', householdId: 'synthetic-household',
        userId: reason === 'identity_mismatch' ? 'other-synthetic-user' : 'synthetic-student-user',
      }]) },
    };
    query.requireCoreV2Client.mockResolvedValue({
      $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    });
    const result = await requireParentOwnsStudent('synthetic-parent', 'synthetic-student', 'read');
    expect(result === true).toBe(false);
    if (result === true) return;
    expect(result.status).toBe(403);
  });

  test('refuses a Core outage rather than falling back to the existing V1 relation', async () => {
    const query = jest.requireMock<{ requireCoreV2Client: jest.Mock }>('@/lib/core-v2/client');
    query.requireCoreV2Client.mockRejectedValue(new Error('Synthetic authority failure'));
    const result = await requireParentOwnsStudent('synthetic-parent', 'synthetic-student', 'read');
    expect(result === true).toBe(false);
    if (result === true) return;
    expect(result.status).toBe(503);
  });
});
