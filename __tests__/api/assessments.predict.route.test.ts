/**
 * Assessments Predict API — Complete Test Suite
 *
 * Tests: POST /api/assessments/predict
 *
 * Source: app/api/assessments/predict/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/core/ml/predictSSN', () => ({
  predictSSNForStudent: jest.fn(),
}));

import { POST } from '@/app/api/assessments/predict/route';
import { auth } from '@/auth';
import { predictSSNForStudent } from '@/lib/core/ml/predictSSN';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPredict = predictSSNForStudent as jest.MockedFunction<typeof predictSSNForStudent>;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/assessments/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/assessments/predict', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(makeRequest({ studentId: 'stu-1' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('should return 400 when studentId is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);

    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('studentId');
  });

  it('should return 400 when studentId is not a string', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);

    const res = await POST(makeRequest({ studentId: 123 }));
    expect(res.status).toBe(400);
  });

  it('should return prediction for valid request', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockPredict.mockResolvedValue({
      ssnProjected: 68.5,
      confidence: 0.72,
      modelVersion: 'ridge-v1',
      inputSnapshot: { weeklyHours: 4, methodologyScore: 3 },
      confidenceBreakdown: { bilansNorm: 0.8, stabiliteTrend: 0.6, dispersionInverse: 0.7 },
    } as any);

    const res = await POST(makeRequest({ studentId: 'stu-1', weeklyHours: 4 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ssnProjected).toBe(68.5);
    expect(body.confidence).toBe(0.72);
    expect(mockPredict).toHaveBeenCalledWith('stu-1', 4, undefined);
  });

  it('should use default weeklyHours=3 when not provided', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockPredict.mockResolvedValue({ ssnProjected: 60 } as any);

    await POST(makeRequest({ studentId: 'stu-1' }));

    expect(mockPredict).toHaveBeenCalledWith('stu-1', 3, undefined);
  });

  it('should pass methodologyScore when provided', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockPredict.mockResolvedValue({ ssnProjected: 60 } as any);

    await POST(makeRequest({ studentId: 'stu-1', weeklyHours: 5, methodologyScore: 4 }));

    expect(mockPredict).toHaveBeenCalledWith('stu-1', 5, 4);
  });

  it('should return 404 when insufficient data', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockPredict.mockResolvedValue(null as any);

    const res = await POST(makeRequest({ studentId: 'stu-1' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('insuffisantes');
  });

  it('should return 500 on service error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockPredict.mockRejectedValue(new Error('ML error'));

    const res = await POST(makeRequest({ studentId: 'stu-1' }));
    expect(res.status).toBe(500);
  });
});
