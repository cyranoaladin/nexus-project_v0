import { NextRequest } from 'next/server';
import { GET } from '@/app/api/assistante/family-requests/route';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/guards', () => {
  const actual = jest.requireActual('@/lib/guards');
  return {
    ...actual,
    requireAnyRole: jest.fn(),
  };
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    familyRequest: { findMany: jest.fn(), count: jest.fn() },
  },
}));

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/assistante/family-requests${query}`);
}

describe('GET /api/assistante/family-requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('denies a non-staff role', async () => {
    (requireAnyRole as jest.Mock).mockImplementation(async () => {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
    expect(prisma.familyRequest.findMany).not.toHaveBeenCalled();
  });

  it('lists pending requests for ASSISTANTE', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    (prisma.familyRequest.findMany as jest.Mock).mockResolvedValue([
      { id: 'fr-1', type: 'BILAN_GRATUIT', status: 'SUBMITTED', children: [{ id: 'c-1' }] },
    ]);
    (prisma.familyRequest.count as jest.Mock).mockResolvedValue(1);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.pagination).toEqual(expect.objectContaining({ total: 1 }));
  });

  it('lists requests for ADMIN', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    (prisma.familyRequest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.familyRequest.count as jest.Mock).mockResolvedValue(0);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
  });

  it('filters by a valid status', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    (prisma.familyRequest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.familyRequest.count as jest.Mock).mockResolvedValue(0);

    const response = await GET(makeRequest('?status=SUBMITTED'));

    expect(response.status).toBe(200);
    expect(prisma.familyRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'SUBMITTED' }) }),
    );
  });

  it('rejects an invalid status filter', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });

    const response = await GET(makeRequest('?status=NOT_A_STATUS'));

    expect(response.status).toBe(400);
    expect(prisma.familyRequest.findMany).not.toHaveBeenCalled();
  });
});
