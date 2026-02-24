/**
 * Admin Users Search API — Complete Test Suite
 *
 * Tests: GET /api/admin/users/search?q=...
 *
 * Source: app/api/admin/users/search/route.ts
 */

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

import { GET } from '@/app/api/admin/users/search/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { NextRequest, NextResponse } from 'next/server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockIsErrorResponse = isErrorResponse as unknown as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(query?: string): NextRequest {
  const url = query
    ? `http://localhost:3000/api/admin/users/search?q=${encodeURIComponent(query)}`
    : 'http://localhost:3000/api/admin/users/search';
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/admin/users/search', () => {
  it('should return 403 for unauthorized role', async () => {
    const errorRes = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mockRequireAnyRole.mockResolvedValue(errorRes as any);
    mockIsErrorResponse.mockReturnValue(true);

    const res = await GET(makeRequest('ahmed'));
    expect(res.status).toBe(403);
  });

  it('should return empty array for short query', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);

    const res = await GET(makeRequest('a'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('should return empty array for missing query', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body).toEqual([]);
  });

  it('should search users by name/email', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', firstName: 'Ahmed', lastName: 'Ben Ali', email: 'ahmed@test.com', role: 'ELEVE' },
    ]);

    const res = await GET(makeRequest('ahmed'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].firstName).toBe('Ahmed');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
        take: 10,
      })
    );
  });

  it('should return 500 on DB error', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);
    prisma.user.findMany.mockRejectedValue(new Error('DB error'));

    const res = await GET(makeRequest('test'));
    expect(res.status).toBe(500);
  });
});
