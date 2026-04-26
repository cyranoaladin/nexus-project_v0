/**
 * Tests API Coach Students
 * GET /api/coach/students
 * GET /api/coach/students/[studentId]
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findUnique: jest.fn() },
    coachStudentAssignment: { findMany: jest.fn(), findFirst: jest.fn() },
    student: { findUnique: jest.fn() },
    sessionBooking: { findFirst: jest.fn() },
  },
}));

import { GET as getStudents } from '@/app/api/coach/students/route';
import { GET as getStudentDetail } from '@/app/api/coach/students/[studentId]/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const mockAuth = auth as jest.Mock;

function makeDetailContext(studentId: string) {
  return { params: Promise.resolve({ studentId }) };
}

describe('API Coach Students', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/coach/students', () => {
    it('1. Non connecté => 401', async () => {
      mockAuth.mockResolvedValue(null);

      const res = await getStudents();
      expect(res.status).toBe(401);
    });

    it('2. Rôle non COACH => 403', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1', role: 'PARENT' } });

      const res = await getStudents();
      expect(res.status).toBe(403);
    });

    it('3. Coach connecté avec assignations actives => retourne uniquement ses élèves', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
      (prisma as any).coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      (prisma as any).coachStudentAssignment.findMany.mockResolvedValue([
        {
          id: 'assignment-1',
          assignmentType: 'PRIMARY',
          subjects: [],
          notes: null,
          startsAt: new Date(),
          endsAt: null,
          student: {
            id: 'student-1',
            userId: 'user-student-1',
            firstName: 'Ahmed',
            lastName: 'B',
            email: 'ahmed@test.com',
            gradeLevel: 'PREMIERE',
            academicTrack: 'EDS_GENERALE',
            specialties: [],
            stmgPathway: null,
            survivalMode: false,
            school: null,
            credits: 10,
            parent: null,
            _count: { sessions: 5, assessments: 2 },
          },
        },
      ]);

      const res = await getStudents();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.count).toBe(1);
      expect(body.students).toHaveLength(1);
      expect(body.students[0].student.id).toBe('student-1');
    });

    it('4. Coach connecté sans assignation => retourne liste vide', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
      (prisma as any).coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      (prisma as any).coachStudentAssignment.findMany.mockResolvedValue([]);

      const res = await getStudents();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.count).toBe(0);
      expect(body.students).toEqual([]);
    });
  });

  describe('GET /api/coach/students/[studentId]', () => {
    it('5. GET détail élève assigné => 200', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
      (prisma as any).coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      (prisma as any).coachStudentAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        id: 'student-1',
        userId: 'user-student-1',
        gradeLevel: 'PREMIERE',
        academicTrack: 'EDS_GENERALE',
        specialties: [],
        stmgPathway: null,
        survivalMode: false,
        school: null,
        credits: 10,
        user: { id: 'user-student-1', firstName: 'Ahmed', lastName: 'B', email: 'ahmed@test.com', phone: null },
        parent: null,
        coachAssignments: [],
        assessments: [],
        sessions: [],
        trajectories: [],
        _count: { sessions: 5, assessments: 2 },
      } as any);

      const res = await getStudentDetail(new Request('http://localhost/'), makeDetailContext('student-1'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.student.id).toBe('student-1');
    });

    it('6. GET détail élève non assigné => 403', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
      (prisma as any).coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      (prisma as any).coachStudentAssignment.findFirst.mockResolvedValue(null);

      const res = await getStudentDetail(new Request('http://localhost/'), makeDetailContext('student-other'));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('Forbidden');
    });

    it('7. Assignation ENDED => ne donne pas accès', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
      (prisma as any).coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      (prisma as any).coachStudentAssignment.findFirst.mockResolvedValue(null);

      const res = await getStudentDetail(new Request('http://localhost/'), makeDetailContext('student-ended'));
      expect(res.status).toBe(403);
    });

    it('7. Assignation SUSPENDED => ne donne pas accès', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
      (prisma as any).coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      (prisma as any).coachStudentAssignment.findFirst.mockResolvedValue(null);

      const res = await getStudentDetail(new Request('http://localhost/'), makeDetailContext('student-suspended'));
      expect(res.status).toBe(403);
    });

    it('7. Assignation future => ne donne pas accès', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
      (prisma as any).coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      (prisma as any).coachStudentAssignment.findFirst.mockResolvedValue(null);

      const res = await getStudentDetail(new Request('http://localhost/'), makeDetailContext('student-future'));
      expect(res.status).toBe(403);
    });

    it('7. Assignation expirée => ne donne pas accès', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
      (prisma as any).coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      (prisma as any).coachStudentAssignment.findFirst.mockResolvedValue(null);

      const res = await getStudentDetail(new Request('http://localhost/'), makeDetailContext('student-expired'));
      expect(res.status).toBe(403);
    });

    it('returns 404 when student does not exist', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
      (prisma as any).coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
      (prisma as any).coachStudentAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await getStudentDetail(new Request('http://localhost/'), makeDetailContext('ghost'));
      expect(res.status).toBe(404);
    });
  });
});
