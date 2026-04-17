jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$hashed-password'),
}));

import crypto from 'crypto';

import {
  completeStudentActivation,
  verifyActivationToken,
} from '@/lib/services/student-activation.service';

let prisma: any;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  prisma.user.findFirst.mockReset();
  prisma.stageReservation.findFirst.mockReset();
  prisma.user.update.mockReset();
  prisma.user.create.mockReset();
  prisma.stageReservation.update.mockReset();
});

describe('student activation service', () => {
  it('verifies a classic user activation token', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      firstName: 'Aya',
      lastName: 'Ben Ali',
      email: 'aya@example.com',
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);

    const result = await verifyActivationToken('user-token');

    expect(result).toEqual({
      valid: true,
      studentName: 'Aya Ben Ali',
      email: 'aya@example.com',
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activationToken: hashToken('user-token'),
        }),
      })
    );
  });

  it('falls back to a stage reservation token when no user token matches', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.stageReservation.findFirst.mockResolvedValue({
      id: 'res-1',
      email: 'stage@example.com',
      studentName: 'Stage Student',
      parentName: 'Parent Stage',
    });

    const result = await verifyActivationToken('stage-token');

    expect(result).toEqual({
      valid: true,
      studentName: 'Stage Student',
      email: 'stage@example.com',
    });
    expect(prisma.stageReservation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activationToken: hashToken('stage-token'),
        }),
      })
    );
  });

  it('activates a user from a stage reservation token and invalidates the reservation token', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user-2',
        email: 'stage@example.com',
        activatedAt: null,
      });
    prisma.stageReservation.findFirst.mockResolvedValue({
      id: 'res-2',
      email: 'stage@example.com',
      studentName: 'Stage Student',
      parentName: 'Stage Parent',
      studentId: null,
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-2',
    });
    prisma.stageReservation.update.mockResolvedValue({});

    const result = await completeStudentActivation('stage-token', 'motdepasse123');

    expect(result).toEqual({
      success: true,
      redirectUrl: '/auth/signin?activated=true',
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-2' },
        data: expect.objectContaining({
          password: '$2a$12$hashed-password',
          activatedAt: expect.any(Date),
        }),
      })
    );
    expect(prisma.stageReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-2' },
        data: expect.objectContaining({
          activationToken: null,
          activationTokenExpiresAt: null,
        }),
      })
    );
  });

  it('returns invalid when neither user nor reservation token matches', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.stageReservation.findFirst.mockResolvedValue(null);

    const result = await verifyActivationToken('missing-token');

    expect(result).toEqual({ valid: false });
  });
});
