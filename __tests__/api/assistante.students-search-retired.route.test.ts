import { NextResponse } from 'next/server';

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn((value: unknown) => value instanceof NextResponse),
}));

jest.mock('@/lib/prisma', () => ({ prisma: { student: { findMany: jest.fn(), count: jest.fn() } } }));

import { GET } from '@/app/api/assistante/students/route';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

const mockRequireAnyRole = requireAnyRole as jest.Mock;

describe('GET /api/assistante/students legacy search mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff_01', role: 'ASSISTANTE' } });
  });

  it('rejects query-string search without querying students', async () => {
    const response = await GET(new Request('http://localhost/api/assistante/students?search=parent@example.test'));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ error: 'SEARCH_REQUIRES_POST' });
    expect(prisma.student.findMany).not.toHaveBeenCalled();
    expect(prisma.student.count).not.toHaveBeenCalled();
  });

  it('retains the non-search assignment directory consumer', async () => {
    (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.student.count as jest.Mock).mockResolvedValue(0);
    const response = await GET(new Request('http://localhost/api/assistante/students?page=1&limit=20'));
    expect(response.status).toBe(200);
    expect(prisma.student.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.student.count).toHaveBeenCalledTimes(1);
  });
});
