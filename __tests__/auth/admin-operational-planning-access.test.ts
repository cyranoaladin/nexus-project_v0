/**
 * Tâche 14 — ADMIN doit pouvoir superviser les mêmes services opérationnels
 * (assignations, planning) que l'ASSISTANTE, sans passer par une gestion
 * générique des utilisateurs (Amendement 6). Les API `/api/assistante/
 * assignments` et `/api/assistante/planning` acceptent déjà ADMIN
 * (`requireAnyRole(['ADMIN', 'ASSISTANTE'])`), et les pages elles-mêmes
 * (`app/dashboard/assistante/assignments/page.tsx`,
 * `app/dashboard/assistante/stages/planning/page.tsx`) contiennent déjà une
 * logique cliente consciente d'ADMIN (`isAdmin`) — seul le middleware
 * bloquait encore la navigation avant que ce code ne s'exécute.
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

describe('ADMIN operational planning access (middleware)', () => {
  it.each(['/dashboard/assistante/assignments', '/dashboard/assistante/planning'])(
    'lets ADMIN reach the operational supervision page %s',
    async (path) => {
      const response = await access('ADMIN', path);
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    },
  );

  it.each(['/dashboard/assistante/assignments', '/dashboard/assistante/planning'])(
    'still lets ASSISTANTE reach %s',
    async (path) => {
      const response = await access('ASSISTANTE', path);
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    },
  );

  it.each(['PARENT', 'COACH', 'ELEVE', null])(
    'does not open the operational supervision pages to %s',
    async (role) => {
      expect((await access(role, '/dashboard/assistante/assignments')).status).toBe(307);
      expect((await access(role, '/dashboard/assistante/planning')).status).toBe(307);
    },
  );

  it('does not widen the exception to unrelated assistante pages for ADMIN', async () => {
    const response = await access('ADMIN', '/dashboard/assistante/students');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/dashboard/admin');
  });
});
