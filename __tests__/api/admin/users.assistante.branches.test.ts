jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } }),
}));

describe('Admin Users - ASSISTANTE branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).user = (prisma as any).user || {};
  });

  it('POST creates ASSISTANTE with profileData branch present (lines 172-174)', async () => {
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue(null);
    (prisma as any).user.create = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'u1', ...data, coachProfile: null }));

    const payload = {
      email: 'assistant@example.com',
      firstName: 'Alice',
      lastName: 'Helper',
      role: 'ASSISTANTE',
      password: 'password123',
      profileData: { title: 'Assistante' },
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
  });
});
