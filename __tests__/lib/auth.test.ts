import { UserRole } from '@/types/enums';

jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn(() => ({})),
}));

jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: (config: any) => ({ ...config, id: 'credentials' }),
}));

jest.mock('@/lib/middleware/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('auth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NEXTAUTH_SECRET: 'test-secret', NODE_ENV: 'development' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('authorize returns null on missing credentials', async () => {
    const { authOptions } = await import('@/lib/auth');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize(null);
    expect(result).toBeNull();
  });

  it('authorize returns user on valid credentials', async () => {
    const { prisma } = await import('@/lib/prisma');
    const bcrypt = await import('bcryptjs');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      role: UserRole.PARENT,
      password: 'hashed',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const { authOptions } = await import('@/lib/auth');
    const provider = authOptions.providers[0] as any;

    const result = await provider.authorize({
      email: 'user@test.com',
      password: 'secret',
    });

    expect(result).toEqual({
      id: 'user-1',
      email: 'user@test.com',
      role: UserRole.PARENT,
      firstName: undefined,
      lastName: undefined,
    });
  });

  it('jwt callback rejects invalid role', async () => {
    const { authOptions } = await import('@/lib/auth');
    await expect(
      authOptions.callbacks?.jwt?.({
        token: {},
        user: { id: 'user-1', role: 'INVALID' as any },
      } as any)
    ).rejects.toThrow();
  });

  it('session callback hydrates session', async () => {
    const { authOptions } = await import('@/lib/auth');
    const session = { user: {} } as any;

    const result = await authOptions.callbacks?.session?.({
      session,
      token: {
        sub: 'user-1',
        role: UserRole.COACH,
        firstName: 'Coach',
        lastName: 'A',
      },
    } as any);

    expect(result?.user).toEqual({
      id: 'user-1',
      role: UserRole.COACH,
      firstName: 'Coach',
      lastName: 'A',
    });
  });
});
