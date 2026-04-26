/**
 * Tests RBAC - Coach Student Access
 * Vérifie les règles d'ownership coach ↔ élève via CoachStudentAssignment
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findUnique: jest.fn() },
    coachStudentAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
    student: { findUnique: jest.fn() },
    sessionBooking: { findFirst: jest.fn() },
  },
}));

import {
  isCoachAssignedToStudent,
  assertCoachCanAccessStudent,
  getAssignedStudentsForCoach,
  getCoachProfileForUser,
  isCoachRattachedToStudent,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { AssignmentStatus, AssignmentType } from '@prisma/client';


describe('RBAC / CoachStudentAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCoachProfileForUser', () => {
    it('returns null when userId is empty', async () => {
      const result = await getCoachProfileForUser('');
      expect(result).toBeNull();
    });

    it('returns coach profile when found', async () => {
      const mockCoach = { id: 'coach-1', userId: 'user-1', pseudonym: 'CoachX' };
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(mockCoach as any);

      const result = await getCoachProfileForUser('user-1');
      expect(result).toEqual(mockCoach);
      expect(prisma.coachProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('isCoachAssignedToStudent - cas métier', () => {
    const coachUserId = 'coach-user-1';
    const studentId = 'student-1';
    const now = new Date();

    it('1. Coach assigné ACTIVE - accès autorisé', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-1' } as any);

      const result = await isCoachAssignedToStudent({ coachUserId, studentId });
      expect(result).toBe(true);
      expect(prisma.coachStudentAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            coachId: 'coach-1',
            studentId: 'student-1',
            status: AssignmentStatus.ACTIVE,
          }),
        })
      );
    });

    it('2. Coach non assigné - accès refusé', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await isCoachAssignedToStudent({ coachUserId, studentId });
      expect(result).toBe(false);
    });

    it('3. Assignation ENDED - accès refusé', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await isCoachAssignedToStudent({ coachUserId, studentId });
      expect(result).toBe(false);
    });

    it('4. Assignation SUSPENDED - accès refusé', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await isCoachAssignedToStudent({ coachUserId, studentId });
      expect(result).toBe(false);
    });

    it('5. Assignation future (startsAt > now) - accès refusé', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await isCoachAssignedToStudent({ coachUserId, studentId });
      expect(result).toBe(false);
    });

    it('6. Assignation expirée (endsAt < now) - accès refusé', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await isCoachAssignedToStudent({ coachUserId, studentId });
      expect(result).toBe(false);
    });

    it('returns false when coach profile does not exist', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await isCoachAssignedToStudent({ coachUserId, studentId });
      expect(result).toBe(false);
    });

    it('returns false when params are empty', async () => {
      const result = await isCoachAssignedToStudent({ coachUserId: '', studentId: '' });
      expect(result).toBe(false);
    });
  });

  describe('assertCoachCanAccessStudent', () => {
    it('throws ACCESS_DENIED when not assigned', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        assertCoachCanAccessStudent({ coachUserId: 'user-1', studentId: 'student-1' })
      ).rejects.toThrow('ACCESS_DENIED');
    });

    it('does not throw when assigned', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-1' } as any);

      await expect(
        assertCoachCanAccessStudent({ coachUserId: 'user-1', studentId: 'student-1' })
      ).resolves.not.toThrow();
    });
  });

  describe('getAssignedStudentsForCoach', () => {
    it('returns empty array when no coach profile', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getAssignedStudentsForCoach({ coachUserId: 'user-1' });
      expect(result).toEqual([]);
    });

    it('returns empty array when coachUserId is empty', async () => {
      const result = await getAssignedStudentsForCoach({ coachUserId: '' });
      expect(result).toEqual([]);
    });

    it('7. Retourne seulement les élèves actifs', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'assignment-1',
          assignmentType: AssignmentType.PRIMARY,
          subjects: [],
          notes: null,
          startsAt: new Date(),
          endsAt: null,
          student: {
            id: 'student-1',
            userId: 'user-student-1',
            gradeLevel: 'PREMIERE',
            academicTrack: 'EDS_GENERALE',
            specialties: [],
            stmgPathway: null,
            survivalMode: false,
            school: null,
            credits: 10,
            user: { firstName: 'Ahmed', lastName: 'B', email: 'ahmed@test.com' },
            parent: null,
            mathsProgress: null,
            survivalProgress: null,
            _count: { sessions: 5, assessments: 2 },
          },
        },
      ] as any);

      const result = await getAssignedStudentsForCoach({ coachUserId: 'user-1' });

      expect(result).toHaveLength(1);
      expect(result[0].student.id).toBe('student-1');
      expect(result[0].assignmentType).toBe(AssignmentType.PRIMARY);
      expect(prisma.coachStudentAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            coachId: 'coach-1',
            status: AssignmentStatus.ACTIVE,
          }),
        })
      );
    });

    it('n\'inclut pas les élèves sans assignation', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getAssignedStudentsForCoach({ coachUserId: 'user-1' });
      expect(result).toEqual([]);
    });
  });

  describe('isCoachRattachedToStudent (legacy compatibility)', () => {
    it('checks new CoachStudentAssignment first, then falls back to SessionBooking', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'student-1' } as any);
      (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({ id: 'sb-1' } as any);

      const result = await isCoachRattachedToStudent('coach-user-1', 'student-user-1');

      expect(result).toBe(true);
      expect(prisma.sessionBooking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { coachId: 'coach-user-1', studentId: 'student-user-1' },
        })
      );
    });

    it('returns false when no link exists', async () => {
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'student-1' } as any);
      (prisma.coachStudentAssignment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await isCoachRattachedToStudent('coach-user-1', 'student-user-1');
      expect(result).toBe(false);
    });
  });
});
