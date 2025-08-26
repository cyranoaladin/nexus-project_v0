jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } }),
}));

describe('Admin Users - COACH profile create/update branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).user = (prisma as any).user || {};
  });

  it('POST creates COACH with profileData mapping (lines 165-172)', async () => {
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue(null);
    (prisma as any).user.create = jest
      .fn()
      .mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'u1',
          ...data,
          coachProfile: { pseudonym: data.coachProfile.create.pseudonym },
        })
      );

    const payload = {
      email: 'coach@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'COACH',
      password: 'password123',
      profileData: { pseudonym: 'Sensei', subjects: ['math'], description: 'desc', title: 'Prof' },
    };

    const { POST } = require('@/app/api/admin/users/route');
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    } as any);

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((prisma as any).user.create).toHaveBeenCalled();
    const call = (prisma as any).user.create.mock.calls[0][0];
    expect(call.data.coachProfile.create.pseudonym).toBe('Sensei');
    expect(call.data.coachProfile.create.subjects).toBe(JSON.stringify(['math']));
    expect(call.data.coachProfile.create.description).toBe('desc');
    expect(call.data.coachProfile.create.title).toBe('Prof');
  });

  it('POST creates COACH with empty profileData using defaults', async () => {
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue(null);
    (prisma as any).user.create = jest
      .fn()
      .mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'u2',
          ...data,
          coachProfile: { pseudonym: data.coachProfile.create.pseudonym },
        })
      );
    const payload = {
      email: 'coach2@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'COACH',
      password: 'password123',
      profileData: {},
    };
    const { POST } = require('@/app/api/admin/users/route');
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    } as any);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const call = (prisma as any).user.create.mock.calls[0][0];
    expect(call.data.coachProfile.create.pseudonym).toBe('Jane Doe');
    expect(call.data.coachProfile.create.subjects).toBe(JSON.stringify([]));
    expect(call.data.coachProfile.create.description).toBe('');
    expect(call.data.coachProfile.create.title).toBe('');
  });

  it('PUT updates COACH with upsert mapping (lines 235-242)', async () => {
    (prisma as any).user.update = jest
      .fn()
      .mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'u1', ...data, coachProfile: {} })
      );

    const payload = {
      id: 'u1',
      role: 'COACH',
      firstName: 'Jane',
      lastName: 'Doe',
      profileData: { pseudonym: 'Guru', subjects: ['physics'], description: 'bio', title: 'Dr' },
    };

    const { PUT } = require('@/app/api/admin/users/route');
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    } as any);

    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect((prisma as any).user.update).toHaveBeenCalled();
    const call = (prisma as any).user.update.mock.calls[0][0];
    expect(call.data.coachProfile.upsert.create.pseudonym).toBe('Guru');
    expect(call.data.coachProfile.upsert.update.pseudonym).toBe('Guru');
    expect(call.data.coachProfile.upsert.update.subjects).toBe(JSON.stringify(['physics']));
  });
});
