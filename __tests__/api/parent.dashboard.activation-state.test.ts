jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentProfile: { findUnique: jest.fn() },
    payment: { findMany: jest.fn() },
    mathsProgress: { findFirst: jest.fn() },
    progressionHistory: { findMany: jest.fn() },
  },
}));

import { GET } from '@/app/api/parent/dashboard/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

describe('GET /api/parent/dashboard activation state', () => {
  it('exposes only a derived activation state for the parent child card', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', email: 'parent@example.test' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'profile-1',
      children: [{
        id: 'student-1',
        userId: 'child-user-1',
        grade: 'Seconde',
        gradeLevel: 'SECONDE',
        academicTrack: 'EDS_GENERALE',
        totalSessions: 0,
        completedSessions: 0,
        updatedAt: new Date(),
        user: {
          id: 'child-user-1',
          email: 'child@nexus-student.local',
          firstName: 'Enfant',
          lastName: 'Test',
          activatedAt: null,
          activationExpiry: null,
          studentSessions: [],
        },
        subscriptions: [],
        badges: [],
      }],
    });
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.mathsProgress.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.progressionHistory.findMany as jest.Mock).mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.children[0]).toEqual(expect.objectContaining({
      activationStatus: 'PENDING_ACTIVATION',
      activationExpiresAt: null,
    }));
    expect(JSON.stringify(body)).not.toContain('activationToken');
    expect(JSON.stringify(body)).not.toContain('act_');
  });
});
