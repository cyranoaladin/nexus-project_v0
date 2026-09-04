jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/quotes/candidate-profile-persistence.server', () => ({
  getProfilCandidatById: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { GET } from '@/app/api/assistante/candidate-profiles/[id]/route';
import { requireAnyRole } from '@/lib/guards';
import { getProfilCandidatById } from '@/lib/quotes/candidate-profile-persistence.server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockGetById = getProfilCandidatById as jest.Mock;

const staffSession = { user: { id: 'staff-1', role: UserRole.ASSISTANTE } };

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/assistante/candidate-profiles/profil-1');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAnyRole.mockResolvedValue(staffSession);
});

describe('GET /api/assistante/candidate-profiles/[id]', () => {
  test('requires ADMIN/ASSISTANTE', async () => {
    await GET(makeRequest(), { params: Promise.resolve({ id: 'profil-1' }) });
    expect(mockRequireAnyRole).toHaveBeenCalledWith([UserRole.ADMIN, UserRole.ASSISTANTE]);
  });

  test('returns the guard\'s error response verbatim when auth fails', async () => {
    const denied = new Response(null, { status: 403 });
    mockRequireAnyRole.mockResolvedValueOnce(denied);
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'profil-1' }) });
    expect(res).toBe(denied);
  });

  test('returns 404 (never a leaked 500) when the profile does not exist', async () => {
    mockGetById.mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 200 with the profile on success', async () => {
    mockGetById.mockResolvedValueOnce({ id: 'profil-1', level: 'TERMINALE' });
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'profil-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('profil-1');
  });
});
