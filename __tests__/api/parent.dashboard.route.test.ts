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

  it('should return dashboard data for authenticated parent', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'p1', role: 'PARENT', firstName: 'Karim', lastName: 'Ben Ali', email: 'k@test.com' },
    } as any);

    prisma.parentProfile.findUnique.mockResolvedValue({
      id: 'pp-1',
      userId: 'p1',
      children: [
        {
          id: 'stu-1',
          grade: 'Terminale',
          school: 'Lycée Pilote',
          credits: 4,
          totalSessions: 10,
          completedSessions: 7,
          user: {
            id: 'u-stu-1',
            firstName: 'Ahmed',
            lastName: 'Ben Ali',
            studentSessions: [
              {
                id: 'sess-1',
                subject: 'MATHS',
                scheduledDate: new Date('2026-03-01T10:00:00Z'),
                startTime: '10:00',
                endTime: '11:00',
                status: 'SCHEDULED',
                modality: 'ONLINE',
                type: 'INDIVIDUAL',
                duration: 60,
                coachId: 'c1',
                coach: { firstName: 'Sarah', lastName: 'Coach', coachProfile: { pseudonym: 'Coach Sarah' } },
              },
            ],
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
        },
      ],
    });

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
