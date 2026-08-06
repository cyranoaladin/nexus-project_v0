jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));

import { prisma } from '@/lib/prisma';
import * as activationService from '@/lib/services/student-activation.service';
import crypto from 'crypto';

describe('initial student activation owned by a parent', () => {
  const transaction = {
    parentProfile: { findUnique: jest.fn() },
    student: { findFirst: jest.fn() },
    user: { updateMany: jest.fn() },
    $queryRaw: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    (prisma.$transaction as jest.Mock).mockImplementation(async (action) => action(transaction));
    transaction.parentProfile.findUnique.mockResolvedValue({ id: 'parent-profile-1' });
    transaction.$queryRaw.mockResolvedValue([{ id: 'student-1' }]);
    transaction.student.findFirst.mockResolvedValue({
      id: 'student-1',
      user: {
        id: 'child-user-1',
        role: 'ELEVE',
        email: 'child@nexus-student.local',
        firstName: 'Enfant',
        lastName: 'Test',
        activatedAt: null,
      },
    });
    transaction.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it('stores only the token hash and returns the raw token to the owning parent', async () => {
    const initiate = (activationService as Record<string, unknown>).initiateParentOwnedStudentActivation;
    expect(typeof initiate).toBe('function');

    const result = await (initiate as Function)({
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
    });

    expect(result.success).toBe(true);
    const rawToken = new URL(result.activationUrl).searchParams.get('token');
    expect(rawToken).toMatch(/^sact_/);
    const storedHash = transaction.user.updateMany.mock.calls[0][0].data.activationToken;
    expect(storedHash).toBe(crypto.createHash('sha256').update(rawToken!).digest('hex'));
    expect(storedHash).not.toContain(rawToken);
    expect(result.loginIdentifier).toBe('child@nexus-student.local');
  });

  it('fails closed when the child belongs to another family', async () => {
    transaction.student.findFirst.mockResolvedValue(null);
    const initiate = (activationService as any).initiateParentOwnedStudentActivation;

    const result = await initiate({ parentUserId: 'parent-user-2', studentId: 'student-1' });

    expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it('fails closed when the row lock does not resolve legacy ownership', async () => {
    transaction.$queryRaw.mockResolvedValue([]);
    const initiate = (activationService as any).initiateParentOwnedStudentActivation;

    const result = await initiate({ parentUserId: 'parent-user-1', studentId: 'student-1' });

    expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    expect(transaction.student.findFirst).not.toHaveBeenCalled();
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it('locks the student row FOR UPDATE before reading or issuing a token, to serialize concurrent issuance', async () => {
    const initiate = (activationService as any).initiateParentOwnedStudentActivation;

    await initiate({ parentUserId: 'parent-user-1', studentId: 'student-1' });

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = transaction.$queryRaw.mock.calls[0][0] as { strings?: readonly string[]; values?: unknown[] };
    expect(sql.strings?.join('?')).toContain('FOR UPDATE');
    expect(sql.strings?.join('?')).toContain('students');
    expect(sql.values).toEqual(['student-1', 'parent-profile-1']);

    // The lock must be acquired before the ownership read that decides whether to issue.
    const lockOrder = transaction.$queryRaw.mock.invocationCallOrder[0];
    const readOrder = transaction.student.findFirst.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(readOrder);
  });

  it('reissuing replaces the stored hash so the former token is revoked', async () => {
    const initiate = (activationService as any).initiateParentOwnedStudentActivation;

    const first = await initiate({ parentUserId: 'parent-user-1', studentId: 'student-1' });
    const second = await initiate({ parentUserId: 'parent-user-1', studentId: 'student-1' });

    const firstRaw = new URL(first.activationUrl).searchParams.get('token');
    const secondRaw = new URL(second.activationUrl).searchParams.get('token');
    const firstHash = transaction.user.updateMany.mock.calls[0][0].data.activationToken;
    const secondHash = transaction.user.updateMany.mock.calls[1][0].data.activationToken;
    expect(firstRaw).not.toBe(secondRaw);
    expect(firstHash).not.toBe(secondHash);
  });

  it('repairs an accented historical identifier atomically without replacing the user', async () => {
    transaction.student.findFirst.mockResolvedValue({
      id: 'student-1',
      user: {
        id: 'child-user-legacy-1',
        role: 'ELEVE',
        email: 'élève.d’angelo@nexus-student.local',
        firstName: 'Élève',
        lastName: 'D’Angelo',
        activatedAt: null,
      },
    });
    const initiate = (activationService as any).initiateParentOwnedStudentActivation;

    const result = await initiate({ parentUserId: 'parent-user-1', studentId: 'student-1' });

    expect(result.success).toBe(true);
    expect(result.loginIdentifier).toMatch(
      /^eleve\.d\.angelo(?:\.[a-z0-9]+)+@nexus-student\.local$/,
    );
    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'child-user-legacy-1',
        role: 'ELEVE',
        activatedAt: null,
      },
      data: expect.objectContaining({
        email: result.loginIdentifier,
        activationToken: expect.any(String),
        activationExpiry: expect.any(Date),
      }),
    });
  });
});
