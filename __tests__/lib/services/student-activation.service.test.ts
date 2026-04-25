jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    parentProfile: {
      findFirst: jest.fn(),
    },
    student: {
      update: jest.fn(),
    },
    stageReservation: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { initiateStudentActivation } from '@/lib/services/student-activation.service';

describe('initiateStudentActivation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
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
        student: { id: 'student-entity-1' },
      })
      .mockResolvedValueOnce(null);
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    (prisma.student.update as jest.Mock).mockResolvedValue({});

    const result = await (initiateStudentActivation as any)(
      'student-user-1',
      'nour@example.com',
      'ASSISTANTE',
      'assistant-1',
      {
        gradeLevel: 'PREMIERE',
        academicTrack: 'STMG',
        specialties: [],
      }
    );

    expect(result.success).toBe(true);
    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { userId: 'student-user-1' },
      data: expect.objectContaining({
        gradeLevel: 'PREMIERE',
        academicTrack: 'STMG',
        specialties: [],
        stmgPathway: 'INDETERMINE',
        updatedTrackAt: expect.any(Date),
      }),
    });
  });
});
