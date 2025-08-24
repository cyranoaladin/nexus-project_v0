jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } }),
}));

describe('Admin Dashboard - error branch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 500 on internal error', async () => {
    (prisma as any).user = (prisma as any).user || {};
    (prisma as any).user.count = jest.fn().mockRejectedValue(new Error('boom'));

    const { GET } = require('@/app/api/admin/dashboard/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/dashboard'));
    expect(res.status).toBe(500);
  });
});
