/**
 * Unit Tests - Auth Module (@/auth)
 *
 * Validates that the auth module exports the expected NextAuth functions
 * and that authConfig callbacks behave correctly.
 */
import { authConfig } from '@/auth.config';

// Mock ESM modules that Jest can't parse
jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: jest.fn(() => ({ id: 'credentials', name: 'Credentials', type: 'credentials' })),
}));
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    auth: jest.fn(),
    handlers: { GET: jest.fn(), POST: jest.fn() },
    signIn: jest.fn(),
    signOut: jest.fn(),
  })),
}));
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }));
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

describe('auth module', () => {
  it('exports auth, handlers, signIn, signOut from @/auth', async () => {
    const authModule = await import('@/auth');
    expect(authModule.auth).toBeDefined();
    expect(authModule.handlers).toBeDefined();
    expect(authModule.signIn).toBeDefined();
    expect(authModule.signOut).toBeDefined();
  });

  it('authConfig has correct sign-in page', () => {
    expect(authConfig.pages?.signIn).toBe('/auth/signin');
  });

  it('authConfig authorized callback rejects unauthenticated dashboard access', async () => {
    const authorized = authConfig.callbacks!.authorized! as any;
    const req = { nextUrl: new URL('http://localhost/dashboard') } as any;
    const result = await authorized({ auth: null, request: req });
    expect(result).toBe(false);
  });

  it('authConfig authorized callback allows authenticated dashboard access', async () => {
    const authorized = authConfig.callbacks!.authorized! as any;
    const req = { nextUrl: new URL('http://localhost/dashboard') } as any;
    const result = await authorized({ auth: { user: { role: 'ELEVE' } }, request: req });
    expect(result).toBe(true);
  });

  describe('ADMIN supervision exceptions (this callback runs inside the real auth() wrapper, before middleware.ts — measured live: it redirected ADMIN away from /dashboard/assistante/familles with a 302 before middleware.ts\'s own carve-out ever ran)', () => {
    const authorized = () => authConfig.callbacks!.authorized! as any;

    it.each([
      '/dashboard/assistante/students/student-1/candidat',
      '/dashboard/assistante/assignments',
      '/dashboard/assistante/planning',
      '/dashboard/assistante/familles',
      '/dashboard/assistante/familles/household-1',
    ])('lets ADMIN through %s instead of redirecting to /dashboard/admin', async (path) => {
      const req = { nextUrl: new URL(`http://localhost${path}`) } as any;
      const result = await authorized()({ auth: { user: { role: 'ADMIN' } }, request: req });
      expect(result).toBe(true);
    });

    it('still redirects ADMIN away from an unrelated assistante page', async () => {
      const req = { nextUrl: new URL('http://localhost/dashboard/assistante/students') } as any;
      const result = await authorized()({ auth: { user: { role: 'ADMIN' } }, request: req });
      expect(result).not.toBe(true);
      expect(result?.status).toBeGreaterThanOrEqual(300);
      expect(result?.status).toBeLessThan(400);
    });

    it('does not extend the exception to ASSISTANTE reaching an ADMIN-only page', async () => {
      const req = { nextUrl: new URL('http://localhost/dashboard/admin') } as any;
      const result = await authorized()({ auth: { user: { role: 'ASSISTANTE' } }, request: req });
      expect(result).not.toBe(true);
    });
  });
});
