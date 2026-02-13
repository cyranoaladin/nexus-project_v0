import { GET } from '@/app/api/student/dashboard/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
  },
}));

function makeRequest() {
  return {} as any;
}

describe('GET /api/student/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not student', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when student not found', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'student-1', role: 'ELEVE' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Student not found');
  });

  it('returns dashboard data', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'student-1', role: 'ELEVE' },
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-1',
      grade: 'Seconde',
      school: 'Lycée',
      user: { firstName: 'Student', lastName: 'One', email: 's@test.com' },
      subscriptions: [],
      creditTransactions: [{ amount: 2 }, { amount: -1 }],
      sessions: [
        {
          id: 'session-1',
          title: 'Math',
          subject: 'MATHEMATIQUES',
          status: 'SCHEDULED',
          scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
          duration: 60,
          coach: { user: { firstName: 'Coach', lastName: 'One' }, pseudonym: 'CoachX' },
        },
      ],
      ariaConversations: [
        {
          messages: [{ createdAt: new Date() }],
        },
      ],
      badges: [
        { badge: { id: 'b1', name: 'Badge', description: 'Desc', icon: 'icon' }, earnedAt: new Date() },
      ],
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.credits.balance).toBe(1);
    expect(body.ariaStats.totalConversations).toBe(1);
    expect(body.badges).toHaveLength(1);
  });
});
