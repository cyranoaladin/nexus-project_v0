jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } }),
}));

describe('API /api/admin/analytics additional branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).payment = (prisma as any).payment || {};
    (prisma as any).user = (prisma as any).user || {};
    (prisma as any).session = (prisma as any).session || {};
    (prisma as any).subscription = (prisma as any).subscription || {};
    (prisma as any).creditTransaction = (prisma as any).creditTransaction || {};

    (prisma as any).payment.groupBy = jest.fn().mockResolvedValue([]);
    (prisma as any).user.groupBy = jest.fn().mockResolvedValue([]);
    (prisma as any).session.groupBy = jest.fn().mockResolvedValue([]);
    (prisma as any).subscription.groupBy = jest.fn().mockResolvedValue([]);
    (prisma as any).creditTransaction.groupBy = jest.fn().mockResolvedValue([]);
    (prisma as any).session.findMany = jest.fn().mockResolvedValue([]);
  });

  it('handles period=quarter and year and default gracefully', async () => {
    const { GET } = require('@/app/api/admin/analytics/route');
    const resQuarter = await GET(new NextRequest('http://localhost/api/admin/analytics?period=quarter&type=all'));
    expect(resQuarter.status).toBe(200);
    const resYear = await GET(new NextRequest('http://localhost/api/admin/analytics?period=year&type=all'));
    expect(resYear.status).toBe(200);
    const resInvalid = await GET(new NextRequest('http://localhost/api/admin/analytics?period=invalid&type=all'));
    expect(resInvalid.status).toBe(200);
  });

  it('returns 500 on internal error', async () => {
    (prisma as any).user.groupBy.mockRejectedValueOnce(new Error('boom'));
    const { GET } = require('@/app/api/admin/analytics/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/analytics'));
    expect(res.status).toBe(500);
  });
});
