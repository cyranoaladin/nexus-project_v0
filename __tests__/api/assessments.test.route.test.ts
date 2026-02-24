/**
 * Assessment Test API — Complete Test Suite
 *
 * Tests: GET /api/assessments/test
 *
 * Source: app/api/assessments/test/route.ts
 */

import { GET } from '@/app/api/assessments/test/route';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

describe('GET /api/assessments/test', () => {
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
    expect(body.hint).toContain('prisma');
  });
});
