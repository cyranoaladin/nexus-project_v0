/**
 * Integration Tests - Parent Dashboard API
 *
 * Tests the parent dashboard endpoint with:
 * - Authentication (401 without session)
 * - Authorization (403 for non-parent roles)
 * - Badge retrieval (count, categories, recent flag)
 * - Financial history (payments + credit transactions merged)
 * - Progress calculation (accurate percentages and dates)
 * - Parent-child data isolation
 */

import { GET } from '@/app/api/parent/dashboard/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('next-auth');
jest.mock('@/lib/prisma');

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('GET /api/parent/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Authorization', () => {
    it('should return 403 when user is not a PARENT', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'student@test.com',
          role: 'ELEVE',
          firstName: 'Test',
          lastName: 'Student'
        },
        expires: '2026-12-31'
      });

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 403 when user is a COACH', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'coach@test.com',
          role: 'COACH',
          firstName: 'Test',
          lastName: 'Coach'
        },
        expires: '2026-12-31'
      });

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 403 when user is an ADMIN', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'admin@test.com',
          role: 'ADMIN',
          firstName: 'Test',
          lastName: 'Admin'
        },
        expires: '2026-12-31'
      });

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('Parent Profile Not Found', () => {
    it('should return 404 when parent profile does not exist', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Parent profile not found');
    });
  });

  describe('Badge Retrieval', () => {
    it('should retrieve badges with correct count, categories, and recent flag', async () => {
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      const mockParentProfile = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        city: 'Tunis',
        country: 'Tunisia'
      };

      const mockParent = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          firstName: 'Test',
          lastName: 'Parent',
          role: 'PARENT'
        },
        children: [
          {
            id: 'student-123',
            userId: 'student-user-123',
            grade: 'Terminale',
            school: 'Test School',
            user: {
              id: 'student-user-123',
              email: 'student@test.com',
              firstName: 'Student',
              lastName: 'One',
              role: 'ELEVE'
            },
            creditTransactions: [
              { id: 'ct-1', amount: 100, type: 'PURCHASE', description: 'Initial credits', createdAt: now },
              { id: 'ct-2', amount: -10, type: 'USAGE', description: 'Session booking', createdAt: now }
            ],
            badges: [
              {
                id: 'sb-1',
                earnedAt: now,
                badge: {
                  id: 'badge-1',
                  name: 'Assidu',
                  description: '10 sessions completed',
                  category: 'ASSIDUITE',
                  icon: '🏆'
                }
              },
              {
                id: 'sb-2',
                earnedAt: eightDaysAgo,
                badge: {
                  id: 'badge-2',
                  name: 'Progression',
                  description: 'Improved score',
                  category: 'PROGRESSION',
                  icon: '📈'
                }
              },
              {
                id: 'sb-3',
                earnedAt: sevenDaysAgo,
                badge: {
                  id: 'badge-3',
                  name: 'Curieux',
                  description: 'Asked 50 questions',
                  category: 'CURIOSITE',
                  icon: '🤔'
                }
              }
            ],
            subscriptions: []
          }
        ]
      };

      (prisma.parentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockParentProfile)
        .mockResolvedValueOnce(mockParent);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(0);
      (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.children).toHaveLength(1);
      expect(data.children[0].badges).toHaveLength(3);
      
      // Check badge categories
      const badgeCategories = data.children[0].badges.map((b: any) => b.category);
      expect(badgeCategories).toContain('ASSIDUITE');
      expect(badgeCategories).toContain('PROGRESSION');
      expect(badgeCategories).toContain('CURIOSITE');

      // Check recent flag (badge earned today should be recent)
      const recentBadge = data.children[0].badges.find((b: any) => b.name === 'Assidu');
      expect(recentBadge.isRecent).toBe(true);

      // Check not recent (badge earned 8 days ago)
      const oldBadge = data.children[0].badges.find((b: any) => b.name === 'Progression');
      expect(oldBadge.isRecent).toBe(false);

      // Badge earned exactly 7 days ago should be recent
      const sevenDayBadge = data.children[0].badges.find((b: any) => b.name === 'Curieux');
      expect(sevenDayBadge.isRecent).toBe(true);

      // Check badge icons
      expect(recentBadge.icon).toBe('🏆');
      expect(oldBadge.icon).toBe('📈');
    });

    it('should handle students with no badges', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      const mockParentProfile = {
        id: 'parent-profile-123',
        userId: 'parent-123'
      };

      const mockParent = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          firstName: 'Test',
          lastName: 'Parent'
        },
        children: [
          {
            id: 'student-123',
            userId: 'student-user-123',
            grade: 'Terminale',
            school: 'Test School',
            user: {
              id: 'student-user-123',
              email: 'student@test.com',
              firstName: 'Student',
              lastName: 'One'
            },
            creditTransactions: [],
            badges: [],
            subscriptions: []
          }
        ]
      };

      (prisma.parentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockParentProfile)
        .mockResolvedValueOnce(mockParent);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(0);
      (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.children[0].badges).toEqual([]);
    });
  });

  describe('Financial History', () => {
    it('should merge payments and credit transactions correctly', async () => {
      const now = new Date();

      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      const mockParentProfile = {
        id: 'parent-profile-123',
        userId: 'parent-123'
      };

      const mockParent = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          firstName: 'Test',
          lastName: 'Parent'
        },
        children: [
          {
            id: 'student-123',
            userId: 'student-user-123',
            grade: 'Terminale',
            school: 'Test School',
            user: {
              id: 'student-user-123',
              email: 'student@test.com',
              firstName: 'Student',
              lastName: 'One'
            },
            creditTransactions: [
              {
                id: 'ct-1',
                type: 'PURCHASE',
                amount: 100,
                description: 'Credit purchase',
                createdAt: new Date('2026-01-15')
              },
              {
                id: 'ct-2',
                type: 'USAGE',
                amount: -10,
                description: 'Session booking',
                createdAt: new Date('2026-01-20')
              }
            ],
            badges: [],
            subscriptions: []
          }
        ]
      };

      const mockPayments = [
        {
          id: 'payment-1',
          type: 'SUBSCRIPTION',
          amount: 199.99,
          description: 'Monthly subscription',
          status: 'COMPLETED',
          createdAt: new Date('2026-01-01')
        },
        {
          id: 'payment-2',
          type: 'CREDIT_PACK',
          amount: 50,
          description: 'Credit pack 50',
          status: 'PENDING',
          createdAt: new Date('2026-01-10')
        }
      ];

      (prisma.parentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockParentProfile)
        .mockResolvedValueOnce(mockParent);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(0);
      (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.financialHistory).toHaveLength(4);

      // Check payments are included
      const subscription = data.financialHistory.find((t: any) => t.type === 'SUBSCRIPTION');
      expect(subscription).toBeDefined();
      expect(subscription.amount).toBe(199.99);
      expect(subscription.status).toBe('COMPLETED');

      const creditPack = data.financialHistory.find((t: any) => t.type === 'CREDIT_PACK');
      expect(creditPack).toBeDefined();
      expect(creditPack.status).toBe('PENDING');

      // Check credit transactions are included with child info
      const creditPurchase = data.financialHistory.find((t: any) => t.id === 'ct-1');
      expect(creditPurchase).toBeDefined();
      expect(creditPurchase.type).toBe('PURCHASE');
      expect(creditPurchase.amount).toBe(100);
      expect(creditPurchase.childId).toBe('student-user-123');
      expect(creditPurchase.childName).toBe('Student One');

      const creditUsage = data.financialHistory.find((t: any) => t.id === 'ct-2');
      expect(creditUsage).toBeDefined();
      expect(creditUsage.amount).toBe(-10);

      // Check sorting (most recent first)
      expect(data.financialHistory[0].id).toBe('ct-2');
      expect(data.financialHistory[1].id).toBe('ct-1');
      expect(data.financialHistory[2].id).toBe('payment-2');
      expect(data.financialHistory[3].id).toBe('payment-1');
    });

    it('should handle no financial transactions', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      const mockParentProfile = {
        id: 'parent-profile-123',
        userId: 'parent-123'
      };

      const mockParent = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          firstName: 'Test',
          lastName: 'Parent'
        },
        children: [
          {
            id: 'student-123',
            userId: 'student-user-123',
            grade: 'Terminale',
            school: 'Test School',
            user: {
              id: 'student-user-123',
              email: 'student@test.com',
              firstName: 'Student',
              lastName: 'One'
            },
            creditTransactions: [],
            badges: [],
            subscriptions: []
          }
        ]
      };

      (prisma.parentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockParentProfile)
        .mockResolvedValueOnce(mockParent);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(0);
      (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.financialHistory).toEqual([]);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress based on completed sessions', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      const mockParentProfile = {
        id: 'parent-profile-123',
        userId: 'parent-123'
      };

      const mockParent = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          firstName: 'Test',
          lastName: 'Parent'
        },
        children: [
          {
            id: 'student-123',
            userId: 'student-user-123',
            grade: 'Terminale',
            school: 'Test School',
            user: {
              id: 'student-user-123',
              email: 'student@test.com',
              firstName: 'Student',
              lastName: 'One'
            },
            creditTransactions: [],
            badges: [],
            subscriptions: []
          }
        ]
      };

      (prisma.parentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockParentProfile)
        .mockResolvedValueOnce(mockParent);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Mock: 7 completed out of 10 total = 70% progress
      (prisma.sessionBooking.count as jest.Mock)
        .mockResolvedValueOnce(7) // completed
        .mockResolvedValueOnce(10); // total

      (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.children[0].progress).toBe(70);
    });

    it('should calculate progress history by week', async () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      const mockParentProfile = {
        id: 'parent-profile-123',
        userId: 'parent-123'
      };

      const mockParent = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          firstName: 'Test',
          lastName: 'Parent'
        },
        children: [
          {
            id: 'student-123',
            userId: 'student-user-123',
            grade: 'Terminale',
            school: 'Test School',
            user: {
              id: 'student-user-123',
              email: 'student@test.com',
              firstName: 'Student',
              lastName: 'One'
            },
            creditTransactions: [],
            badges: [],
            subscriptions: []
          }
        ]
      };

      const mockSessions = [
        {
          id: 'session-1',
          studentId: 'student-user-123',
          scheduledDate: new Date('2026-01-05'),
          status: 'COMPLETED',
          subject: 'MATHEMATIQUES'
        },
        {
          id: 'session-2',
          studentId: 'student-user-123',
          scheduledDate: new Date('2026-01-06'),
          status: 'COMPLETED',
          subject: 'MATHEMATIQUES'
        },
        {
          id: 'session-3',
          studentId: 'student-user-123',
          scheduledDate: new Date('2026-01-07'),
          status: 'SCHEDULED',
          subject: 'PHYSIQUE'
        }
      ];

      (prisma.parentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockParentProfile)
        .mockResolvedValueOnce(mockParent);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(0);
      (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([
        { subject: 'MATHEMATIQUES', _count: { id: 2 } }
      ]);
      
      // Mock for progress history query
      (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue(mockSessions);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.children[0].progressHistory).toBeDefined();
      expect(data.children[0].progressHistory.length).toBeGreaterThan(0);

      // Check first week data (all 3 sessions in same week)
      const weekData = data.children[0].progressHistory[0];
      expect(weekData.totalSessions).toBe(3);
      expect(weekData.completedSessions).toBe(2);
      expect(weekData.progress).toBe(67); // 2/3 = 66.67 rounded to 67
    });

    it('should calculate subject-specific progress', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      const mockParentProfile = {
        id: 'parent-profile-123',
        userId: 'parent-123'
      };

      const mockParent = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          firstName: 'Test',
          lastName: 'Parent'
        },
        children: [
          {
            id: 'student-123',
            userId: 'student-user-123',
            grade: 'Terminale',
            school: 'Test School',
            user: {
              id: 'student-user-123',
              email: 'student@test.com',
              firstName: 'Student',
              lastName: 'One'
            },
            creditTransactions: [],
            badges: [],
            subscriptions: []
          }
        ]
      };

      (prisma.parentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockParentProfile)
        .mockResolvedValueOnce(mockParent);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.count as jest.Mock)
        .mockResolvedValueOnce(0) // overall completed
        .mockResolvedValueOnce(0) // overall total
        .mockResolvedValueOnce(3) // MATHEMATIQUES completed
        .mockResolvedValueOnce(2); // PHYSIQUE completed

      (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([
        { subject: 'MATHEMATIQUES', _count: { id: 5 } },
        { subject: 'PHYSIQUE', _count: { id: 4 } }
      ]);
      
      (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.children[0].subjectProgress).toBeDefined();
      expect(data.children[0].subjectProgress.MATHEMATIQUES).toBe(60); // 3/5
      expect(data.children[0].subjectProgress.PHYSIQUE).toBe(50); // 2/4
    });
  });

  describe('Parent-Child Data Isolation', () => {
    it('should only return data for the authenticated parent children', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      const mockParentProfile = {
        id: 'parent-profile-123',
        userId: 'parent-123'
      };

      const mockParent = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          firstName: 'Test',
          lastName: 'Parent'
        },
        children: [
          {
            id: 'student-123',
            userId: 'student-user-123',
            grade: 'Terminale',
            school: 'Test School',
            user: {
              id: 'student-user-123',
              email: 'student1@test.com',
              firstName: 'Student',
              lastName: 'One'
            },
            creditTransactions: [],
            badges: [],
            subscriptions: []
          },
          {
            id: 'student-456',
            userId: 'student-user-456',
            grade: 'Première',
            school: 'Test School',
            user: {
              id: 'student-user-456',
              email: 'student2@test.com',
              firstName: 'Student',
              lastName: 'Two'
            },
            creditTransactions: [],
            badges: [],
            subscriptions: []
          }
        ]
      };

      (prisma.parentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockParentProfile)
        .mockResolvedValueOnce(mockParent);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(0);
      (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.parent.id).toBe('parent-profile-123');
      expect(data.children).toHaveLength(2);
      expect(data.children[0].id).toBe('student-user-123');
      expect(data.children[1].id).toBe('student-user-456');

      // Verify the API queries used the correct parent ID
      expect(prisma.parentProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'parent-123' }
      });

      expect(prisma.parentProfile.findUnique).toHaveBeenCalledWith({
        where: { id: 'parent-profile-123' },
        include: expect.objectContaining({
          user: true,
          children: expect.any(Object)
        })
      });
    });

    it('should not include data from other parents children', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      const mockParentProfile = {
        id: 'parent-profile-123',
        userId: 'parent-123'
      };

      const mockParent = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          firstName: 'Test',
          lastName: 'Parent'
        },
        children: [
          {
            id: 'student-123',
            userId: 'student-user-123',
            grade: 'Terminale',
            school: 'Test School',
            user: {
              id: 'student-user-123',
              email: 'student@test.com',
              firstName: 'Student',
              lastName: 'One'
            },
            creditTransactions: [],
            badges: [],
            subscriptions: []
          }
        ]
      };

      (prisma.parentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockParentProfile)
        .mockResolvedValueOnce(mockParent);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(0);
      (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Should only have 1 child from parent-123
      expect(data.children).toHaveLength(1);
      expect(data.children[0].id).toBe('student-user-123');
      
      // Should not include any other students
      expect(data.children.some((c: any) => c.id === 'other-student-999')).toBe(false);
    });
  });

  describe('Multiple Children with Various Data', () => {
    it('should handle multiple children with different badges and transactions', async () => {
      const now = new Date();

      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          role: 'PARENT',
          firstName: 'Test',
          lastName: 'Parent'
        },
        expires: '2026-12-31'
      });

      const mockParentProfile = {
        id: 'parent-profile-123',
        userId: 'parent-123'
      };

      const mockParent = {
        id: 'parent-profile-123',
        userId: 'parent-123',
        user: {
          id: 'parent-123',
          email: 'parent@test.com',
          firstName: 'Test',
          lastName: 'Parent'
        },
        children: [
          {
            id: 'student-1',
            userId: 'student-user-1',
            grade: 'Terminale',
            school: 'School A',
            user: {
              id: 'student-user-1',
              email: 'student1@test.com',
              firstName: 'Alice',
              lastName: 'Smith'
            },
            creditTransactions: [
              { id: 'ct-1', type: 'PURCHASE', amount: 50, description: 'Credits', createdAt: now }
            ],
            badges: [
              {
                id: 'sb-1',
                earnedAt: now,
                badge: { id: 'b1', name: 'Badge1', description: 'Desc1', category: 'ASSIDUITE', icon: '🏆' }
              }
            ],
            subscriptions: []
          },
          {
            id: 'student-2',
            userId: 'student-user-2',
            grade: 'Première',
            school: 'School B',
            user: {
              id: 'student-user-2',
              email: 'student2@test.com',
              firstName: 'Bob',
              lastName: 'Jones'
            },
            creditTransactions: [
              { id: 'ct-2', type: 'PURCHASE', amount: 100, description: 'Credits', createdAt: now }
            ],
            badges: [
              {
                id: 'sb-2',
                earnedAt: now,
                badge: { id: 'b2', name: 'Badge2', description: 'Desc2', category: 'PROGRESSION', icon: '📈' }
              },
              {
                id: 'sb-3',
                earnedAt: now,
                badge: { id: 'b3', name: 'Badge3', description: 'Desc3', category: 'CURIOSITE', icon: '🤔' }
              }
            ],
            subscriptions: []
          }
        ]
      };

      (prisma.parentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockParentProfile)
        .mockResolvedValueOnce(mockParent);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(0);
      (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/parent/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.children).toHaveLength(2);

      // Check first child
      expect(data.children[0].firstName).toBe('Alice');
      expect(data.children[0].badges).toHaveLength(1);
      expect(data.children[0].credits).toBe(50);

      // Check second child
      expect(data.children[1].firstName).toBe('Bob');
      expect(data.children[1].badges).toHaveLength(2);
      expect(data.children[1].credits).toBe(100);

      // Check financial history includes both children's transactions
      expect(data.financialHistory).toHaveLength(2);
      expect(data.financialHistory.some((t: any) => t.childName === 'Alice Smith')).toBe(true);
      expect(data.financialHistory.some((t: any) => t.childName === 'Bob Jones')).toBe(true);
    });
  });
});
