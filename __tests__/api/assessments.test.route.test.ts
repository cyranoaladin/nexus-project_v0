/**
 * Assessment Test API — Complete Test Suite
 *
 * Tests: GET /api/assessments/test
 *
 * Source: app/api/assessments/test/route.ts
 */

import { GET } from '@/app/api/assessments/test/route';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';

let prisma: any;
const mockAuth = auth as jest.Mock;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
});

describe('GET /api/assessments/test', () => {
  it('should reject unauthenticated access before touching assessment data', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(prisma.assessment.count).not.toHaveBeenCalled();
    expect(prisma.assessment.findMany).not.toHaveBeenCalled();
  });

  it.each(['PARENT', 'ELEVE', 'COACH', 'ASSISTANTE'])(
    'should reject %s access before touching assessment data',
    async (role) => {
      mockAuth.mockResolvedValue({ user: { id: `${role.toLowerCase()}-1`, role } });

      const res = await GET();

      expect(res.status).toBe(403);
      expect(prisma.assessment.count).not.toHaveBeenCalled();
      expect(prisma.assessment.findMany).not.toHaveBeenCalled();
    }
  );

  it('should return success with assessment count and recent data', async () => {
    prisma.assessment.count.mockResolvedValue(42);
    prisma.assessment.findMany.mockResolvedValue([
      { id: 'a1', subject: 'MATHS', grade: 'Terminale', status: 'COMPLETED', createdAt: new Date() },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.totalCount).toBe(42);
    expect(body.data.recentAssessments).toHaveLength(1);
  });

  it('should return 500 on DB error', async () => {
    prisma.assessment.count.mockRejectedValue(new Error('DB error'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Internal server error');
    expect(body).not.toHaveProperty('message');
    expect(body).not.toHaveProperty('hint');
  });
});
