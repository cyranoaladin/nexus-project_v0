import { auth } from '@/auth';
/**
 * Integration Tests - Student Badges API
 */

import { GET } from '@/app/api/students/[studentId]/badges/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth');
jest.mock('@/lib/prisma');

const mockGetServerSession = auth as unknown as jest.Mock;

describe('GET /api/students/:studentId/badges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET(undefined as never, {
      params: Promise.resolve({ studentId: 'student-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not a student', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', role: 'PARENT' },
      expires: '2026-12-31',
    } as any);

    const response = await GET(undefined as never, {
      params: Promise.resolve({ studentId: 'student-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 404 when student is not found', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
      expires: '2026-12-31',
    } as any);

    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET(undefined as never, {
      params: Promise.resolve({ studentId: 'student-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Student not found');
  });

  it('returns 403 when studentId does not match session', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
      expires: '2026-12-31',
    } as any);

    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'student-2' });

    const response = await GET(undefined as never, {
      params: Promise.resolve({ studentId: 'student-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns mapped badges with isNew flag', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
      expires: '2026-12-31',
    } as any);

    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 'student-1' });

    const recentDate = new Date();
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);

    (prisma.studentBadge.findMany as jest.Mock).mockResolvedValue([
      {
        earnedAt: recentDate,
        badge: {
          id: 'badge-1',
          name: 'Premier Pas',
          description: 'Première connexion',
          category: 'ASSIDUITE',
          icon: '👋',
        },
      },
      {
        earnedAt: oldDate,
        badge: {
          id: 'badge-2',
          name: 'Esprit Vif',
          description: '25 questions ARIA',
          category: 'ARIA',
          icon: '🤖',
        },
      },
    ]);

    const response = await GET(undefined as never, {
      params: Promise.resolve({ studentId: 'student-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.badges).toHaveLength(2);
    expect(data.badges[0]).toMatchObject({
      id: 'badge-1',
      name: 'Premier Pas',
      category: 'ASSIDUITE',
      isNew: true,
    });
    expect(data.badges[1]).toMatchObject({
      id: 'badge-2',
      name: 'Esprit Vif',
      category: 'ARIA',
      isNew: false,
    });
  });
});
