/**
 * Access Guard — Light integration tests.
 *
 * Mocks session + hasFeature to test guard behavior:
 * - denied → redirect or 403
 * - allowed → continue
 * - no session → redirect login
 */

// Mock next/server (NextResponse needs Request global which doesn't exist in Jest)
jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        json: async () => body,
      }),
    },
  };
});

// Mock next-auth
jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

// Mock next/navigation
const mockRedirect = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

// Mock entitlement engine
jest.mock('@/lib/entitlement', () => ({
  getUserEntitlements: jest.fn(),
}));

// Mock auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { getUserEntitlements } from '@/lib/entitlement';
import { requireFeature, requireFeatureApi } from '@/lib/access/guard';

const mockGetServerSession = auth as jest.MockedFunction<typeof auth>;
const mockGetUserEntitlements = getUserEntitlements as jest.MockedFunction<typeof getUserEntitlements>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRedirect.mockClear();
});

// ─── Page guard ──────────────────────────────────────────────────────────────

describe('requireFeature (page context)', () => {
  it('allowed → returns access result with user', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'a@test.com' },
      expires: '2099-01-01',
    } as any);
    mockGetUserEntitlements.mockResolvedValue([]);

    const result = await requireFeature('aria_maths');
    expect(result.access.allowed).toBe(true);
    expect(result.user).toEqual({ id: 'admin-1', role: 'ADMIN' });
  });

  it('no session → redirects to /auth/signin', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(requireFeature('aria_maths')).rejects.toThrow('REDIRECT:/auth/signin');
    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
  });

  it('missing entitlement → redirects to /access-required', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'eleve-1', role: 'ELEVE', email: 'e@test.com' },
      expires: '2099-01-01',
    } as any);
    mockGetUserEntitlements.mockResolvedValue([]);

    await expect(requireFeature('aria_maths')).rejects.toThrow('REDIRECT:/access-required');
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining('/access-required?feature=aria_maths')
    );
  });

  it('redirect URL contains reason and missing params', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'eleve-1', role: 'ELEVE', email: 'e@test.com' },
      expires: '2099-01-01',
    } as any);
    mockGetUserEntitlements.mockResolvedValue([]);

    await expect(requireFeature('aria_nsi')).rejects.toThrow('REDIRECT:');
    const redirectUrl = mockRedirect.mock.calls[0][0] as string;
    expect(redirectUrl).toContain('reason=missing_entitlement');
    expect(redirectUrl).toContain('missing=aria_nsi');
  });

  it('ELEVE with entitlement → allowed', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'eleve-1', role: 'ELEVE', email: 'e@test.com' },
      expires: '2099-01-01',
    } as any);
    mockGetUserEntitlements.mockResolvedValue([
      { id: 'ent-1', productCode: 'ARIA_ADDON_MATHS', label: 'ARIA', status: 'ACTIVE', startsAt: new Date(), endsAt: null, features: ['aria_maths'] },
    ]);

    const result = await requireFeature('aria_maths');
    expect(result.access.allowed).toBe(true);
    expect(result.user).toEqual({ id: 'eleve-1', role: 'ELEVE' });
  });
});

// ─── API guard ───────────────────────────────────────────────────────────────

describe('requireFeatureApi', () => {
  it('allowed → returns null', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'a@test.com' },
      expires: '2099-01-01',
    } as any);
    mockGetUserEntitlements.mockResolvedValue([]);

    const result = await requireFeatureApi('aria_maths');
    expect(result).toBeNull();
  });

  it('no session → returns 401', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const result = await requireFeatureApi('aria_maths');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe('Non authentifié');
  });

  it('missing entitlement → returns 403', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'eleve-1', role: 'ELEVE', email: 'e@test.com' },
      expires: '2099-01-01',
    } as any);
    mockGetUserEntitlements.mockResolvedValue([]);

    const result = await requireFeatureApi('aria_maths');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.error).toBe('Accès requis');
    expect(body.feature).toBe('aria_maths');
    expect(body.reason).toBe('missing_entitlement');
  });

  it('ELEVE with entitlement → returns null (allowed)', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'eleve-1', role: 'ELEVE', email: 'e@test.com' },
      expires: '2099-01-01',
    } as any);
    mockGetUserEntitlements.mockResolvedValue([
      { id: 'ent-1', productCode: 'ARIA_ADDON_NSI', label: 'ARIA NSI', status: 'ACTIVE', startsAt: new Date(), endsAt: null, features: ['aria_nsi'] },
    ]);

    const result = await requireFeatureApi('aria_nsi');
    expect(result).toBeNull();
  });

  it('ASSISTANTE exempt for credits_use → returns null', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'assist-1', role: 'ASSISTANTE', email: 'as@test.com' },
      expires: '2099-01-01',
    } as any);
    mockGetUserEntitlements.mockResolvedValue([]);

    const result = await requireFeatureApi('credits_use');
    expect(result).toBeNull();
  });
});
