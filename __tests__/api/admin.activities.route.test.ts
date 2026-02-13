import { GET } from '@/app/api/admin/activities/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    subscription: { findMany: jest.fn() },
    creditTransaction: { findMany: jest.fn() },
  },
}));

function makeRequest(url: string) {
  return { url } as any;
}

describe('GET /api/admin/activities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not admin', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest('http://localhost:3000/api/admin/activities'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns paginated activities and filters by type', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'session-1',
        subject: 'MATHEMATIQUES',
        scheduledDate: new Date('2025-01-02'),
        status: 'SCHEDULED',
      },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'user-1',
        firstName: 'User',
        lastName: 'One',
        role: 'ELEVE',
        createdAt: new Date('2025-01-01'),
      },
    ]);
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([]);

    const response = await GET(
      makeRequest('http://localhost:3000/api/admin/activities?type=user&page=1&limit=10')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activities).toHaveLength(1);
    expect(body.activities[0].type).toBe('user');
    expect(body.pagination.total).toBe(1);
  });

  it('filters by search', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'user-1',
        firstName: 'Alice',
        lastName: 'Nova',
        role: 'ELEVE',
        createdAt: new Date('2025-01-01'),
      },
    ]);
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([]);

    const response = await GET(
      makeRequest('http://localhost:3000/api/admin/activities?search=alice')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activities).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });
});
