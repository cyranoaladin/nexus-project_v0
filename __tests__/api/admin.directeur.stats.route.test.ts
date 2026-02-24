/**
 * Admin Directeur Stats API — Complete Test Suite
 *
 * Tests: GET /api/admin/directeur/stats
 *
 * Source: app/api/admin/directeur/stats/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { GET } from '@/app/api/admin/directeur/stats/route';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/directeur/stats', { method: 'GET' });
}

describe('GET /api/admin/directeur/stats', () => {
  it('should return 403 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it('should return 403 for non-ADMIN role', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('ADMIN');
  });

  it('should return KPIs for ADMIN', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    } as any);

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
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    } as any);

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
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    } as any);

    prisma.assessment.count.mockRejectedValue(new Error('DB error'));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
