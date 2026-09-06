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

jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardRateLimit: jest.fn().mockReturnValue(null),
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn().mockResolvedValue({ id: 'email-job-1' }),
}));

jest.mock('@/lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
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
import { enqueueEmailIntent } from '@/lib/email/outbox';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  prisma.$transaction.mockImplementation(async (callback: (transaction: typeof prisma) => unknown) => callback(prisma));
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
    prisma.user.findUnique.mockResolvedValue({ ...{ email: 'ahmed@test.com', sessionVersion: 0, parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [] },
      id: 'user-1',
      email: 'ahmed@test.com',
      password: '$2a$12$existing',
      firstName: 'Ahmed',
    });

    const res = await POST(makeRequest({ email: 'ahmed@test.com' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(enqueueEmailIntent).toHaveBeenCalledTimes(1);
  });

  it('normalizes the email before lookup and delivery', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...{ email: 'ahmed@test.com', sessionVersion: 0, parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [] },
      id: 'user-1',
      email: 'eleve@example.test',
      password: '$2a$12$existing',
      firstName: 'Élève',
    });

    const res = await POST(makeRequest({ email: '  ELEVE@EXAMPLE.TEST  ' }));

    expect(res.status).toBe(200);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'eleve@example.test' },
    }));
    expect(enqueueEmailIntent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      to: 'eleve@example.test',
    }));
  });

  it('should return success for non-existing user (prevent enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ email: 'unknown@test.com' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // Should NOT send email
    expect(enqueueEmailIntent).not.toHaveBeenCalled();
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
    prisma.user.findUnique.mockResolvedValue({ ...{ email: 'ahmed@test.com', sessionVersion: 0, parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [] },
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
        where: expect.objectContaining({ id: 'user-1' }),
        data: expect.objectContaining({
          password: expect.any(String),
          sessionVersion: { increment: 1 },
        }),
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
    prisma.user.findUnique.mockResolvedValue({ ...{ email: 'ahmed@test.com', sessionVersion: 0, parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [] },
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

it('does not recover a phone identity through an unverified staff-entered email', async () => {
  prisma.user.findUnique.mockResolvedValue({ ...{ email: 'ahmed@test.com', sessionVersion: 0, parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [] }, id: 'phone-parent', email: 'unverified@test.com', role: 'PARENT', password: 'hash', parentPhoneState: 'VERIFIED', emailVerifiedAt: null });
  const response = await POST(makeRequest({ email: 'unverified@test.com' }));
  expect(response.status).toBe(200);
  expect(enqueueEmailIntent).not.toHaveBeenCalled();
});

it('keeps unverified email blocked after phone identity invalidation', async () => {
  prisma.user.findUnique.mockResolvedValue({ ...{ email: 'ahmed@test.com', sessionVersion: 0, parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [] }, id: 'parent-1', email: 'secondary@test.com', password: 'hash', parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [{ id: 'revoked-proof' }] });
  const response = await POST(makeRequest({ email: 'secondary@test.com' }));
  expect(response.status).toBe(200);
  expect(enqueueEmailIntent).not.toHaveBeenCalled();
});
it('rejects an existing email reset token after unverified phone enrollment even in NONE state', async () => {
  prisma.user.findUnique.mockResolvedValue({ ...{ email: 'ahmed@test.com', sessionVersion: 0, parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [] }, id: 'parent-1', password: 'hash', parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [{ id: 'consumed-proof' }] });
  (verifyResetToken as jest.Mock).mockReturnValue({ userId: 'parent-1', email: 'secondary@test.com' });
  const token = Buffer.from(JSON.stringify({ userId: 'parent-1' })).toString('base64url') + '.signature';
  const response = await POST(makeRequest({ token, newPassword: 'SecurePassword2026!' }));
  expect(response.status).toBe(400);
  expect(prisma.user.update).not.toHaveBeenCalled();
});
it('refuses a reset if the account proof changes before the password mutation', async () => {
  prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'ahmed@test.com', password: 'old-hash', sessionVersion: 7, parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [] });
  (verifyResetToken as jest.Mock).mockReturnValue({ userId: 'user-1', email: 'ahmed@test.com' });
  prisma.user.update.mockRejectedValueOnce({ code: 'P2025' });
  const token = Buffer.from(JSON.stringify({ userId: 'user-1' })).toString('base64url') + '.signature';
  const response = await POST(makeRequest({ token, newPassword: 'SecurePassword2026!' }));
  expect(response.status).toBe(400);
  expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'user-1', password: 'old-hash', sessionVersion: 7, email: 'ahmed@test.com', OR: [{ emailVerifiedAt: { not: null } }, { parentPhoneState: 'NONE', parentPhoneChallenges: { none: {} } }] }) }));
});
