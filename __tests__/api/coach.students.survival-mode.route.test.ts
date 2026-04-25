jest.mock('@/auth', () => ({ auth: jest.fn() }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: { findFirst: jest.fn() },
    student: { findUnique: jest.fn(), update: jest.fn() },
    coachNote: { create: jest.fn() },
  },
}));

import { POST } from '@/app/api/coach/students/[studentId]/survival-mode/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const mockAuth = auth as jest.Mock;

function ctx(studentId: string) {
  return { params: Promise.resolve({ studentId }) };
}

function req(body: unknown) {
  return new Request('http://localhost/api/coach/students/student-1/survival-mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/coach/students/[studentId]/survival-mode', () => {
  it('rejects unauthenticated calls', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(req({ enabled: true }), ctx('student-1'));

    expect(res.status).toBe(401);
  });

  it('rejects parent role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });

    const res = await POST(req({ enabled: true }), ctx('student-1'));

    expect(res.status).toBe(403);
  });

  it('rejects a coach not rattached to the student', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await POST(req({ enabled: true }), ctx('student-1'));

    expect(res.status).toBe(403);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  it('enables survival mode for a STMG student and logs a CoachNote', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({ id: 'booking-1' });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-pk-1',
      userId: 'student-1',
      academicTrack: 'STMG',
    });
    (prisma.student.update as jest.Mock).mockResolvedValue({
      id: 'student-pk-1',
      survivalMode: true,
    });
    (prisma.coachNote.create as jest.Mock).mockResolvedValue({ id: 'note-1' });

    const res = await POST(req({ enabled: true, reason: 'Objectif 8/20' }), ctx('student-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.survivalMode).toBe(true);
    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      data: expect.objectContaining({
        survivalMode: true,
        survivalModeReason: 'Objectif 8/20',
        survivalModeBy: 'coach-1',
        survivalModeAt: expect.any(Date),
      }),
      select: expect.any(Object),
    });
    expect(prisma.coachNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-1',
          coachId: 'coach-1',
          body: expect.stringContaining('Mode Survie active'),
        }),
      }),
    );
  });

  it('rejects activation for a non-STMG student', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-pk-1',
      userId: 'student-1',
      academicTrack: 'EDS_GENERALE',
    });

    const res = await POST(req({ enabled: true }), ctx('student-1'));

    expect(res.status).toBe(400);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });
});
