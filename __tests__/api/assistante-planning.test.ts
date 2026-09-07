/**
 * GET /api/assistante/planning — Tâche 12.
 *
 * Le filtre `studentId` (un `Student.id`) doit interroger `SessionBooking`
 * via `studentProfileId` directement — plus de résolution `Student.userId`
 * comme unique mécanisme de filtrage. L'historique COMPLETED/CANCELLED
 * jamais réconcilié avec un profil (`studentProfileId: null`) reste visible
 * via une projection legacy explicitement labellisée (`identitySource:
 * 'LEGACY_USER'`), jamais une occurrence active/future (attendue résolue par
 * le gate `ACTIVE_FUTURE_SESSION_WITHOUT_STUDENT_PROFILE`).
 */
import { GET } from '@/app/api/assistante/planning/route';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    stageSession: { findMany: jest.fn().mockResolvedValue([]) },
    sessionBooking: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

function makeRequest(url: string): NextRequest {
  const req = { nextUrl: new URL(url) } as unknown as NextRequest;
  return req;
}

describe('GET /api/assistante/planning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
  });

  it('filters SessionBooking by studentProfileId directly, no legacy resolution round-trip for the primary filter', async () => {
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ userId: 'student-user-1' });

    const req = makeRequest(
      'http://localhost/api/assistante/planning?from=2026-03-01&to=2026-03-10&studentId=student-profile-1',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const call = (prisma.sessionBooking.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ studentProfileId: 'student-profile-1' })]),
    );
  });

  it('still returns 404 when the studentId does not resolve to a Student', async () => {
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

    const req = makeRequest(
      'http://localhost/api/assistante/planning?from=2026-03-01&to=2026-03-10&studentId=missing',
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('does not filter SessionBooking at all when no studentId is provided', async () => {
    const req = makeRequest('http://localhost/api/assistante/planning?from=2026-03-01&to=2026-03-10');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const call = (prisma.sessionBooking.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.OR).toBeUndefined();
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  it('marks a fully profile-resolved booking as identitySource PROFILE, using the canonical ids', async () => {
    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'booking-1',
        title: 'Maths',
        subject: 'MATHEMATIQUES',
        scheduledDate: new Date('2026-03-05T00:00:00Z'),
        startTime: '10:00',
        endTime: '11:00',
        location: null,
        status: 'SCHEDULED',
        student: { id: 'student-user-1', firstName: 'A', lastName: 'B' },
        studentProfile: { id: 'student-profile-1', firstName: null, lastName: null },
        coach: { id: 'coach-user-1', firstName: 'C', lastName: 'D', coachProfile: { pseudonym: 'Helios' } },
        coachProfile: { id: 'coach-profile-1', pseudonym: 'Helios' },
      },
    ]);

    const req = makeRequest('http://localhost/api/assistante/planning?from=2026-03-01&to=2026-03-10');
    const res = await GET(req);
    const body = await res.json();

    expect(body.events).toHaveLength(1);
    expect(body.events[0].identitySource).toBe('PROFILE');
    expect(body.events[0].student.id).toBe('student-profile-1');
    expect(body.events[0].coach.id).toBe('coach-profile-1');
  });

  it('marks a booking without a resolved profile as identitySource LEGACY_USER, falling back to the User ids', async () => {
    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'booking-2',
        title: 'Ancienne séance',
        subject: 'MATHEMATIQUES',
        scheduledDate: new Date('2026-03-05T00:00:00Z'),
        startTime: '10:00',
        endTime: '11:00',
        location: null,
        status: 'COMPLETED',
        student: { id: 'student-user-1', firstName: 'A', lastName: 'B' },
        studentProfile: null,
        coach: { id: 'coach-user-1', firstName: 'C', lastName: 'D', coachProfile: { pseudonym: 'Helios' } },
        coachProfile: null,
      },
    ]);

    const req = makeRequest('http://localhost/api/assistante/planning?from=2026-03-01&to=2026-03-10');
    const res = await GET(req);
    const body = await res.json();

    expect(body.events).toHaveLength(1);
    expect(body.events[0].identitySource).toBe('LEGACY_USER');
    expect(body.events[0].student.id).toBe('student-user-1');
    expect(body.events[0].coach.id).toBe('coach-user-1');
    expect(body.events[0].coach.pseudonym).toBe('Helios');
  });

  it('includes a legacy fallback clause restricted to COMPLETED/CANCELLED when filtering by studentId', async () => {
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ userId: 'student-user-1' });

    const req = makeRequest(
      'http://localhost/api/assistante/planning?from=2026-03-01&to=2026-03-10&studentId=student-profile-1',
    );
    await GET(req);

    const call = (prisma.sessionBooking.findMany as jest.Mock).mock.calls[0][0];
    const legacyClause = call.where.OR.find((clause: any) => clause.AND);
    expect(legacyClause).toBeDefined();
    const flatAnd = Object.assign({}, ...legacyClause.AND);
    expect(flatAnd.studentProfileId).toBeNull();
    expect(flatAnd.studentId).toBe('student-user-1');
    expect(flatAnd.status).toEqual({ in: ['COMPLETED', 'CANCELLED'] });
  });
});
