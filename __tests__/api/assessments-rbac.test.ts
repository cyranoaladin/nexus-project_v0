/**
 * Integration Tests — RBAC for Admin Assessment Endpoints
 *
 * Tests:
 * - GET /api/admin/directeur/stats → 403 without session, 200 with ADMIN
 * - POST /api/admin/recompute-ssn → 403 without session, 200 with ADMIN
 */

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// ─── Mock getServerSession ───────────────────────────────────────────────────

const mockGetServerSession = getServerSession as jest.Mock;

// ─── directeur/stats ─────────────────────────────────────────────────────────

describe('GET /api/admin/directeur/stats', () => {
  let GET: (req: any) => Promise<any>;

  beforeAll(async () => {
    const mod = await import('@/app/api/admin/directeur/stats/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 without session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request('http://localhost/api/admin/directeur/stats');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain('ADMIN');
  });

  it('returns 403 for non-ADMIN user', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', email: 'coach@test.com', role: 'COACH' },
    });

    const request = new Request('http://localhost/api/admin/directeur/stats');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it('returns 200 for ADMIN user', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' },
    });

    // Mock DB queries used by directeur/stats
    (prisma.assessment.count as jest.Mock).mockResolvedValue(5);
    (prisma.assessment.aggregate as jest.Mock).mockResolvedValue({
      _avg: { globalScore: 60 },
    });
    (prisma.assessment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.assessment.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.user.count as jest.Mock).mockResolvedValue(10);
    (prisma.stageReservation.count as jest.Mock).mockResolvedValue(0);
    (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

    const request = new Request('http://localhost/api/admin/directeur/stats');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.kpis).toBeDefined();
  });
});

// ─── recompute-ssn ───────────────────────────────────────────────────────────

describe('POST /api/admin/recompute-ssn', () => {
  let POST: (req: any) => Promise<any>;

  beforeAll(async () => {
    const mod = await import('@/app/api/admin/recompute-ssn/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 without session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request('http://localhost/api/admin/recompute-ssn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'MATHS' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it('returns 200 for ADMIN user with valid type', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' },
    });

    // Mock cohort computation
    (prisma.assessment.findMany as jest.Mock).mockResolvedValue([
      { globalScore: 60 },
      { globalScore: 40 },
    ]);
    // Mock SSN update
    (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);
    (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(2);

    const request = new Request('http://localhost/api/admin/recompute-ssn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'MATHS' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.type).toBe('MATHS');
  });
});
