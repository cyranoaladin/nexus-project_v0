jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    auth: (handler: unknown) => handler,
  })),
}));
jest.mock('@/lib/campaigns/pre-rentree-2026/release-gate', () => ({
  getPreRentreeReleaseGate: () => ({ isPublicReady: true }),
  isPreRentreeProtectedPublicPath: () => false,
}));

import { bilanMagicMiddleware } from '@/middleware';

function middlewareRequest(pathname: string, loggedIn = true) {
  return {
    nextUrl: new URL(`https://nexusreussite.academy${pathname}`),
    auth: loggedIn ? { user: { id: 'parent', role: 'PARENT' } } : null,
  };
}

describe('bilan magic middleware boundary', () => {
  it('does not redirect an authenticated user before consuming the exact magic-link page', () => {
    const response = bilanMagicMiddleware(
      middlewareRequest('/auth/bilan-magic') as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('keeps the redirect behavior for every other auth page', () => {
    const response = bilanMagicMiddleware(
      middlewareRequest('/auth/signin') as never,
    );

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get('location')).toBe(
      'https://nexusreussite.academy/dashboard/parent',
    );
  });
});
