import { NextRequest, type NextFetchEvent } from 'next/server';
import { ROLE_DESTINATIONS, getRoleDestination } from '@/lib/auth/role-destinations';
import { authConfig } from '@/auth.config';
import middleware from '@/middleware';
import DashboardRedirect from '@/app/dashboard/page';
import { auth } from '@/auth';
jest.mock('next-auth', () => ({ __esModule: true, default: () => ({ auth: (handler: unknown) => handler }) }));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
jest.mock('@/lib/security-headers', () => ({ applySecurityHeaders: jest.fn() }));
const expected = { ADMIN: '/dashboard/admin', ASSISTANTE: '/dashboard/assistante', COACH: '/dashboard/coach', PARENT: '/dashboard/parent', ELEVE: '/dashboard/eleve' } as const;
const roles = Object.keys(expected) as Array<keyof typeof expected>;
function authorization(role: string | null, path: string) {
 const callback = authConfig.callbacks.authorized;
 return callback({ auth: role ? { user: { id: 'synthetic', role } } : null, request: new NextRequest(`https://nexus.test${path}`) } as Parameters<typeof callback>[0]);
}
async function access(role: string | null, path: string) {
 const req = new NextRequest(`https://nexus.test${path}`);
 Object.assign(req, { auth: role ? { user: { id: 'synthetic', role } } : null });
 return middleware(req, {} as NextFetchEvent);
}
beforeEach(() => jest.clearAllMocks());
it('defines exactly the five canonical destinations and rejects unknown keys', () => {
 expect(ROLE_DESTINATIONS).toEqual(expected);
 expect(getRoleDestination('toString')).toBeUndefined();
 expect(getRoleDestination(null)).toBeUndefined();
});
it.each(roles)('%s lands on its own dashboard', async role => {
 (auth as jest.Mock).mockResolvedValue({ user: { role } });
 await expect(DashboardRedirect()).rejects.toThrow(`REDIRECT:${expected[role]}`);
 expect(authorization(role, expected[role])).toBe(true);
 expect((await access(role, expected[role])).headers.get('location')).toBeNull();
});
it.each(roles.flatMap(role => roles.filter(other => other !== role).map(other => [role, other] as const)))('%s cannot render the %s dashboard', async (role, other) => {
 const response = await access(role, expected[other] + '/private');
 expect(response.status).toBe(307);
 expect(response.headers.get('location')).toBe(`https://nexus.test${expected[role]}`);
 expect(await response.text()).toBe('');
 const authorized = authorization(role, expected[other] + '/private');
 expect(authorized).toBeInstanceOf(Response);
 expect((authorized as Response).headers.get('location')).toBe(`https://nexus.test${expected[role]}`);
});
it.each(roles)('requires login for the %s dashboard', async role => {
 expect(authorization(null, expected[role])).toBe(false);
 expect((await access(null, expected[role])).headers.get('location')).toContain('/auth/signin?callbackUrl=');
});
it('preserves the shared authenticated trajectory and unknown-role landing fallback', async () => {
 for (const role of roles) {
  expect(authorization(role, '/dashboard/trajectoire')).toBe(true);
  expect((await access(role, '/dashboard/trajectoire')).status).toBe(200);
 }
 (auth as jest.Mock).mockResolvedValue({ user: { role: 'UNKNOWN' } });
 await expect(DashboardRedirect()).rejects.toThrow('REDIRECT:/auth/signin');
});
