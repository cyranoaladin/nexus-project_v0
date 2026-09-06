jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    parentProfile: {
      findFirst: jest.fn(),
    },
    student: {
      update: jest.fn(),
      upsert: jest.fn(),
    },
    stageReservation: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn().mockResolvedValue({ id: 'email-job-1' }),
}));
jest.mock('@/lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { initiateStudentActivation } from '@/lib/services/student-activation.service';

describe('initiateStudentActivation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(prisma));
  });

  it('defaults STMG pathway to INDETERMINE when omitted', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'student-user-1',
        email: 'old@example.com',
        role: 'ELEVE',
        activatedAt: null,
        firstName: 'Nour',
        lastName: 'STMG',
        student: { id: 'student-entity-1', parentId: 'parent-id-1' },
      })
      .mockResolvedValueOnce(null);
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    (prisma.student.upsert as jest.Mock).mockResolvedValue({});

    const result = await (initiateStudentActivation as any)(
      'student-user-1',
      'nour@example.com',
      'ASSISTANTE',
      'assistant-1',
      {
        gradeLevel: 'PREMIERE',
        academicTrack: 'STMG',
        academicCourseKeys: [],
      }
    );

    expect(result.success).toBe(true);
    expect(prisma.student.upsert).toHaveBeenCalledWith({
      where: { userId: 'student-user-1' },
      update: expect.objectContaining({
        gradeLevel: 'PREMIERE',
        academicTrack: 'STMG',
        stmgPathway: 'INDETERMINE',
        updatedTrackAt: expect.any(Date),
      }),
      create: expect.objectContaining({
        parentId: 'parent-id-1'
      })
    });
  });

  it('stores survival mode metadata only for STMG activation', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'student-user-2',
        email: 'old2@example.com',
        role: 'ELEVE',
        activatedAt: null,
        firstName: 'Ines',
        lastName: 'Survie',
        student: { id: 'student-entity-2', parentId: 'parent-id-2' },
      })
      .mockResolvedValueOnce(null);
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    (prisma.student.upsert as jest.Mock).mockResolvedValue({});

    const result = await initiateStudentActivation(
      'student-user-2',
      'ines@example.com',
      'ASSISTANTE',
      'assistant-1',
      {
        gradeLevel: 'PREMIERE' as any,
        academicTrack: 'STMG' as any,
        academicCourseKeys: [],
        survivalMode: true,
        survivalModeReason: 'Profil tres grande difficulte',
      },
    );

    expect(result.success).toBe(true);
    expect(prisma.student.upsert).toHaveBeenCalledWith({
      where: { userId: 'student-user-2' },
      update: expect.objectContaining({
        survivalMode: true,
        survivalModeReason: 'Profil tres grande difficulte',
        survivalModeBy: 'assistant-1',
        survivalModeAt: expect.any(Date),
      }),
      create: expect.objectContaining({
        parentId: 'parent-id-2'
      })
    });
  });

  it('normalizes the email before uniqueness lookup and persistence', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'student-user-3',
        email: 'old3@example.com',
        role: 'ELEVE',
        activatedAt: null,
        firstName: 'Aya',
        lastName: 'Test',
        student: { id: 'student-entity-3', parentId: 'parent-id-3' },
      })
      .mockResolvedValueOnce(null);
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    const result = await initiateStudentActivation(
      'student-user-3',
      '  AYA@EXAMPLE.TEST  ',
      'ASSISTANTE',
      'assistant-1',
    );

    expect(result.success).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { email: 'aya@example.test' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'aya@example.test' }),
    }));
  });

  it('actually enqueues the activation email through the real outbox instead of silently claiming it was sent', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'student-user-4',
        email: 'old4@example.com',
        role: 'ELEVE',
        activatedAt: null,
        firstName: 'Sami',
        lastName: 'Test',
        student: { id: 'student-entity-4', parentId: 'parent-id-4' },
      })
      .mockResolvedValueOnce(null);
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    const result = await initiateStudentActivation(
      'student-user-4',
      'sami@example.test',
      'ASSISTANTE',
      'assistant-1',
    );

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(enqueueEmailIntent).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        aggregateId: 'student-user-4',
        messageType: 'STUDENT_ACTIVATION',
        to: 'sami@example.test',
      }),
    );
    expect(kickEmailOutboxDrain).toHaveBeenCalledTimes(1);
  });

  it('performs the token update and outbox enqueue inside one atomic transaction', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'student-user-5',
        email: 'old5@example.com',
        role: 'ELEVE',
        activatedAt: null,
        firstName: 'Lina',
        lastName: 'Test',
        student: { id: 'student-entity-5', parentId: 'parent-id-5' },
      })
      .mockResolvedValueOnce(null);

    const callOrder: string[] = [];
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
      callOrder.push('transaction-start');
      const result = await fn(prisma);
      callOrder.push('transaction-end');
      return result;
    });
    (prisma.user.update as jest.Mock).mockImplementation(async () => {
      callOrder.push('user-update');
      return {};
    });
    (enqueueEmailIntent as jest.Mock).mockImplementation(async () => {
      callOrder.push('enqueue-email');
      return { id: 'job-1' };
    });

    const result = await initiateStudentActivation(
      'student-user-5',
      'lina@example.test',
      'ASSISTANTE',
      'assistant-1',
    );

    expect(result.success).toBe(true);
    expect(callOrder).toEqual([
      'transaction-start',
      'user-update',
      'enqueue-email',
      'transaction-end',
    ]);
  });
});
