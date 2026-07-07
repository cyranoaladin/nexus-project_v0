/**
 * Admin Recompute SSN API — Complete Test Suite
 *
 * Tests: POST /api/admin/recompute-ssn
 *
 * Source: app/api/admin/recompute-ssn/route.ts
 */

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((result) => result && typeof result === 'object' && 'status' in result),
}));

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/core/ssn/computeSSN', () => ({
  recomputeSSNBatch: jest.fn(),
}));

jest.mock('@/lib/core/statistics/cohort', () => ({
  computeCohortStatsWithAudit: jest.fn(),
}));

import { POST } from '@/app/api/admin/recompute-ssn/route';
import { requireRole } from '@/lib/guards';
import { recomputeSSNBatch } from '@/lib/core/ssn/computeSSN';
import { computeCohortStatsWithAudit } from '@/lib/core/statistics/cohort';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

const mockRequireRole = requireRole as jest.Mock;
const mockRecompute = recomputeSSNBatch as jest.Mock;
const mockAudit = computeCohortStatsWithAudit as jest.Mock;
const mockGuardRateLimit = guardRateLimitAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireRole.mockResolvedValue({
    user: { id: 'a1', role: 'ADMIN', email: 'admin@test.com' },
  });
  mockGuardRateLimit.mockResolvedValue(null);
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/recompute-ssn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/recompute-ssn', () => {
  it('should return 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );

    const res = await POST(makeRequest({ type: 'MATHS' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 403 for non-ADMIN role', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    );

    const res = await POST(makeRequest({ type: 'MATHS' }));
    expect(res.status).toBe(403);
  });

  it('should return 400 for invalid type', async () => {
    const res = await POST(makeRequest({ type: 'INVALID' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Type invalide');
  });

  it('rejects unexpected payload fields before recomputing', async () => {
    const res = await POST(makeRequest({ type: 'MATHS', rawPayload: true }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Type invalide');
    expect(mockAudit).not.toHaveBeenCalled();
    expect(mockRecompute).not.toHaveBeenCalled();
  });

  it('returns 429 before recomputing when rate limit is exceeded', async () => {
    mockGuardRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    );

    const res = await POST(makeRequest({ type: 'MATHS' }));

    expect(res.status).toBe(429);
    expect(mockAudit).not.toHaveBeenCalled();
    expect(mockRecompute).not.toHaveBeenCalled();
  });

  it('should return 400 for missing type', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('should recompute SSN for MATHS', async () => {
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
    mockAudit.mockResolvedValue({ stats: { mean: 50, std: 10 } } as any);
    mockRecompute.mockResolvedValue({ updated: 10, cohort: { mean: 50, std: 10, sampleSize: 10 } } as any);

    for (const type of ['NSI', 'GENERAL']) {
      const res = await POST(makeRequest({ type }));
      expect(res.status).toBe(200);
    }
  });

  it('should return 500 on service error', async () => {
    mockAudit.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest({ type: 'MATHS' }));
    expect(res.status).toBe(500);
  });
});
