/**
 * Admin Directeur Stats API — Complete Test Suite
 *
 * Tests: GET /api/admin/directeur/stats
 *
 * Source: app/api/admin/directeur/stats/route.ts
 */

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((result) => result && typeof result === 'object' && 'status' in result),
}));

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

import { GET } from '@/app/api/admin/directeur/stats/route';
import { requireRole } from '@/lib/guards';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

const mockRequireRole = requireRole as jest.Mock;
const mockGuardRateLimit = guardRateLimitAsync as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  mockRequireRole.mockResolvedValue({
    user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
  });
  mockGuardRateLimit.mockResolvedValue(null);
});

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/directeur/stats', { method: 'GET' });
}

describe('GET /api/admin/directeur/stats', () => {
  it('should return 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 403 for non-ADMIN role', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied. Required role: ADMIN' }), { status: 403 })
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.message).toContain('ADMIN');
  });

  it('rejects unexpected query parameters', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/admin/directeur/stats?rawPayload=true'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Paramètres invalides');
    expect(prisma.assessment.count).not.toHaveBeenCalled();
  });

  it('returns 429 before DB work when rate limit is exceeded', async () => {
    mockGuardRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    );

    const res = await GET(makeRequest());

    expect(res.status).toBe(429);
    expect(prisma.assessment.count).not.toHaveBeenCalled();
  });

  it('should return KPIs for ADMIN', async () => {
    prisma.assessment.count
      .mockResolvedValueOnce(100) // totalAssessments
      .mockResolvedValueOnce(80); // completedAssessments
    prisma.student.count.mockResolvedValue(50);
    prisma.assessment.aggregate.mockResolvedValue({
      _avg: { globalScore: 65.3 },
    });
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ avg: 58.7 }]) // averageSSN
      .mockResolvedValueOnce([{ ssn: 90 }, { ssn: 75 }, { ssn: 55 }, { ssn: 35 }]) // distribution
      .mockResolvedValueOnce([{ subject: 'MATHS', avgSSN: 60 }]) // subjectAverages
      .mockResolvedValueOnce([]) // alerts
      .mockResolvedValueOnce([]); // monthlyProgression
    prisma.stageReservation.count
      .mockResolvedValueOnce(20) // total
      .mockResolvedValueOnce(15); // confirmed

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.kpis.totalAssessments).toBe(100);
    expect(body.kpis.completedAssessments).toBe(80);
    expect(body.kpis.activeStudents).toBe(50);
    expect(body.kpis.averageSSN).toBe(58.7);
    expect(body.kpis.stageConversionRate).toBe(75);
  });

  it('should handle SSN distribution correctly', async () => {
    prisma.assessment.count.mockResolvedValue(0);
    prisma.student.count.mockResolvedValue(0);
    prisma.assessment.aggregate.mockResolvedValue({ _avg: { globalScore: null } });
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ avg: null }]) // averageSSN
      .mockResolvedValueOnce([
        { ssn: 90 }, { ssn: 86 }, // excellence
        { ssn: 72 }, // tres_solide
        { ssn: 55 }, { ssn: 60 }, // stable
        { ssn: 42 }, // fragile
        { ssn: 20 }, // prioritaire
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.stageReservation.count.mockResolvedValue(0);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.distribution.excellence).toBe(2);
    expect(body.distribution.tres_solide).toBe(1);
    expect(body.distribution.stable).toBe(2);
    expect(body.distribution.fragile).toBe(1);
    expect(body.distribution.prioritaire).toBe(1);
  });

  it('should handle DB errors gracefully', async () => {
    prisma.assessment.count.mockRejectedValue(new Error('DB error'));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
