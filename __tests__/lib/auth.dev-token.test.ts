import { issueDevToken, verifyDevToken, type DevPayload } from '@/lib/auth/dev-token';

describe('lib/auth/dev-token', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('issueDevToken throws when NEXTAUTH_SECRET missing', () => {
    delete process.env.NEXTAUTH_SECRET;
    const payload: DevPayload = { sub: 'u1', role: 'ADMIN', email: 'admin@example.com', dev: true };
    expect(() => issueDevToken(payload)).toThrow('NEXTAUTH_SECRET required');
  });

  test('issueDevToken + verifyDevToken roundtrip', () => {
    process.env.NEXTAUTH_SECRET = 'testsecret';
    const payload: DevPayload = { sub: 'u2', role: 'PARENT', email: 'p@example.com', dev: true };
    const token = issueDevToken(payload, '1h');
    const decoded = verifyDevToken(token)!;
    expect(decoded.sub).toBe('u2');
    expect(decoded.role).toBe('PARENT');
    expect(decoded.dev).toBe(true);
  });

  test('verifyDevToken returns null on invalid token', () => {
    process.env.NEXTAUTH_SECRET = 'testsecret';
    const res = verifyDevToken('not-a-jwt');
    expect(res).toBeNull();
  });
});
