jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } }),
}));

describe('Admin Users - error branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).user = (prisma as any).user || {};
  });

  it('GET catch: internal error returns 500', async () => {
    (prisma as any).user.findMany = jest.fn().mockRejectedValue(new Error('boom'));
    (prisma as any).user.count = jest.fn();
    const { GET } = require('@/app/api/admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/users'));
    expect(res.status).toBe(500);
  });

  it('POST catch: create throws', async () => {
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue(null);
    (prisma as any).user.create = jest.fn().mockRejectedValue(new Error('create failed'));
    const { POST } = require('@/app/api/admin/users/route');
    const payload = { email: 'e@e.com', firstName: 'A', lastName: 'B', role: 'ELEVE', password: 'password123' };
    const res = await POST(new NextRequest('http://localhost/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } as any));
    expect(res.status).toBe(500);
  });

  it('PUT catch: update throws', async () => {
    (prisma as any).user.update = jest.fn().mockRejectedValue(new Error('update failed'));
    const { PUT } = require('@/app/api/admin/users/route');
    const payload = { id: 'u1', firstName: 'X' };
    const res = await PUT(new NextRequest('http://localhost/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } as any));
    expect(res.status).toBe(500);
  });

  it('DELETE catch: delete throws', async () => {
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue({ id: 'u2' });
    (prisma as any).user.delete = jest.fn().mockRejectedValue(new Error('delete failed'));
    const { DELETE } = require('@/app/api/admin/users/route');
    const res = await DELETE(new NextRequest('http://localhost/api/admin/users?id=u2'));
    expect(res.status).toBe(500);
  });
});
