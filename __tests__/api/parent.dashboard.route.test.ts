/**
 * Parent Dashboard API — Complete Test Suite
 *
 * Tests: GET /api/parent/dashboard
 *
 * Source: app/api/parent/dashboard/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { GET } from '@/app/api/parent/dashboard/route';
import { auth } from '@/auth';

const mockAuth = auth as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

describe('GET /api/parent/dashboard', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-PARENT role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('should return 404 when parent profile not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'p1', role: 'PARENT', firstName: 'Karim', lastName: 'Ben Ali', email: 'k@test.com' },
    } as any);
    prisma.parentProfile.findUnique.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(404);
  });

  function baseChild(overrides: Partial<{ id: string; firstName: string; lastName: string }> = {}) {
    return {
      id: overrides.id ?? 'stu-1',
      grade: 'Terminale',
      school: 'Lycée Pilote',
      credits: 4,
      totalSessions: 10,
      completedSessions: 7,
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      user: {
        id: 'u-stu-1',
        firstName: overrides.firstName ?? 'Ahmed',
        lastName: overrides.lastName ?? 'Ben Ali',
        email: 'ahmed@test.com',
        activatedAt: new Date('2026-01-01'),
        activationExpiry: null,
      },
      subscriptions: [
        {
          id: 'sub-1',
          planName: 'Hybride',
          monthlyPrice: 450,
          creditsPerMonth: 4,
          status: 'ACTIVE',
          startDate: new Date('2026-01-01'),
          endDate: null,
          ariaSubjects: ['MATHEMATIQUES'],
          ariaCost: 50,
        },
      ],
      badges: [
        {
          earnedAt: new Date('2026-02-15'),
          badge: { id: 'b1', name: 'Premier Pas', icon: '🎯', category: 'ENGAGEMENT' },
        },
      ],
    };
  }

  function bookingRow(overrides: Partial<{
    id: string;
    subject: string;
    academicCourseKey: string | null;
    scheduledDate: Date;
    startTime: string;
    endTime: string;
    status: string;
    modality: string;
    location: string | null;
    type: string;
    duration: number;
    planningSeriesId: string | null;
  }> = {}) {
    return {
      id: overrides.id ?? 'sess-1',
      subject: overrides.subject ?? 'MATHEMATIQUES',
      academicCourseKey: overrides.academicCourseKey ?? 'eds-maths-terminale',
      scheduledDate: overrides.scheduledDate ?? new Date('2026-03-01T00:00:00.000Z'),
      startTime: overrides.startTime ?? '10:00',
      endTime: overrides.endTime ?? '11:00',
      status: overrides.status ?? 'SCHEDULED',
      modality: overrides.modality ?? 'ONLINE',
      location: overrides.location ?? null,
      type: overrides.type ?? 'INDIVIDUAL',
      duration: overrides.duration ?? 60,
      planningSeriesId: overrides.planningSeriesId ?? 'series-1',
      coach: { firstName: 'Sarah', lastName: 'Coach', coachProfile: { pseudonym: 'Coach Sarah' } },
    };
  }

  it('should return dashboard data for authenticated parent', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'p1', role: 'PARENT', firstName: 'Karim', lastName: 'Ben Ali', email: 'k@test.com' },
    } as any);

    prisma.parentProfile.findUnique.mockResolvedValue({
      id: 'pp-1',
      userId: 'p1',
      children: [baseChild()],
    });
    prisma.sessionBooking.findMany.mockResolvedValue([bookingRow()]);
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        createdAt: new Date('2026-02-01'),
        amount: 450,
        description: 'Abonnement Hybride',
        status: 'COMPLETED',
        type: 'SUBSCRIPTION',
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.parent.firstName).toBe('Karim');
    expect(body.children).toHaveLength(1);
    expect(body.children[0].firstName).toBe('Ahmed');
    expect(body.children[0].subscription).toBe('Hybride');
    expect(body.children[0].sessions).toHaveLength(1);
    expect(body.children[0].badges).toHaveLength(1);
    expect(body.children[0].progress).toBe(70);
    expect(body.payments).toHaveLength(1);

    // The session is queried directly by the canonical studentProfileId, not
    // via the legacy User.id-keyed `studentSessions` relation.
    expect(prisma.sessionBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentProfileId: 'stu-1' }),
      })
    );

    // Checklist: time/course/coach/modality/location/status/series.
    const session = body.children[0].sessions[0];
    expect(session.scheduledAt).toBe('2026-03-01T10:00:00.000Z');
    expect(session.endAt).toBe('2026-03-01T11:00:00.000Z');
    expect(session.academicCourseKey).toBe('eds-maths-terminale');
    expect(session.coachName).toBe('Coach Sarah');
    expect(session.modality).toBe('ONLINE');
    expect(session.location).toBeNull();
    expect(session.status).toBe('SCHEDULED');
    expect(session.planningSeriesId).toBe('series-1');
  });

  it('should scope each child session query to that child studentProfileId (two independent children)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'p1', role: 'PARENT', firstName: 'Karim', lastName: 'Ben Ali', email: 'k@test.com' },
    } as any);

    prisma.parentProfile.findUnique.mockResolvedValue({
      id: 'pp-1',
      userId: 'p1',
      children: [
        baseChild({ id: 'stu-A', firstName: 'Amine' }),
        baseChild({ id: 'stu-B', firstName: 'Bilel' }),
      ],
    });
    prisma.sessionBooking.findMany.mockImplementation(async ({ where }: any) => {
      if (where.studentProfileId === 'stu-A') return [bookingRow({ id: 'sess-A', subject: 'MATHEMATIQUES' })];
      if (where.studentProfileId === 'stu-B') return [bookingRow({ id: 'sess-B', subject: 'FRANCAIS' })];
      return [];
    });
    prisma.payment.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    const childA = body.children.find((c: any) => c.id === 'stu-A');
    const childB = body.children.find((c: any) => c.id === 'stu-B');
    expect(childA.sessions).toHaveLength(1);
    expect(childA.sessions[0].id).toBe('sess-A');
    expect(childB.sessions).toHaveLength(1);
    expect(childB.sessions[0].id).toBe('sess-B');
    // No cross-contamination between children.
    expect(childA.sessions.map((s: any) => s.id)).not.toContain('sess-B');
    expect(childB.sessions.map((s: any) => s.id)).not.toContain('sess-A');
  });

  it('should filter each child session query to future-only, active-status bookings', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'p1', role: 'PARENT', firstName: 'Karim', lastName: 'Ben Ali', email: 'k@test.com' },
    } as any);

    prisma.parentProfile.findUnique.mockResolvedValue({
      id: 'pp-1',
      userId: 'p1',
      children: [baseChild()],
    });
    prisma.sessionBooking.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);

    await GET();

    const callArgs = prisma.sessionBooking.findMany.mock.calls[0][0];
    expect(callArgs.where.status).toBe('SCHEDULED');
    expect(callArgs.where.scheduledDate).toHaveProperty('gte');
    expect(callArgs.orderBy).toEqual([{ scheduledDate: 'asc' }, { startTime: 'asc' }]);
  });

  it('should handle parent with no children', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'p1', role: 'PARENT', firstName: 'Karim', lastName: 'Ben Ali', email: 'k@test.com' },
    } as any);

    prisma.parentProfile.findUnique.mockResolvedValue({
      id: 'pp-1',
      userId: 'p1',
      children: [],
    });
    prisma.payment.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.children).toEqual([]);
    expect(body.payments).toEqual([]);
  });

  it('should return 500 on DB error', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'p1', role: 'PARENT', firstName: 'K', lastName: 'B', email: 'k@t.com' },
    } as any);
    prisma.parentProfile.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
