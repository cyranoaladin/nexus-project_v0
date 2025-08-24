jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } }),
}));

describe('Admin Activities API extra branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).session = (prisma as any).session || {};
    (prisma as any).user = (prisma as any).user || {};
    (prisma as any).subscription = (prisma as any).subscription || {};
    (prisma as any).creditTransaction = (prisma as any).creditTransaction || {};

    (prisma as any).session.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).user.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).subscription.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).creditTransaction.findMany = jest.fn().mockResolvedValue([]);
  });

  it('applies type filter and search filter', async () => {
    (prisma as any).user.findMany.mockResolvedValueOnce([
      { id: 'u1', firstName: 'Alice', lastName: 'Dupont', role: 'ELEVE', createdAt: new Date() },
    ]);
    const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/activities?type=user&search=alice'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activities.every((a: any) => a.type === 'user')).toBe(true);
  });

  it('returns 500 on internal error', async () => {
    (prisma as any).session.findMany.mockRejectedValueOnce(new Error('boom'));
    const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/activities'));
    expect(res.status).toBe(500);
  });
});
