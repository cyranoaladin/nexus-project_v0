/**
 * Go-live mission §3, Lot 1A — ADMIN doit pouvoir superviser la gestion
 * opérationnelle des foyers que l'autorité canonique (lib/core-v2/rbac.ts)
 * lui accorde déjà (ADMIN détient toute capacité HOUSEHOLD, PARENT et
 * STUDENT via CAPABILITY_MATRIX.ADMIN = new Set(CAPABILITIES)), sans
 * passer par un compte ASSISTANTE. L'API/le service
 * (lib/core-v2/services/household.ts, lib/core-v2/queries/staff.ts)
 * autorisait déjà ADMIN ; seul ce garde-fou de préfixe de middleware
 * l'en empêchait encore, exactement comme pour les assignations/planning
 * (Tâche 14).
 */
import { NextRequest, type NextFetchEvent } from 'next/server';
jest.mock('next-auth', () => ({ __esModule: true, default: () => ({ auth: (handler: unknown) => handler }) }));
jest.mock('@/auth.config', () => ({ authConfig: {} }));
jest.mock('@/lib/security-headers', () => ({ applySecurityHeaders: jest.fn() }));
import middleware from '@/middleware';

async function access(role: string | null, path: string) {
  const request = new NextRequest(`http://localhost${path}`);
  Object.assign(request, { auth: role ? { user: { role } } : null });
  return middleware(request, {} as NextFetchEvent);
}

describe('ADMIN household management access (middleware)', () => {
  it.each([
    '/dashboard/assistante/familles',
    '/dashboard/assistante/familles/household-1',
    '/dashboard/assistante/familles/annees',
  ])('lets ADMIN reach the household management page %s', async (path) => {
    const response = await access('ADMIN', path);
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it.each([
    '/dashboard/assistante/familles',
    '/dashboard/assistante/familles/household-1',
    '/dashboard/assistante/familles/annees',
  ])('still lets ASSISTANTE reach %s', async (path) => {
    const response = await access('ASSISTANTE', path);
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it.each(['PARENT', 'COACH', 'ELEVE', null])(
    'does not open household management to %s',
    async (role) => {
      expect((await access(role, '/dashboard/assistante/familles')).status).toBe(307);
    },
  );

  it('does not widen the exception to unrelated assistante pages for ADMIN', async () => {
    const response = await access('ADMIN', '/dashboard/assistante/students');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/dashboard/admin');
  });

  it('does not widen the exception to a path that merely starts with the same prefix', async () => {
    // "/dashboard/assistante/famillestest" must not match — this is a prefix
    // guard, not a substring one.
    const response = await access('ADMIN', '/dashboard/assistante/famillestest');
    expect(response.status).toBe(307);
  });
});
