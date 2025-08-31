jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } }),
}));

describe('Admin Activities API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should reject non-admin', async () => {
    const { getServerSession } = require('next-auth');
    getServerSession.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/admin/activities');
const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('should merge activities from multiple sources', async () => {
    (prisma.session.findMany as any) = jest.fn();
    (prisma.user.findMany as any) = jest.fn();
    (prisma.subscription.findMany as any) = jest.fn();
    (prisma.creditTransaction.findMany as any) = jest.fn();
    (prisma.session.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', subject: 'MATHEMATIQUES', status: 'SCHEDULED', createdAt: new Date(), student: { user: { firstName: 'A', lastName: 'B' } }, coach: { user: {}, pseudonym: 'Helios' } },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'u1', firstName: 'C', lastName: 'D', role: 'ELEVE', createdAt: new Date() },
    ]);
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([
      { id: 'sub1', planName: 'HYBRIDE', status: 'ACTIVE', createdAt: new Date(), student: { user: { firstName: 'E', lastName: 'F' } } },
    ]);
    (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([
      { id: 'ct1', type: 'USAGE', amount: -1, createdAt: new Date(), student: { user: { firstName: 'G', lastName: 'H' } } },
    ]);

    const req = new NextRequest('http://localhost/api/admin/activities?page=1&limit=10');
const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activities.length).toBeGreaterThan(0);
  });
});
