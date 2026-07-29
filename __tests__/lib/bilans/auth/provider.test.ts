jest.mock('@/lib/bilans/auth/consume-magic-link', () => ({
  consumeBilanMagicLink: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    auth: jest.fn(),
    handlers: { GET: jest.fn(), POST: jest.fn() },
    signIn: jest.fn(),
    signOut: jest.fn(),
  })),
}));
jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: jest.fn((configuration) => ({
    ...configuration,
    id: configuration.id ?? 'credentials',
    type: 'credentials',
  })),
}));

import NextAuth from 'next-auth';

import { consumeBilanMagicLink } from '@/lib/bilans/auth/consume-magic-link';
import { logger } from '@/lib/logger';

jest.unmock('@/auth');
jest.requireActual('@/auth');

const mockConsumeBilanMagicLink = consumeBilanMagicLink as jest.Mock;
const authOptions = (NextAuth as jest.Mock).mock.calls[0][0];

describe('bilan-magic Auth.js provider', () => {
  beforeEach(() => {
    mockConsumeBilanMagicLink.mockReset();
    (logger.info as jest.Mock).mockClear();
    (logger.error as jest.Mock).mockClear();
    (logger.warn as jest.Mock).mockClear();
  });

  it('registers a distinct token-only provider without replacing password credentials', async () => {
    expect(authOptions.providers.map((provider: { id: string }) => provider.id)).toEqual([
      'credentials',
      'bilan-magic',
    ]);
    const magic = authOptions.providers.find(
      (provider: { id: string }) => provider.id === 'bilan-magic',
    );
    expect(magic.credentials).toEqual({
      token: { label: 'Jeton', type: 'password' },
    });
  });

  it('delegates only a raw token and returns the safe parent from the consume service', async () => {
    const safeParent = {
      id: 'cparent000000000000000001',
      email: 'parent@example.com',
      role: 'PARENT',
      firstName: 'Amina',
      lastName: 'Ben Salah',
    };
    mockConsumeBilanMagicLink.mockResolvedValue(safeParent);
    const magic = authOptions.providers.find(
      (provider: { id: string }) => provider.id === 'bilan-magic',
    );

    await expect(magic.authorize({
      token: 'raw-secret',
      csrfToken: 'authjs-managed',
      callbackUrl: '/bilan-gratuit',
    })).resolves.toEqual(safeParent);
    expect(mockConsumeBilanMagicLink).toHaveBeenCalledWith({
      prisma: expect.any(Object),
      rawToken: 'raw-secret',
    });

    await expect(magic.authorize({
      token: 'raw-secret',
      requestId: 'attacker-controlled',
    })).resolves.toBeNull();
    expect(mockConsumeBilanMagicLink).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([
      (logger.info as jest.Mock).mock.calls,
      (logger.error as jest.Mock).mock.calls,
      (logger.warn as jest.Mock).mock.calls,
    ])).not.toContain('raw-secret');
  });
});
