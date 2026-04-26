/**
 * Tests API Assistante Assignments
 * POST /api/assistante/assignments
 * PATCH /api/assistante/assignments/[id]
 * GET /api/assistante/students
 * GET /api/assistante/coaches
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    student: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    coachStudentAssignment: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { GET as getAssignments, POST as postAssignments } from '@/app/api/assistante/assignments/route';
import { GET as getAssignmentDetail, PATCH as patchAssignment } from '@/app/api/assistante/assignments/[id]/route';
import { GET as getStudents } from '@/app/api/assistante/students/route';
import { GET as getCoaches } from '@/app/api/assistante/coaches/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { AssignmentStatus, AssignmentType, Subject } from '@prisma/client';

const mockAuth = auth as jest.Mock;

function makeRequest(body?: any): Request {
  return new Request('http://localhost/', {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDetailContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('API Assistante Assignments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Auth / RBAC', () => {
    it('1. Non connecté => 401', async () => {
      mockAuth.mockResolvedValue(null);

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(401);
    });

    it('2. Rôle ELEVE => 403', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1', role: 'ELEVE' } });

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(403);
    });

    it('2. Rôle COACH => 403', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1', role: 'COACH' } });

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(403);
    });

    it('2. Rôle PARENT => 403', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1', role: 'PARENT' } });

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(403);
    });

    it('3. Rôle ASSISTANTE => autorisé', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.student.count as jest.Mock).mockResolvedValue(0);

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(200);
    });

    it('4. Rôle ADMIN => autorisé', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.student.count as jest.Mock).mockResolvedValue(0);

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/assistante/assignments', () => {
    it('5. POST assignment avec payload valide => crée CoachStudentAssignment', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1', user: { firstName: 'Coach', lastName: 'X' } } as any);
      (prisma.student.findMany as jest.Mock).mockResolvedValue([{ id: 'student-1', user: { firstName: 'Ahmed', lastName: 'B' } }] as any);
      (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockImplementation(async (ops: any) => {
        return ops.map((op: any) => op);
      });
      (prisma.coachStudentAssignment.create as jest.Mock).mockResolvedValue({
        id: 'assignment-1',
        coachId: 'coach-1',
        studentId: 'student-1',
        assignmentType: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
      } as any);

      const res = await postAssignments(makeRequest({
        coachId: 'coach-1',
        studentIds: ['student-1'],
        assignmentType: AssignmentType.PRIMARY,
      }));
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.assignments).toHaveLength(1);
    });

    it('6. POST avec studentIds vide => 400', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });

      const res = await postAssignments(makeRequest({
        coachId: 'coach-1',
        studentIds: [],
      }));

      expect(res.status).toBe(400);
    });

    it('7. POST avec coachId invalide => 400', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await postAssignments(makeRequest({
        coachId: 'invalid-coach',
        studentIds: ['student-1'],
      }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.message).toContain('Coach non trouvé');
    });

    it('8. POST avec studentId invalide => 400', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1' } as any);
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);

      const res = await postAssignments(makeRequest({
        coachId: 'coach-1',
        studentIds: ['invalid-student'],
      }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.message).toContain('Élèves non trouvés');
    });

    it('9. POST doublon actif exact => erreur claire', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1', user: { firstName: 'Coach', lastName: 'X' } } as any);
      (prisma.student.findMany as jest.Mock).mockResolvedValue([{ id: 'student-1', user: { firstName: 'Ahmed', lastName: 'B' } }] as any);
      (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([{ id: 'existing-1', studentId: 'student-1' }] as any);

      const res = await postAssignments(makeRequest({
        coachId: 'coach-1',
        studentIds: ['student-1'],
        assignmentType: AssignmentType.PRIMARY,
      }));
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe('Conflict');
    });
  });

  describe('PATCH /api/assistante/assignments/[id]', () => {
    it('10. PATCH status ENDED => termine l\'assignation sans hard delete', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachStudentAssignment.findUnique as jest.Mock).mockResolvedValue({ id: 'assignment-1' } as any);
      (prisma.coachStudentAssignment.update as jest.Mock).mockResolvedValue({
        id: 'assignment-1',
        status: AssignmentStatus.ENDED,
        endsAt: new Date(),
      } as any);

      const res = await patchAssignment(
        makeRequest({ status: AssignmentStatus.ENDED }),
        makeDetailContext('assignment-1')
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.assignment.status).toBe(AssignmentStatus.ENDED);
    });

    it('11. PATCH status SUSPENDED => suspend l\'assignation sans hard delete', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachStudentAssignment.findUnique as jest.Mock).mockResolvedValue({ id: 'assignment-1' } as any);
      (prisma.coachStudentAssignment.update as jest.Mock).mockResolvedValue({
        id: 'assignment-1',
        status: AssignmentStatus.SUSPENDED,
      } as any);

      const res = await patchAssignment(
        makeRequest({ status: AssignmentStatus.SUSPENDED }),
        makeDetailContext('assignment-1')
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.assignment.status).toBe(AssignmentStatus.SUSPENDED);
    });

    it('returns 404 when assignment does not exist', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachStudentAssignment.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await patchAssignment(
        makeRequest({ status: AssignmentStatus.ENDED }),
        makeDetailContext('ghost')
      );

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/assistante/students', () => {
    it('returns paginated students list', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.student.count as jest.Mock).mockResolvedValue(0);

      const res = await getStudents(new Request('http://localhost/'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.pagination).toBeDefined();
      expect(body.students).toEqual([]);
    });

    it('filters by hasCoach=true', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.student.count as jest.Mock).mockResolvedValue(0);

      const res = await getStudents(new Request('http://localhost/?hasCoach=true'));

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/assistante/coaches', () => {
    it('returns coaches list with stats', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'coach-1',
          userId: 'user-1',
          user: { firstName: 'Coach', lastName: 'One', email: 'c@test.com' },
          pseudonym: 'CoachX',
          tag: 'Math',
          title: 'Professeur',
          subjects: [],
          availableOnline: true,
          availableInPerson: true,
          studentAssignments: [],
          _count: { studentAssignments: 2, sessions: 10 },
          createdAt: new Date(),
        },
      ] as any);
      (prisma.coachProfile.count as jest.Mock).mockResolvedValue(1);

      const res = await getCoaches(new Request('http://localhost/'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.coaches).toHaveLength(1);
      expect(body.coaches[0].stats.activeStudents).toBe(2);
    });
  });
});
