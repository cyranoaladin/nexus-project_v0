import { NextRequest } from 'next/server';
jest.mock('next-auth', () => ({ __esModule: true, default: () => ({ auth: (fn: unknown) => fn }) }));
jest.mock('@/lib/security-headers', () => ({ applySecurityHeaders: jest.fn() }));
import middleware from '@/middleware';
import { authConfig } from '@/auth.config';
async function access(role: string | null, path: string) {
  const req = new NextRequest(`http://localhost${path}`);
  Object.assign(req, { auth: role ? { user: { role, authority: 'V1' } } : null });
  return (middleware as unknown as (request: NextRequest) => Promise<Response>)(req);
}
test.each(['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'])('%s may reach the separately authorized Core entry without gaining V1 ADMIN routes', async role => {
  for (const path of ['/dashboard/core', '/dashboard/core/familles']) expect((await access(role, path)).status).toBe(200);
  for (const path of ['/dashboard/core', '/dashboard/core/familles']) expect(await authConfig.callbacks!.authorized!({ auth: { user: { role } }, request: new NextRequest(`http://localhost${path}`) } as never)).toBe(true);
  if (role !== 'ADMIN') expect((await access(role, '/dashboard/admin')).status).toBe(307);
});
test('the Core exception neither opens neighboring names nor accepts an anonymous session', async () => {
  expect((await access('COACH', '/dashboard/coreXYZ')).status).toBe(307);
  expect((await access(null, '/dashboard/core')).status).toBe(307);
  expect((await access('COACH', '/admin/directeur')).status).toBe(307);
});
