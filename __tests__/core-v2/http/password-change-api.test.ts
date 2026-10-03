/** Self-service password changes against a disposable PostgreSQL database. */
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { POST } from '@/app/api/v2/auth/password-change/route';
import { auditTrail, setupServiceHarness } from '../helpers/service-harness';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn() }));
const h = setupServiceHarness();
const OLD = 'change_me_current';
const NEW = 'change_me_replacement';
const mockAuth = auth as jest.Mock;
const mockRateLimit = guardSensitiveRateLimit as jest.Mock;

function request(body: unknown, origin = 'http://localhost:3000') {
  return new NextRequest('http://localhost:3000/api/v2/auth/password-change', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
async function account(role: 'ADMIN' | 'ASSISTANTE' | 'COACH' | 'PARENT' | 'ELEVE' = 'PARENT') {
  const user = await h.client.user.create({ data: {
    role, email: 'password-owner@synthetic.test', accountStatus: 'ACTIVE',
    password: await bcrypt.hash(OLD, 4), activatedAt: new Date(),
  } });
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role, authority: 'CORE_V2' } });
  return user;
}
beforeEach(() => { mockAuth.mockReset(); mockRateLimit.mockReset(); mockRateLimit.mockResolvedValue(null); });

describe('POST /api/v2/auth/password-change', () => {
  test('requires an authenticated Core-v2 identity', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await POST(request({ currentPassword: OLD, newPassword: NEW }))).status).toBe(401);
    const user = await account();
    mockAuth.mockResolvedValue({ user: { id: user.id, role: 'PARENT', authority: 'V1' } });
    expect((await POST(request({ currentPassword: OLD, newPassword: NEW }))).status).toBe(403);
    expect((await h.client.user.findUniqueOrThrow({ where: { id: user.id } })).password).toBe(user.password);
  });
  test('changes only the session identity, revokes sessions and returns no credentials', async () => {
    const user = await account();
    const response = await POST(request({ currentPassword: OLD, newPassword: NEW }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, data: { sessionsRevoked: true } });
    expect(JSON.stringify(body)).not.toContain(OLD);
    expect(JSON.stringify(body)).not.toContain(NEW);
    expect(JSON.stringify(body)).not.toContain(user.password);
    const after = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.sessionVersion).toBe(user.sessionVersion + 1);
    expect(await bcrypt.compare(NEW, after.password as string)).toBe(true);
    expect(await auditTrail(h.client, user.id)).toEqual(['account.password_changed']);
  });
  test.each(['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'] as const)(
    'allows authenticated %s to change only their own password', async (role) => {
      const user = await account(role);
      const response = await POST(request({ currentPassword: OLD, newPassword: NEW }));
      expect(response.status).toBe(200);
      expect((await h.client.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion)
        .toBe(user.sessionVersion + 1);
    },
  );
  test('refuses wrong current credentials without changing sessions or audit', async () => {
    const user = await account();
    expect((await POST(request({ currentPassword: 'change_me_wrong', newPassword: NEW }))).status).toBe(403);
    const after = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.password).toBe(user.password);
    expect(after.sessionVersion).toBe(user.sessionVersion);
    expect(await auditTrail(h.client, user.id)).toEqual([]);
  });
  test('rejects a target identity in the request body', async () => {
    const user = await account();
    const response = await POST(request({ userId: h.admin.userId, currentPassword: OLD, newPassword: NEW }));
    expect(response.status).toBe(400);
    expect((await h.client.user.findUniqueOrThrow({ where: { id: user.id } })).password).toBe(user.password);
    expect((await h.client.user.findUniqueOrThrow({ where: { id: h.admin.userId } })).password).toBeNull();
  });
  test('rejects cross-origin writes and oversized bodies even without Content-Length', async () => {
    const user = await account();
    const productionEnv = jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production' });
    try {
      expect((await POST(request({ currentPassword: OLD, newPassword: NEW }, 'https://attacker.invalid'))).status).toBe(403);
    } finally {
      productionEnv.restore();
    }
    expect((await POST(request({ currentPassword: OLD, newPassword: 'x'.repeat(5000) }))).status).toBe(413);
    expect((await h.client.user.findUniqueOrThrow({ where: { id: user.id } })).password).toBe(user.password);
  });
  test('rate limits by the authenticated identity before any password write', async () => {
    const user = await account();
    mockRateLimit.mockResolvedValue(NextResponse.json({ error: 'Too many attempts' }, { status: 429 }));
    expect((await POST(request({ currentPassword: OLD, newPassword: NEW }))).status).toBe(429);
    expect(mockRateLimit).toHaveBeenCalledWith(expect.any(NextRequest), {
      scope: 'core-v2-password-change', identity: user.id,
    });
    expect((await h.client.user.findUniqueOrThrow({ where: { id: user.id } })).password).toBe(user.password);
  });
});
