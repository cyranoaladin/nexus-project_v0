// Mock authOptions to avoid importing PrismaAdapter (ESM) in tests
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock getServerSession to return ADMIN by default
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } }),
}));

describe('Admin Users API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject non-admin access on GET', async () => {
    const { getServerSession } = require('next-auth');
    getServerSession.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/admin/users');
    const { GET } = require('@/app/api/admin/users/route');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('should list users with pagination', async () => {
    (prisma.user.findMany as any) = jest.fn();
    (prisma.user.count as any) = jest.fn();
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'u1',
        email: 'a@test.com',
        firstName: 'A',
        lastName: 'B',
        role: 'ELEVE',
        createdAt: new Date(),
        student: null,
        coachProfile: null,
        parentProfile: null,
      },
    ]);
    (prisma.user.count as jest.Mock).mockResolvedValue(1);

    const req = new NextRequest('http://localhost/api/admin/users?page=1&limit=10');
    const { GET } = require('@/app/api/admin/users/route');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pagination.total).toBe(1);
  });

  it('should validate POST payload', async () => {
    const bad = new NextRequest('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { POST } = require('@/app/api/admin/users/route');
    const resBad = await POST(bad as any);
    expect(resBad.status).toBe(400);
  });

  it('should create a coach user', async () => {
    // S'assurer que ces propriétés sont bien des fonctions mockées
    // Forcer explicitement les mocks Prisma pour ce test
    (prisma as any).user.findUnique = jest.fn().mockResolvedValue(null);
    (prisma as any).user.create = jest
      .fn()
      .mockResolvedValue({
        id: 'u2',
        email: 'coach@test.com',
        firstName: 'C',
        lastName: 'H',
        role: 'COACH',
        coachProfile: { id: 'cp1' },
        studentProfile: null,
        parentProfile: null,
      });

    const payload = {
      email: 'coach@test.com',
      firstName: 'C',
      lastName: 'H',
      role: 'COACH',
      password: 'password123',
      profileData: {
        pseudonym: 'Helios',
        subjects: ['MATHEMATIQUES'],
        description: 'Prof',
        title: 'Agrégé',
      },
    };
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const { POST } = require('@/app/api/admin/users/route');
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
