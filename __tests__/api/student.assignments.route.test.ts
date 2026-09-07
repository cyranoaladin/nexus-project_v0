/**
 * GET /api/student/assignments
 *
 * Correctif suivi de la Tâche 12 (commit 7c3c2a713) : `POST /api/sessions/book`
 * exige désormais `studentId`/`coachId` canoniques (`Student.id`/
 * `CoachProfile.id`) + `assignmentId` + `academicCourseKey`, mais aucun
 * endpoint ne permettait à un élève de découvrir ses propres assignations
 * actives pour construire ce payload. Ce test verrouille le contrat de ce
 * nouvel endpoint de lecture seule.
 */
import { GET } from '@/app/api/student/assignments/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    coachStudentAssignment: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/curriculum/catalog', () => ({
  courseLabel: (courseKey: string) => `Label(${courseKey})`,
}));

const mockSession = { user: { id: 'user-eleve-1', email: 'e@test.com', role: 'ELEVE' as const } };

describe('GET /api/student/assignments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
  });

  it('returns 401/403 passthrough when not ELEVE', async () => {
    (requireRole as jest.Mock).mockResolvedValue({
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
      headers: new Headers(),
    });
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await GET({} as any);
    expect(response.status).toBe(403);
  });

  it('returns 404 when caller has no Student profile', async () => {
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET({} as any);
    expect(response.status).toBe(404);
  });

  it('returns the caller Student.id and only resolved active assignments', async () => {
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'assignment-1',
        coachId: 'coach-profile-1',
        academicCourseKeys: ['eds-maths-terminale'],
        coach: {
          userId: 'coach-user-1',
          pseudonym: 'Hélios',
          user: { id: 'coach-user-1', firstName: 'Jane', lastName: 'Doe' },
        },
      },
    ]);

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.studentId).toBe('student-1');
    expect(body.assignments).toEqual([
      {
        id: 'assignment-1',
        coachProfileId: 'coach-profile-1',
        coachUserId: 'coach-user-1',
        coachName: 'Jane Doe',
        coachPseudonym: 'Hélios',
        academicCourseKeys: [{ courseKey: 'eds-maths-terminale', label: 'Label(eds-maths-terminale)' }],
      },
    ]);

    // Only STAFF_VERIFIED / BACKFILL_AUTO assignments are queried — never
    // BACKFILL_UNRESOLVED/BACKFILL_AMBIGUOUS ones, which carry no usable
    // academicCourseKey for a student to pick from.
    const whereArg = (prisma.coachStudentAssignment.findMany as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.courseScopeState).toEqual({ in: ['STAFF_VERIFIED', 'BACKFILL_AUTO'] });
    expect(whereArg.studentId).toBe('student-1');
  });

  it('filters out an assignment left with zero resolved course keys', async () => {
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'assignment-empty',
        coachId: 'coach-profile-1',
        academicCourseKeys: [],
        coach: {
          userId: 'coach-user-1',
          pseudonym: null,
          user: { id: 'coach-user-1', firstName: 'Jane', lastName: 'Doe' },
        },
      },
    ]);

    const response = await GET({} as any);
    const body = await response.json();

    expect(body.assignments).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    (prisma.student.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

    const response = await GET({} as any);
    expect(response.status).toBe(500);
  });
});
