jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } }),
}));

describe('Admin Users - DELETE branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).user = (prisma as any).user || {};
  });

  it('returns 401 when not admin', async () => {
    const { getServerSession } = require('next-auth');
    getServerSession.mockResolvedValueOnce(null);
    const { DELETE } = require('@/app/api/admin/users/route');
    const res = await DELETE(new NextRequest('http://localhost/api/admin/users?id=u1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when id is missing', async () => {
    const { DELETE } = require('@/app/api/admin/users/route');
    const res = await DELETE(new NextRequest('http://localhost/api/admin/users'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue(null);
    const { DELETE } = require('@/app/api/admin/users/route');
    const res = await DELETE(new NextRequest('http://localhost/api/admin/users?id=missing'));
    expect(res.status).toBe(404);
  });
});
