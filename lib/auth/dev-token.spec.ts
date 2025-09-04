import { beforeAll, describe, expect, it } from 'vitest';

describe('dev-token', () => {
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });

  it('issues and verifies a dev token', async () => {
    const { issueDevToken, verifyDevToken } = await import('./dev-token');
    const token = issueDevToken({ sub: 'u1', email: 'u1@example.com', role: 'ADMIN', dev: true });
    const payload = verifyDevToken(token);
    expect(payload?.sub).toBe('u1');
    expect(payload?.role).toBe('ADMIN');
    expect(payload?.dev).toBe(true);
  });

  it('returns null for invalid token', async () => {
    const { verifyDevToken } = await import('./dev-token');
    const bad = verifyDevToken('not-a-jwt');
    expect(bad).toBeNull();
  });
});
