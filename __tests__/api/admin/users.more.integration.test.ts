jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } }),
}));

describe('API /api/admin/users additional branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).user = (prisma as any).user || {};
  });

  it('GET unauthorized when not admin', async () => {
    const { getServerSession } = require('next-auth');
    (getServerSession as jest.Mock).mockResolvedValueOnce(null);
    const { GET } = require('@/app/api/admin/users/route');
    const req = new NextRequest('http://localhost/api/admin/users');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('GET applies role and search filters and returns formatted users', async () => {
    (prisma as any).user.findMany = jest.fn().mockResolvedValue([
      { id: 'u1', email: 'a@a.com', firstName: 'Alice', lastName: 'A', role: 'COACH', createdAt: new Date(), coachProfile: { id: 'cp1' } },
    ]);
    (prisma as any).user.count = jest.fn().mockResolvedValue(1);

    const { GET } = require('@/app/api/admin/users/route');
    const url = 'http://localhost/api/admin/users?role=COACH&search=Ali&page=1&limit=10';
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.users[0].profile).toBeDefined();
    expect((prisma as any).user.findMany).toHaveBeenCalled();
  });

  it('GET role=ALL and empty search does not add filters', async () => {
    (prisma as any).user.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).user.count = jest.fn().mockResolvedValue(0);
    const { GET } = require('@/app/api/admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/users?role=ALL&search='));
    expect(res.status).toBe(200);
    const args = (prisma as any).user.findMany.mock.calls[0][0];
    expect(args.where).toEqual({});
  });

  it('POST COACH without profileData skips coachProfile branch', async () => {
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue(null);
    (prisma as any).user.create = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'u1', ...data }));
    const { POST } = require('@/app/api/admin/users/route');
    const payload = { email: 'c@e.com', firstName: 'C', lastName: 'E', role: 'COACH', password: 'password123' };
    const res = await POST(new NextRequest('http://localhost/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    expect(res.status).toBe(200);
    const call = (prisma as any).user.create.mock.calls[0][0];
    expect(call.data.coachProfile).toBeUndefined();
  });

  it('POST 401 when not admin', async () => {
    const { getServerSession } = require('next-auth');
    (getServerSession as jest.Mock).mockResolvedValueOnce(null);
    const { POST } = require('@/app/api/admin/users/route');
    const req = new NextRequest('http://localhost/api/admin/users', { method: 'POST', body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('POST 400 on invalid payload', async () => {
    const { POST } = require('@/app/api/admin/users/route');
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad', password: 'short' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('POST 400 when email already exists', async () => {
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue({ id: 'u1' });
    const { POST } = require('@/app/api/admin/users/route');
    const valid = {
      email: 'e@e.com', firstName: 'E', lastName: 'F', role: 'COACH', password: 'password123', profileData: {}
    };
    const req = new NextRequest('http://localhost/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('GET branches: role filter + pagination + search parsing', async () => {
    (prisma as any).user.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).user.count = jest.fn().mockResolvedValue(0);
    const { GET } = require('@/app/api/admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/users?role=COACH&page=2&limit=5&search=test'));
    expect(res.status).toBe(200);
    expect((prisma as any).user.count).toHaveBeenCalled();
  });

  it('DELETE 400 when id missing', async () => {
    const { DELETE } = require('@/app/api/admin/users/route');
    const res = await DELETE(new NextRequest('http://localhost/api/admin/users'));
    expect(res.status).toBe(400);
  });

  it('DELETE 404 when user not found', async () => {
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue(null);
    const { DELETE } = require('@/app/api/admin/users/route');
    const res = await DELETE(new NextRequest('http://localhost/api/admin/users?id=missing'));
    expect(res.status).toBe(404);
  });

  it('DELETE 200 on success', async () => {
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue({ id: 'u2' });
    (prisma as any).user.delete = jest.fn().mockResolvedValue({});
    const { DELETE } = require('@/app/api/admin/users/route');
    const res = await DELETE(new NextRequest('http://localhost/api/admin/users?id=u2'));
    expect(res.status).toBe(200);
  });
});
