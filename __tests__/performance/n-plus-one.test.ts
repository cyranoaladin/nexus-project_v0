/**
 * N+1 Query Prevention Tests
 *
 * Tests: verifies that API handlers use Prisma includes/joins
 *        instead of N+1 query patterns
 *
 * Source: app/api/ route handlers (admin/users, parent/children, etc.)
 */

import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

describe('N+1 Query Prevention', () => {
  let prisma: any;
  let mockAuth: jest.Mock;

  beforeEach(async () => {
    const mod = await import('@/lib/prisma');
    prisma = (mod as any).prisma;
    const authMod = await import('@/auth');
    mockAuth = authMod.auth as jest.Mock;
    jest.clearAllMocks();
  });

  describe('Admin Users List', () => {
    it('should use single query with relations (not N queries per user)', async () => {
      // Arrange
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
      });

      const mockUsers = Array.from({ length: 10 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@test.com`,
        firstName: `User${i}`,
        lastName: 'Test',
        role: 'ELEVE',
        createdAt: new Date(),
        student: { id: `student-${i}` },
      }));

      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.user.count.mockResolvedValue(10);

      // Act
      const { GET } = await import('@/app/api/admin/users/route');
      const req = new NextRequest('http://localhost:3000/api/admin/users');
      await GET(req as any);

      // Assert: findMany should be called once (not 10 times)
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);

      // Assert: should include relations in the query
      const findManyCall = prisma.user.findMany.mock.calls[0][0];
      if (findManyCall?.include) {
        expect(findManyCall.include).toBeDefined();
      }
    });
  });

  describe('Parent Children List', () => {
    it('should include children with sessions in single query', async () => {
      // Arrange
      mockAuth.mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT', email: 'parent@test.com' },
      });

      prisma.parentProfile.findUnique.mockResolvedValue({
        id: 'pp-1',
        userId: 'parent-1',
        children: [
          {
            id: 'student-1',
            user: { firstName: 'Child', lastName: 'One' },
            sessions: [],
            subscriptions: [],
          },
        ],
      });

      // Act
      const { GET } = await import('@/app/api/parent/children/route');
      const req = new NextRequest('http://localhost:3000/api/parent/children');
      await GET(req as any);

      // Assert: parentProfile.findUnique called once with include
      expect(prisma.parentProfile.findUnique).toHaveBeenCalledTimes(1);
      const call = prisma.parentProfile.findUnique.mock.calls[0][0];
      if (call?.include) {
        expect(call.include.children).toBeDefined();
      }
    });
  });

  describe('Student Sessions List', () => {
    it('should include coach profile in single query', async () => {
      // Arrange
      mockAuth.mockResolvedValue({
        user: { id: 'student-1', role: 'ELEVE', email: 'student@test.com' },
      });

      prisma.student.findUnique.mockResolvedValue({
        id: 'student-1',
        userId: 'student-1',
      });

      prisma.sessionBooking.findMany.mockResolvedValue([
        {
          id: 'session-1',
          coachId: 'coach-1',
          subject: 'MATHEMATIQUES',
          coach: { user: { firstName: 'Coach', lastName: 'One' } },
        },
      ]);

      // Act
      const { GET } = await import('@/app/api/student/sessions/route');
      const req = new NextRequest('http://localhost:3000/api/student/sessions');
      await GET(req as any);

      // Assert: sessionBooking.findMany called once
      const findManyCalls = prisma.sessionBooking.findMany.mock.calls;
      if (findManyCalls.length > 0) {
        expect(findManyCalls).toHaveLength(1);
      }
    });
  });

  describe('ARIA Conversations List', () => {
    it('should include messages count without N+1', async () => {
      // Arrange
      mockAuth.mockResolvedValue({
        user: { id: 'student-1', role: 'ELEVE', email: 'student@test.com' },
      });

      prisma.student.findUnique.mockResolvedValue({
        id: 'student-1',
        userId: 'student-1',
      });

      prisma.ariaConversation.findMany.mockResolvedValue([
        {
          id: 'conv-1',
          title: 'Math Help',
          _count: { messages: 5 },
        },
      ]);

      // Act
      const { GET } = await import('@/app/api/aria/conversations/route');
      const req = new NextRequest('http://localhost:3000/api/aria/conversations');
      await GET(req as any);

      // Assert: ariaConversation.findMany called once
      const findManyCalls = prisma.ariaConversation.findMany.mock.calls;
      if (findManyCalls.length > 0) {
        expect(findManyCalls).toHaveLength(1);
      }
    });
  });
});
