/**
 * Admin Recompute SSN API — Complete Test Suite
 *
 * Tests: POST /api/admin/recompute-ssn
 *
 * Source: app/api/admin/recompute-ssn/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/core/ssn/computeSSN', () => ({
  recomputeSSNBatch: jest.fn(),
}));

jest.mock('@/lib/core/statistics/cohort', () => ({
  computeCohortStatsWithAudit: jest.fn(),
}));

import { POST } from '@/app/api/admin/recompute-ssn/route';
import { auth } from '@/auth';
import { recomputeSSNBatch } from '@/lib/core/ssn/computeSSN';
import { computeCohortStatsWithAudit } from '@/lib/core/statistics/cohort';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockRecompute = recomputeSSNBatch as jest.MockedFunction<typeof recomputeSSNBatch>;
const mockAudit = computeCohortStatsWithAudit as jest.MockedFunction<typeof computeCohortStatsWithAudit>;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/recompute-ssn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/recompute-ssn', () => {
  it('should return 403 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(makeRequest({ type: 'MATHS' }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it('should return 403 for non-ADMIN role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);

    const res = await POST(makeRequest({ type: 'MATHS' }));
    expect(res.status).toBe(403);
  });

  it('should return 400 for invalid type', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', email: 'admin@test.com' } } as any);

    const res = await POST(makeRequest({ type: 'INVALID' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Type invalide');
  });

  it('should return 400 for missing type', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', email: 'admin@test.com' } } as any);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('should recompute SSN for MATHS', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', email: 'admin@test.com' } } as any);
    mockAudit.mockResolvedValue({
      previousStats: { mean: 50, std: 15 },
      stats: { mean: 52, std: 14 },
      delta: 2,
    } as any);
    mockRecompute.mockResolvedValue({
      updated: 25,
      cohort: { mean: 52, std: 14, sampleSize: 25 },
    } as any);

    const res = await POST(makeRequest({ type: 'MATHS' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.type).toBe('MATHS');
    expect(body.updated).toBe(25);
    expect(body.cohort.mean).toBe(52);
    expect(body.audit.previousMean).toBe(50);
    expect(body.audit.currentMean).toBe(52);
  });

  it('should accept NSI and GENERAL types', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', email: 'admin@test.com' } } as any);
    mockAudit.mockResolvedValue({ stats: { mean: 50, std: 10 } } as any);
    mockRecompute.mockResolvedValue({ updated: 10, cohort: { mean: 50, std: 10, sampleSize: 10 } } as any);

    for (const type of ['NSI', 'GENERAL']) {
      const res = await POST(makeRequest({ type }));
      expect(res.status).toBe(200);
    }
  });

  it('should return 500 on service error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', email: 'admin@test.com' } } as any);
    mockAudit.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest({ type: 'MATHS' }));
    expect(res.status).toBe(500);
  });
});
