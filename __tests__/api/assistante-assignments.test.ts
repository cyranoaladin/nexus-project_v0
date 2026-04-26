/**
 * Tests API Assistante Assignments
 * POST /api/assistante/assignments
 * PATCH /api/assistante/assignments/[id]
 * GET /api/assistante/students
 * GET /api/assistante/coaches
 */

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn((result): result is any => {
    return result && typeof result === 'object' && 'json' in result && typeof result.json === 'function';
  }),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    student: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    coachStudentAssignment: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { GET as getAssignments, POST as postAssignments } from '@/app/api/assistante/assignments/route';
import { GET as getAssignmentDetail, PATCH as patchAssignment } from '@/app/api/assistante/assignments/[id]/route';
import { GET as getStudents } from '@/app/api/assistante/students/route';
import { GET as getCoaches } from '@/app/api/assistante/coaches/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { AssignmentStatus, AssignmentType, Subject, Prisma } from '@prisma/client';

const mockRequireAnyRole = requireAnyRole as unknown as jest.Mock;

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
      const errorResponse = { json: () => ({ error: 'Unauthorized' }), status: 401 };
      mockRequireAnyRole.mockResolvedValue(errorResponse);

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(401);
    });

    it('2. Rôle ELEVE => 403', async () => {
      const errorResponse = { json: () => ({ error: 'Forbidden' }), status: 403 };
      mockRequireAnyRole.mockResolvedValue(errorResponse);

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(403);
    });

    it('2. Rôle COACH => 403', async () => {
      const errorResponse = { json: () => ({ error: 'Forbidden' }), status: 403 };
      mockRequireAnyRole.mockResolvedValue(errorResponse);

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(403);
    });

    it('2. Rôle PARENT => 403', async () => {
      const errorResponse = { json: () => ({ error: 'Forbidden' }), status: 403 };
      mockRequireAnyRole.mockResolvedValue(errorResponse);

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(403);
    });

    it('3. Rôle ASSISTANTE => autorisé', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.student.count as jest.Mock).mockResolvedValue(0);

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(200);
    });

    it('4. Rôle ADMIN => autorisé', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.student.count as jest.Mock).mockResolvedValue(0);

      const res = await getStudents(new Request('http://localhost/'));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/assistante/assignments', () => {
    it('5. POST assignment avec payload valide => crée CoachStudentAssignment', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
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
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });

      const res = await postAssignments(makeRequest({
        coachId: 'coach-1',
        studentIds: [],
      }));

      expect(res.status).toBe(400);
    });

    it('7. POST avec coachId invalide => 400', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
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
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
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
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
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

    it('POST avec P2002 database conflict => 409', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1', user: { firstName: 'Coach', lastName: 'X' } } as any);
      (prisma.student.findMany as jest.Mock).mockResolvedValue([{ id: 'student-1', user: { firstName: 'Ahmed', lastName: 'B' } }] as any);
      (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([]);
      // Simulate P2002 unique constraint violation from partial index
      // Create a mock PrismaClientKnownRequestError-like object
      const prismaError = Object.assign(
        new Error('Unique constraint failed on the fields: (`coachId`,`studentId`,`assignmentType`)'),
        {
          code: 'P2002',
          clientVersion: '6.19.2',
          meta: { target: ['coachId', 'studentId', 'assignmentType'] },
        }
      );
      // Make it quack like a PrismaClientKnownRequestError for instanceof check
      Object.setPrototypeOf(prismaError, Prisma.PrismaClientKnownRequestError.prototype);
      (prisma.$transaction as jest.Mock).mockRejectedValue(prismaError);

      const res = await postAssignments(makeRequest({
        coachId: 'coach-1',
        studentIds: ['student-1'],
        assignmentType: AssignmentType.PRIMARY,
      }));
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe('Conflict');
    });

    it('POST déduplique studentIds automatiquement', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-1', user: { firstName: 'Coach', lastName: 'X' } } as any);
      // Mock only one student found even if duplicates in request
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

      // Send duplicate studentIds - should be deduplicated
      const res = await postAssignments(makeRequest({
        coachId: 'coach-1',
        studentIds: ['student-1', 'student-1', 'student-1'],
        assignmentType: AssignmentType.PRIMARY,
      }));
      const body = await res.json();

      expect(res.status).toBe(201);
      // Should only create one assignment despite duplicates in request
      expect(body.assignments).toHaveLength(1);
    });
  });

  describe('PATCH /api/assistante/assignments/[id]', () => {
    it('10. PATCH status ENDED => termine l\'assignation sans hard delete', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
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
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
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
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachStudentAssignment.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await patchAssignment(
        makeRequest({ status: AssignmentStatus.ENDED }),
        makeDetailContext('ghost')
      );

      expect(res.status).toBe(404);
    });

    it('PATCH status ENDED sans endsAt => force endsAt à current date', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachStudentAssignment.findUnique as jest.Mock).mockResolvedValue({ id: 'assignment-1' } as any);
      const mockUpdate = jest.fn().mockResolvedValue({
        id: 'assignment-1',
        status: AssignmentStatus.ENDED,
        endsAt: new Date(),
      } as any);
      (prisma.coachStudentAssignment.update as jest.Mock) = mockUpdate;

      // Envoi sans endsAt
      const res = await patchAssignment(
        makeRequest({ status: AssignmentStatus.ENDED }),
        makeDetailContext('assignment-1')
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.assignment.status).toBe(AssignmentStatus.ENDED);
      // Vérifier que update a été appelé avec endsAt défini
      const updateCall = mockUpdate.mock.calls[0];
      expect(updateCall[0].data.endsAt).toBeDefined();
    });
  });

  describe('GET /api/assistante/students', () => {
    it('returns paginated students list', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.student.count as jest.Mock).mockResolvedValue(0);

      const res = await getStudents(new Request('http://localhost/'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.pagination).toBeDefined();
      expect(body.students).toEqual([]);
    });

    it('filters by hasCoach=true', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.student.count as jest.Mock).mockResolvedValue(0);

      const res = await getStudents(new Request('http://localhost/?hasCoach=true'));

      expect(res.status).toBe(200);
    });

    it('rejects invalid gradeLevel enum with 400', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });

      const res = await getStudents(new Request('http://localhost/?gradeLevel=INVALID'));

      expect(res.status).toBe(400);
    });

    it('rejects invalid academicTrack enum with 400', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });

      const res = await getStudents(new Request('http://localhost/?academicTrack=INVALID'));

      expect(res.status).toBe(400);
    });

    it('rejects invalid stmgPathway enum with 400', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });

      const res = await getStudents(new Request('http://localhost/?stmgPathway=INVALID'));

      expect(res.status).toBe(400);
    });

    it('clamps page to minimum 1 when negative', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.student.count as jest.Mock).mockResolvedValue(0);

      const res = await getStudents(new Request('http://localhost/?page=-1'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.pagination.page).toBe(1);
    });

    it('clamps limit to maximum 100', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.student.count as jest.Mock).mockResolvedValue(0);

      const res = await getStudents(new Request('http://localhost/?limit=1000'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/assistante/coaches', () => {
    it('returns coaches list with stats', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
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
          // activeStudents is now calculated from studentAssignments.length (filtered by active window)
          studentAssignments: [
            { id: 'assignment-1', student: { id: 's1', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' } },
            { id: 'assignment-2', student: { id: 's2', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' } },
          ],
          _count: { studentAssignments: 5, sessions: 10 }, // _count includes historical assignments
          createdAt: new Date(),
        },
      ] as any);
      (prisma.coachProfile.count as jest.Mock).mockResolvedValue(1);

      const res = await getCoaches(new Request('http://localhost/'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.coaches).toHaveLength(1);
      // activeStudents reflects only currently active assignments (filtered by activeAssignmentWhere)
      expect(body.coaches[0].stats.activeStudents).toBe(2);
    });
  });

  describe('GET /api/assistante/assignments', () => {
    it('rejects invalid status query param with 400', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });

      const res = await getAssignments(new Request('http://localhost/?status=INVALID'));

      expect(res.status).toBe(400);
    });

    it('accepts valid status query param', async () => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.coachStudentAssignment.count as jest.Mock).mockResolvedValue(0);

      const res = await getAssignments(new Request('http://localhost/?status=ACTIVE'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });
});
