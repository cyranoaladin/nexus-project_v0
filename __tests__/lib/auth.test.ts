/**
 * Unit Tests - Auth Module (@/auth)
 *
 * Validates that the auth module exports the expected NextAuth functions
 * and that authConfig callbacks behave correctly.
 */
import { authConfig } from '@/auth.config';

describe('auth module', () => {
  it('exports auth, handlers, signIn, signOut from @/auth', async () => {
    // Dynamic import to avoid triggering DB connections in unit tests
    jest.mock('@/lib/prisma', () => ({ prisma: {} }));
    jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }));
    jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

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
});
