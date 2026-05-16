import { GET } from '@/app/api/coach/nsi-pratique-2026/students/route';
import { GET as GET_STUDENT_PROGRESS } from '@/app/api/coach/nsi-pratique-2026/students/[studentId]/progress/route';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const mockRequireRole = jest.fn();
jest.mock('@/lib/guards', () => ({
  requireAnyRole: (...args: unknown[]) => mockRequireRole(...args),
  isErrorResponse: (v: unknown) => v instanceof NextResponse,
}));

const mockGetAssignedStudents = jest.fn();
const mockIsCoachAssigned = jest.fn();
jest.mock('@/lib/rbac/coach-student-access', () => ({
  getAssignedStudentsForCoach: (...args: unknown[]) => mockGetAssignedStudents(...args),
  isCoachAssignedToStudent: (...args: unknown[]) => mockIsCoachAssigned(...args),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    nsiPracticeProgress: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
    },
  },
}));

const coachSession = { user: { id: 'c1', role: 'COACH' } };

describe('GET /api/coach/nsi-pratique-2026/students', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not COACH', async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('allows ADMIN through role guard without exposing coach-only assignments', async () => {
    mockRequireRole.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mockGetAssignedStudents.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.students).toEqual([]);
    expect(mockRequireRole).toHaveBeenCalledWith(['COACH', 'ADMIN']);
  });

  it('student cannot access coach route', async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns empty list when no NSI assignments', async () => {
    mockRequireRole.mockResolvedValue(coachSession);
    mockGetAssignedStudents.mockResolvedValue([
      { subjects: ['MATHEMATIQUES'], student: { id: 's1', userId: 'u1', firstName: 'Test', lastName: 'Student' } },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.students).toEqual([]);
    expect(body.count).toBe(0);
  });

  it('returns NSI students with progress summary', async () => {
    mockRequireRole.mockResolvedValue(coachSession);
    mockGetAssignedStudents.mockResolvedValue([
      { subjects: ['NSI'], student: { id: 's1', userId: 'u1', firstName: 'Rania', lastName: 'Chanoufi' } },
      { subjects: ['NSI'], student: { id: 's2', userId: 'u2', firstName: 'Eya', lastName: 'Chanoufi' } },
    ]);
    (prisma.nsiPracticeProgress.findMany as jest.Mock).mockResolvedValue([
      { userId: 'u1', data: { subjects: { 1: { status: 'mastered' }, 2: { status: 'in_progress' } } }, updatedAt: new Date('2026-05-16T10:00:00Z') },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(2);
    expect(body.students[0].firstName).toBe('Rania');
    expect(body.students[0].hasProgress).toBe(true);
    expect(body.students[0].summary.subjectsMastered).toBe(1);
    expect(body.students[0].summary.subjectsTotal).toBe(2);
    expect(body.students[1].hasProgress).toBe(false);
  });
});

describe('GET /api/coach/nsi-pratique-2026/students/[studentId]/progress', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const res = await GET_STUDENT_PROGRESS(
      new Request('http://localhost'),
      { params: Promise.resolve({ studentId: 's1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when coach is not assigned', async () => {
    mockRequireRole.mockResolvedValue(coachSession);
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ userId: 'u1' });
    mockIsCoachAssigned.mockResolvedValue(false);

    const res = await GET_STUDENT_PROGRESS(
      new Request('http://localhost'),
      { params: Promise.resolve({ studentId: 's1' }) }
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('assigné');
  });

  it('returns 404 when student does not exist', async () => {
    mockRequireRole.mockResolvedValue(coachSession);
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET_STUDENT_PROGRESS(
      new Request('http://localhost'),
      { params: Promise.resolve({ studentId: 's1' }) }
    );
    expect(res.status).toBe(404);
    expect(mockIsCoachAssigned).not.toHaveBeenCalled();
  });

  it('returns progress when coach is assigned', async () => {
    mockRequireRole.mockResolvedValue(coachSession);
    mockIsCoachAssigned.mockResolvedValue(true);
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ userId: 'u1' });
    (prisma.nsiPracticeProgress.findUnique as jest.Mock).mockResolvedValue({
      data: { subjects: { 1: { status: 'mastered' } } },
      updatedAt: new Date('2026-05-16T12:00:00Z'),
      version: 1,
    });

    const res = await GET_STUDENT_PROGRESS(
      new Request('http://localhost'),
      { params: Promise.resolve({ studentId: 's1' }) }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.subjects['1'].status).toBe('mastered');
    expect(body.version).toBe(1);
  });

  it('returns null when student has no progress', async () => {
    mockRequireRole.mockResolvedValue(coachSession);
    mockIsCoachAssigned.mockResolvedValue(true);
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ userId: 'u1' });
    (prisma.nsiPracticeProgress.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET_STUDENT_PROGRESS(
      new Request('http://localhost'),
      { params: Promise.resolve({ studentId: 's1' }) }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
  });
});
