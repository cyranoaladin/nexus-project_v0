jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } }),
}));

describe('API /api/admin/users PUT branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).user = (prisma as any).user || {};
  });

  it('401 when not admin', async () => {
    const { getServerSession } = require('next-auth');
    (getServerSession as jest.Mock).mockResolvedValueOnce(null);
    const { PUT } = require('@/app/api/admin/users/route');
    const res = await PUT(
      new NextRequest('http://localhost/api/admin/users', {
        method: 'PUT',
        body: JSON.stringify({}),
      } as any)
    );
    expect(res.status).toBe(401);
  });

  it('400 invalid payload', async () => {
    const { PUT } = require('@/app/api/admin/users/route');
    const res = await PUT(
      new NextRequest('http://localhost/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '' }),
      } as any)
    );
    expect(res.status).toBe(400);
  });

  it('PUT updates non-coach without coachProfile branch', async () => {
    (prisma as any).user.update = jest.fn().mockResolvedValue({
      id: 'u1',
      email: 'e@e.com',
      firstName: 'A',
      lastName: 'B',
      role: 'ELEVE',
      coachProfile: null,
    });
    const { PUT } = require('@/app/api/admin/users/route');
    const payload = { id: 'u1', firstName: 'New', role: 'ELEVE' };
    const res = await PUT(
      new NextRequest('http://localhost/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      } as any)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.role).toBe('ELEVE');
  });

  it('PUT updates coach with profileData (upsert branch present)', async () => {
    (prisma as any).user.update = jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'u2',
      email: 'c@c.com',
      firstName: 'C',
      lastName: 'D',
      role: 'COACH',
      coachProfile: { id: 'cp1', pseudonym: data.coachProfile.upsert.create.pseudonym },
    }));
    const { PUT } = require('@/app/api/admin/users/route');
    const payload = {
      id: 'u2',
      role: 'COACH',
      firstName: 'C',
      lastName: 'D',
      profileData: { pseudonym: 'Coach D', subjects: ['NSI'], description: 'desc', title: 'Prof' },
    };
    const res = await PUT(
      new NextRequest('http://localhost/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      } as any)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.profile).toBeTruthy();
  });
});
