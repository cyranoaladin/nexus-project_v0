import { NextRequest } from 'next/server';
import { POST } from '@/app/api/assessments/public-token/route';
import { requireAnyRole } from '@/lib/guards';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { verifyAssessmentPublicToken } from '@/lib/assessments/public-token';
import { Subject } from '@/lib/assessments/core/types';

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn((result) => result && typeof result === 'object' && 'status' in result),
}));

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

function request(body: unknown) {
  return new NextRequest('http://localhost:3000/api/assessments/public-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/assessments/public-token', () => {
  const originalSecret = process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = 'test-assessment-secret';
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    (guardRateLimitAsync as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;
    } else {
      process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = originalSecret;
    }
  });

  it('requires staff access before issuing a token', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValueOnce(
      Response.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const response = await POST(request({ subject: 'MATHS', grade: 'TERMINALE' }));

    expect(response.status).toBe(403);
    expect(guardRateLimitAsync).not.toHaveBeenCalled();
  });

  it('issues a scoped short-lived token for staff requests', async () => {
    const response = await POST(
      request({ subject: 'MATHS', grade: 'TERMINALE', source: 'bilan-gratuit' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(typeof body.token).toBe('string');
    expect(body).toEqual({
      token: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toContain('ASSESSMENT_PUBLIC_TOKEN_SECRET');

    const verification = verifyAssessmentPublicToken(body.token, {
      usage: 'assessment_submit',
      subject: Subject.MATHS,
      grade: 'TERMINALE',
    });
    expect(verification.valid).toBe(true);
  });

  it('rejects unexpected payload fields before token creation', async () => {
    const response = await POST(
      request({
        subject: 'MATHS',
        grade: 'TERMINALE',
        studentEmail: 'minor@example.test',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Validation failed' });
  });
});
