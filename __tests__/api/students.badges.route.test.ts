/**
 * Students Badges API — Complete Test Suite
 *
 * Tests: GET /api/students/[studentId]/badges
 *
 * Source: app/api/students/[studentId]/badges/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { GET } from '@/app/api/students/[studentId]/badges/route';
import { auth } from '@/auth';

const mockAuth = auth as jest.MockedFunction<typeof auth>;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(studentId: string): [Request, { params: Promise<{ studentId: string }> }] {
  const req = new Request(`http://localhost:3000/api/students/${studentId}/badges`, { method: 'GET' });
  return [req, { params: Promise.resolve({ studentId }) }];
}

describe('GET /api/students/[studentId]/badges', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET(...makeRequest('stu-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 403 for non-ELEVE role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } } as any);

    const res = await GET(...makeRequest('stu-1'));
    const body = await res.json();

    expect(res.status).toBe(403);
  });

  it('should return 404 when student not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.student.findUnique.mockResolvedValue(null);

    const res = await GET(...makeRequest('stu-1'));
    const body = await res.json();

    expect(res.status).toBe(404);
  });

  it('should return 403 when studentId does not match', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.student.findUnique.mockResolvedValue({ id: 'stu-other' });

    const res = await GET(...makeRequest('stu-1'));
    const body = await res.json();

    expect(res.status).toBe(403);
  });

  it('should return badges for authorized student', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.student.findUnique.mockResolvedValue({ id: 'stu-1' });
    prisma.studentBadge.findMany.mockResolvedValue([
      {
        earnedAt: new Date(),
        badge: {
          id: 'badge-1',
          name: 'Premier Pas',
          description: 'Première session complétée',
          category: 'ENGAGEMENT',
          icon: '🎯',
        },
      },
      {
        earnedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        badge: {
          id: 'badge-2',
          name: 'Régulier',
          description: '5 sessions complétées',
          category: 'ASSIDUITY',
          icon: null,
        },
      },
    ]);

    const res = await GET(...makeRequest('stu-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.badges).toHaveLength(2);
    expect(body.badges[0].name).toBe('Premier Pas');
    expect(body.badges[0].isNew).toBe(true); // earned today
    expect(body.badges[1].isNew).toBe(false); // earned 30 days ago
    expect(body.badges[1].icon).toBe('🏅'); // fallback icon
  });

  it('should return empty badges array when none earned', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.student.findUnique.mockResolvedValue({ id: 'stu-1' });
    prisma.studentBadge.findMany.mockResolvedValue([]);

    const res = await GET(...makeRequest('stu-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.badges).toEqual([]);
  });

  it('should return 500 on DB error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.student.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await GET(...makeRequest('stu-1'));
    expect(res.status).toBe(500);
  });
});
