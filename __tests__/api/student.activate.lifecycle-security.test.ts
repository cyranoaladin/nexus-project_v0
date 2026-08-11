jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    stageReservation: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  completeStudentActivation,
  verifyActivationToken,
} from '@/lib/services/student-activation.service';

function sha256(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

describe('student activation token lifecycle security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('looks up only the hashed token with an expiry and never the raw token', async () => {
    const rawToken = 'act_raw_token_from_url';
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.stageReservation.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await verifyActivationToken(rawToken);

    expect(result).toEqual({ valid: false });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        activationToken: sha256(rawToken),
        activationExpiry: { gt: expect.any(Date) },
        activatedAt: null,
      }),
    }));
    expect(JSON.stringify((prisma.user.findFirst as jest.Mock).mock.calls)).not.toContain(rawToken);
  });

  it('invalidates the activation token after successful password setup', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-1',
      firstName: 'Nour',
      lastName: 'Test',
      email: 'nour@example.com',
      activatedAt: null,
      student: { id: 'student-1' },
    });
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await completeStudentActivation('act_valid_token', 'securePass123');

    expect(result).toEqual({
      success: true,
      redirectUrl: '/auth/signin?activated=true&callbackUrl=%2Fbilan-gratuit%2Fassessment',
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'user-1',
        activationToken: sha256('act_valid_token'),
        activatedAt: null,
      }),
      data: expect.objectContaining({
        activationToken: null,
        activationExpiry: null,
        activatedAt: expect.any(Date),
        sessionVersion: { increment: 1 },
      }),
    });
  });

  it('allows exactly one winner when the same token is consumed concurrently', async () => {
    const pendingUser = {
      id: 'user-1',
      firstName: 'Nour',
      lastName: 'Test',
      email: 'nour@example.com',
      activatedAt: null,
      student: { id: 'student-1' },
    };
    (prisma.user.findFirst as jest.Mock)
      .mockResolvedValueOnce(pendingUser)
      .mockResolvedValueOnce(pendingUser);
    (prisma.user.updateMany as jest.Mock)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    (prisma.stageReservation.findFirst as jest.Mock).mockResolvedValue(null);

    const results = await Promise.all([
      completeStudentActivation('act_same_token', 'securePass123'),
      completeStudentActivation('act_same_token', 'securePass123'),
    ]);

    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => !result.success)).toEqual([
      { success: false, error: "Lien d'activation invalide ou expiré" },
    ]);
  });
});
