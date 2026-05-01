/**
 * Tests API: GET /api/coach/eaf-stage-printemps/students
 */

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((result): result is Response => {
    return result && typeof result === 'object' && 'status' in result && typeof result.json === 'function';
  }),
}));

jest.mock('@/lib/rbac/coach-student-access', () => ({
  getAssignedStudentsForCoach: jest.fn(),
  getCoachProfileForUser: jest.fn(),
  CoachNotAssignedError: class CoachNotAssignedError extends Error {
    constructor(msg = "Vous n'êtes pas assigné à cet élève") {
      super(msg);
      this.name = 'CoachNotAssignedError';
    }
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    bilan: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { GET } from '@/app/api/coach/eaf-stage-printemps/students/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  getAssignedStudentsForCoach,
  getCoachProfileForUser,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';

const mockRequireRole = requireRole as jest.Mock;
const mockIsErrorResponse = isErrorResponse as unknown as jest.Mock;
const mockGetAssignedStudents = getAssignedStudentsForCoach as jest.Mock;
const mockGetCoachProfile = getCoachProfileForUser as jest.Mock;

const SESSION_COACH = { user: { id: 'coach-user-1', role: 'COACH' } };

const makeStudent = (overrides = {}) => ({
  id: 'student-1',
  userId: 'user-1',
  firstName: 'Ahmed',
  lastName: 'Ben Ali',
  email: 'ahmed@test.com',
  gradeLevel: 'PREMIERE',
  academicTrack: 'EDS_GENERALE',
  school: 'Lycée pilote',
  ...overrides,
});

const makeAssignment = (student = makeStudent()) => ({
  assignmentId: 'assign-1',
  assignmentType: 'PRIMARY',
  subjects: ['FRANCAIS'],
  notes: null,
  startsAt: new Date(),
  endsAt: null,
  student,
});

describe('GET /api/coach/eaf-stage-printemps/students', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsErrorResponse.mockImplementation(
      (r: unknown) =>
        r !== null && typeof r === 'object' && 'status' in (r as object) && typeof (r as Response).json === 'function'
    );
  });

  it('1. Non connecté → 401', async () => {
    mockRequireRole.mockResolvedValue({ json: () => ({ error: 'Unauthorized' }), status: 401 });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('2. Rôle non COACH → 403', async () => {
    mockRequireRole.mockResolvedValue({ json: () => ({ error: 'Forbidden' }), status: 403 });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('3. Coach sans élèves de Première → liste vide', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockGetAssignedStudents.mockResolvedValue([
      makeAssignment(makeStudent({ gradeLevel: 'TERMINALE' })),
    ]);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).bilan.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.students).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('4. Coach avec élèves de Première, aucun bilan → NOT_STARTED', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockGetAssignedStudents.mockResolvedValue([makeAssignment()]);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).bilan.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.students).toHaveLength(1);
    expect(body.students[0].bilanStatus).toBe('NOT_STARTED');
    expect(body.students[0].bilanId).toBeUndefined();
  });

  it('5. Bilan PENDING → statut DRAFT', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockGetAssignedStudents.mockResolvedValue([makeAssignment()]);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).bilan.findMany.mockResolvedValue([
      {
        id: 'bilan-1',
        studentId: 'student-1',
        status: 'PENDING',
        isPublished: false,
        updatedAt: new Date('2026-04-01'),
        createdAt: new Date('2026-04-01'),
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.students[0].bilanStatus).toBe('DRAFT');
    expect(body.students[0].bilanId).toBe('bilan-1');
  });

  it('6. Bilan COMPLETED, isPublished=false → statut COMPLETED', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockGetAssignedStudents.mockResolvedValue([makeAssignment()]);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).bilan.findMany.mockResolvedValue([
      {
        id: 'bilan-1',
        studentId: 'student-1',
        status: 'COMPLETED',
        isPublished: false,
        updatedAt: new Date('2026-04-01'),
        createdAt: new Date('2026-04-01'),
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.students[0].bilanStatus).toBe('COMPLETED');
  });

  it('7. Bilan COMPLETED, isPublished=true → statut VALIDATED', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockGetAssignedStudents.mockResolvedValue([makeAssignment()]);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).bilan.findMany.mockResolvedValue([
      {
        id: 'bilan-1',
        studentId: 'student-1',
        status: 'COMPLETED',
        isPublished: true,
        updatedAt: new Date('2026-04-01'),
        createdAt: new Date('2026-04-01'),
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.students[0].bilanStatus).toBe('VALIDATED');
  });

  it('8. Coach ne voit que ses propres bilans (filtrés par coachId)', async () => {
    mockRequireRole.mockResolvedValue(SESSION_COACH);
    mockGetAssignedStudents.mockResolvedValue([makeAssignment()]);
    mockGetCoachProfile.mockResolvedValue({ id: 'coach-1' });
    (prisma as any).bilan.findMany.mockResolvedValue([]);

    await GET();

    const findManyCall = (prisma as any).bilan.findMany.mock.calls[0][0];
    expect(findManyCall.where.coachId).toBe('coach-1');
  });
});
