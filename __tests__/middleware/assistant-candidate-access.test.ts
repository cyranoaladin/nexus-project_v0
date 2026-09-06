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
it.each(['ADMIN', 'ASSISTANTE'])('allows %s into the shared student candidate page', async role => {
 const response = await access(role, '/dashboard/assistante/students/student-1/candidat');
 expect(response.status).toBe(200);
 expect(response.headers.get('location')).toBeNull();
});
it.each(['PARENT', 'COACH', 'ELEVE', null])('does not open the candidate page to %s', async role => {
 expect((await access(role, '/dashboard/assistante/students/student-1/candidat')).status).toBe(307);
});
it('does not open unrelated assistant pages to ADMIN', async () => {
 const response = await access('ADMIN', '/dashboard/assistante/assignments');
 expect(response.status).toBe(307);
 expect(response.headers.get('location')).toBe('http://localhost/dashboard/admin');
});
