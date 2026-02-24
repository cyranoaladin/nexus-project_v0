/**
 * Student Activate API — Complete Test Suite
 *
 * Tests: GET /api/student/activate?token=...
 *        POST /api/student/activate { token, password }
 *
 * Source: app/api/student/activate/route.ts
 */

jest.mock('@/lib/services/student-activation.service', () => ({
  verifyActivationToken: jest.fn(),
  completeStudentActivation: jest.fn(),
}));

import { GET, POST } from '@/app/api/student/activate/route';
import { verifyActivationToken, completeStudentActivation } from '@/lib/services/student-activation.service';
import { NextRequest } from 'next/server';

const mockVerify = verifyActivationToken as jest.Mock;
const mockComplete = completeStudentActivation as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── GET /api/student/activate ───────────────────────────────────────────────

describe('GET /api/student/activate', () => {
  it('should return 400 when token is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/student/activate', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.error).toContain('Token');
  });

  it('should verify valid token', async () => {
    mockVerify.mockResolvedValue({ valid: true, studentName: 'Ahmed', email: 'ahmed@test.com' } as any);

    const req = new NextRequest('http://localhost:3000/api/student/activate?token=valid-token', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.studentName).toBe('Ahmed');
  });

  it('should return invalid for expired token', async () => {
    mockVerify.mockResolvedValue({ valid: false, error: 'Token expiré' } as any);

    const req = new NextRequest('http://localhost:3000/api/student/activate?token=expired', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();

    expect(body.valid).toBe(false);
  });

  it('should return 500 on service error', async () => {
    mockVerify.mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost:3000/api/student/activate?token=test', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.valid).toBe(false);
  });
});

// ─── POST /api/student/activate ──────────────────────────────────────────────

describe('POST /api/student/activate', () => {
  function makePostRequest(data: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/student/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  it('should activate student with valid token and password', async () => {
    mockComplete.mockResolvedValue({
      success: true,
      redirectUrl: '/auth/signin',
    } as any);

    const res = await POST(makePostRequest({ token: 'valid-token', password: 'securePass123' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.redirectUrl).toBe('/auth/signin');
  });

  it('should return 400 for short password', async () => {
    const res = await POST(makePostRequest({ token: 'valid-token', password: '123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('invalides');
  });

  it('should return 400 for missing token', async () => {
    const res = await POST(makePostRequest({ password: 'securePass123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
  });

  it('should return 400 when activation fails', async () => {
    mockComplete.mockResolvedValue({
      success: false,
      error: 'Token invalide ou expiré',
    } as any);

    const res = await POST(makePostRequest({ token: 'invalid', password: 'securePass123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Token');
  });

  it('should return 500 on service error', async () => {
    mockComplete.mockRejectedValue(new Error('DB error'));

    const res = await POST(makePostRequest({ token: 'valid', password: 'securePass123' }));
    const body = await res.json();

    expect(res.status).toBe(500);
  });
});
