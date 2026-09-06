jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/csrf', () => ({ checkCsrf: jest.fn().mockReturnValue(null) }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/families/parent-registration', () => {
  const actual = jest.requireActual('@/lib/families/parent-registration');
  return { ...actual, loadParentRegistration: jest.fn(), completeParentRegistration: jest.fn() };
});
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/parent/registration/route';
import { auth } from '@/auth';
import { checkCsrf } from '@/lib/csrf';
import { completeParentRegistration, loadParentRegistration, ParentRegistrationError } from '@/lib/families/parent-registration';
const request = (body: unknown = {}) => new NextRequest('http://localhost:3000/api/parent/registration', { method: 'POST', body: JSON.stringify(body) });
describe('parent registration API', () => {
  beforeEach(() => { jest.clearAllMocks(); (auth as jest.Mock).mockResolvedValue({ user: { id: 'self', role: 'PARENT', email: null } }); (checkCsrf as jest.Mock).mockReturnValue(null); });
  it('loads the authenticated telephone-only parent, never a URL-selected family', async () => {
    (loadParentRegistration as jest.Mock).mockResolvedValue({ children: [] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(loadParentRegistration).toHaveBeenCalledWith('self');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it.each([null, { user: { id: 'other', role: 'ELEVE' } }])('does not expose registration to other roles', async session => {
    (auth as jest.Mock).mockResolvedValue(session);
    expect((await GET()).status).toBe(404);
    expect(loadParentRegistration).not.toHaveBeenCalled();
  });
  it('rejects cross-origin writes before changing the dossier', async () => {
    (checkCsrf as jest.Mock).mockReturnValue(NextResponse.json({}, { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    expect(completeParentRegistration).not.toHaveBeenCalled();
  });
  it('returns a recoverable conflict when child information or membership changed', async () => {
    (completeParentRegistration as jest.Mock).mockRejectedValue(new ParentRegistrationError('FAMILY_CHANGED'));
    const response = await POST(request({ children: [] }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'FAMILY_CHANGED' });
  });
  it('uses only session identity for completion', async () => {
    const body = { revision: 'a'.repeat(64), firstName: 'Parent', lastName: 'Test', children: [] };
    (completeParentRegistration as jest.Mock).mockResolvedValue({ completedAt: '2026-09-06' });
    expect((await POST(request(body))).status).toBe(200);
    expect(completeParentRegistration).toHaveBeenCalledWith('self', body);
  });
});
