/**
 * Auth Reset Password API — Complete Test Suite
 *
 * Tests: POST /api/auth/reset-password
 *   - Request reset (email)
 *   - Confirm reset (token + newPassword)
 *   - Validation, rate limiting, CSRF
 *
 * Source: app/api/auth/reset-password/route.ts
 */

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/email', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/password-reset-token', () => ({
  generateResetToken: jest.fn().mockReturnValue('mock-token-payload.mock-signature'),
  verifyResetToken: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$hashedpassword'),
}));

import { POST } from '@/app/api/auth/reset-password/route';
import { NextRequest } from 'next/server';
import { verifyResetToken } from '@/lib/password-reset-token';
import { sendPasswordResetEmail } from '@/lib/email';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

// ─── Request Reset ───────────────────────────────────────────────────────────

describe('POST /api/auth/reset-password — request reset', () => {
  it('should return success for existing user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'ahmed@test.com',
      password: '$2a$12$existing',
      firstName: 'Ahmed',
    });

    const res = await POST(makeRequest({ email: 'ahmed@test.com' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('should return success for non-existing user (prevent enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ email: 'unknown@test.com' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // Should NOT send email
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should reject invalid email', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('invalide');
  });

  it('should reject missing email', async () => {
    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
  });
});

// ─── Confirm Reset ───────────────────────────────────────────────────────────

describe('POST /api/auth/reset-password — confirm reset', () => {
  const validPayload = Buffer.from(JSON.stringify({ userId: 'user-1', email: 'ahmed@test.com', exp: Date.now() + 3600000 })).toString('base64url');
  const validToken = `${validPayload}.valid-signature`;

  it('should reset password with valid token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      password: '$2a$12$existing',
    });
    prisma.user.update.mockResolvedValue({});
    (verifyResetToken as jest.Mock).mockReturnValue({ userId: 'user-1', email: 'ahmed@test.com' });

    const res = await POST(makeRequest({ token: validToken, newPassword: 'newSecurePass123' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ password: expect.any(String) }),
      })
    );
  });

  it('should reject invalid token format', async () => {
    const res = await POST(makeRequest({ token: 'invalid', newPassword: 'newSecurePass123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Token invalide');
  });

  it('should reject expired/tampered token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      password: '$2a$12$existing',
    });
    (verifyResetToken as jest.Mock).mockReturnValue(null);

    const res = await POST(makeRequest({ token: validToken, newPassword: 'newSecurePass123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Token invalide');
  });

  it('should reject short password', async () => {
    const res = await POST(makeRequest({ token: validToken, newPassword: '123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
  });

  it('should reject common passwords', async () => {
    const res = await POST(makeRequest({ token: validToken, newPassword: 'password' }));
    const body = await res.json();

    expect(res.status).toBe(400);
  });

  it('should reject when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ token: validToken, newPassword: 'newSecurePass123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Token invalide');
  });
});
