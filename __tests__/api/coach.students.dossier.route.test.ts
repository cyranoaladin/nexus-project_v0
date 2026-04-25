/**
 * Phase 6 — Coach student dossier route
 * Tests RBAC: 401 (no session), 403 (wrong role), 403 (coach not rattached),
 * happy path (rattached coach), and admin bypass.
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: { findFirst: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    mathsProgress: { findMany: jest.fn() },
    bilan: { count: jest.fn() },
    ariaConversation: { count: jest.fn() },
  },
}));

import { GET } from '@/app/api/coach/students/[studentId]/dossier/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const mockAuth = auth as jest.Mock;

function makeContext(studentId: string) {
  return { params: Promise.resolve({ studentId }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.mathsProgress.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.bilan.count as jest.Mock).mockResolvedValue(0);
  (prisma.ariaConversation.count as jest.Mock).mockResolvedValue(0);
});

describe('GET /api/coach/students/[studentId]/dossier', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/'), makeContext('student-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is not COACH or ADMIN', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } });
    const res = await GET(new Request('http://localhost/'), makeContext('student-1'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when COACH is not rattached to the student', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/'), makeContext('student-other'));
    expect(res.status).toBe(403);
    expect(prisma.sessionBooking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { coachId: 'coach-1', studentId: 'student-other' },
      }),
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the student User does not exist (rattached coach)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({ id: 'sb-1' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/'), makeContext('ghost'));
    expect(res.status).toBe(404);
  });

  it('returns full dossier for a rattached COACH', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({ id: 'sb-1' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-1',
      firstName: 'Ahmed',
      lastName: 'B',
      email: 'a@b.tn',
      role: 'STUDENT',
      student: {
        id: 's-pk-1',
        grade: '1ère',
        gradeLevel: 'PREMIERE',
        academicTrack: 'EDS_GENERALE',
        specialties: ['MATHEMATIQUES'],
        stmgPathway: null,
        credits: 10,
        totalSessions: 4,
        completedSessions: 3,
      },
    });
    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([
      { id: 'sb-1', subject: 'MATHEMATIQUES', scheduledDate: new Date(), startTime: '10:00', endTime: '11:00', status: 'COMPLETED', type: 'INDIVIDUAL', modality: 'ONLINE', creditsUsed: 2 },
    ]);
    (prisma.bilan.count as jest.Mock).mockResolvedValue(2);
    (prisma.ariaConversation.count as jest.Mock).mockResolvedValue(5);

    const res = await GET(new Request('http://localhost/'), makeContext('student-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.student.id).toBe('student-1');
    expect(body.student.firstName).toBe('Ahmed');
    expect(body.recentSessions).toHaveLength(1);
    expect(body.counts).toEqual({ bilans: 2, ariaConversations: 5 });

    // RBAC: when COACH, recentSessions must be filtered to that coach
    expect(prisma.sessionBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: 'student-1', coachId: 'coach-1' }),
      }),
    );
  });

  it('ADMIN bypasses the rattachement check and sees all sessions', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-1', firstName: 'X', lastName: 'Y', email: 'x@y.tn', role: 'STUDENT', student: null,
    });

    const res = await GET(new Request('http://localhost/'), makeContext('student-1'));
    expect(res.status).toBe(200);
    expect(prisma.sessionBooking.findFirst).not.toHaveBeenCalled();

    // ADMIN: recentSessions NOT filtered by coachId
    const findManyCall = (prisma.sessionBooking.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where).not.toHaveProperty('coachId');
    expect(findManyCall.where.studentId).toBe('student-1');
  });
});
