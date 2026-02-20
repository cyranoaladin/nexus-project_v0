import { auth } from '@/auth';
import { GET, POST } from '@/app/api/parent/children/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentProfile: { findUnique: jest.fn() },
    student: { findMany: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('parent children routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/parent/children', () => {
    it('returns 401 when not parent', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 404 when parent profile missing', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Parent profile not found');
    });

    it('returns formatted children', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'student-1',
          grade: 'Seconde',
          school: 'Lycée',
          createdAt: new Date('2025-01-01'),
          user: { firstName: 'Student', lastName: 'One', email: 's1@test.com' },
          creditTransactions: [{ amount: 2 }, { amount: -1 }],
          sessions: [{ id: 'session-1' }],
        },
      ]);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].creditBalance).toBe(1);
      expect(body[0].upcomingSessions).toBe(1);
    });
  });

  describe('POST /api/parent/children', () => {
    it('returns 401 when not parent', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const response = await POST(makeRequest({}));
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('validates required fields', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });

      const response = await POST(makeRequest({ firstName: 'A' }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Missing required fields');
    });

    it('rejects existing child email', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });

      const response = await POST(
        makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' })
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('existe');
    });

    it('returns 404 when parent profile missing', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await POST(
        makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' })
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Parent profile not found');
    });

    it('returns 404 when parent password missing', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'parent-1', password: null });

      const response = await POST(
        makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' })
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Parent password not found');
    });

    it('creates child via transaction', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'parent-1',
        password: 'secret',
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({ id: 'child-user-1' }),
          },
          student: {
            create: jest.fn().mockResolvedValue({
              id: 'student-1',
              grade: 'Seconde',
              school: '',
              user: { firstName: 'A', lastName: 'B', email: 'a.b@nexus-student.local' },
            }),
          },
        };
        return cb(tx);
      });

      const response = await POST(
        makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde', school: '' })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.child.email).toContain('@nexus-student.local');
    });
  });
});
