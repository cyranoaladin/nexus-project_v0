import { GET } from '@/app/api/coach/dashboard/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findUnique: jest.fn() },
    sessionBooking: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    student: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));

function makeRequest() {
  return {} as any;
}

describe('GET /api/coach/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not coach', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when coach profile missing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Coach profile not found');
  });

  it('returns dashboard data for coach', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'coach-profile-1',
      pseudonym: 'CoachX',
      tag: 'Math',
      subjects: '["MATHEMATIQUES"]',
      user: { firstName: 'Coach', lastName: 'One', email: 'c@test.com' },
    });
    (prisma.sessionBooking.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 's1',
          student: { firstName: 'Student', lastName: 'One' },
          subject: 'MATHEMATIQUES',
          startTime: '10:00',
          endTime: '11:00',
          type: 'INDIVIDUAL',
          status: 'SCHEDULED',
          scheduledDate: new Date(),
          duration: 60,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 's2',
          studentId: 'student-1',
          student: { firstName: 'Student', lastName: 'One' },
          subject: 'MATHEMATIQUES',
          scheduledDate: new Date(),
          startTime: '10:00',
          endTime: '11:00',
          duration: 60,
          type: 'INDIVIDUAL',
          modality: 'ONLINE',
          status: 'COMPLETED',
          creditsUsed: 2,
          title: 'Math',
          description: '',
        },
      ])
      .mockResolvedValueOnce([
        { studentId: 'student-1' },
      ])
      .mockResolvedValueOnce([
        { studentId: 'student-1', subject: 'MATHEMATIQUES', scheduledDate: new Date() },
      ]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-user-1',
      firstName: 'Student',
      lastName: 'One',
    });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({
      id: 'student-entity-1',
      grade: 'Seconde',
      creditTransactions: [{ amount: 2 }],
    });
    (prisma.student.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'student-entity-1',
        userId: 'student-1',
        creditTransactions: [{ amount: 2 }],
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.coach.pseudonym).toBe('CoachX');
    expect(body.weekStats.totalSessions).toBe(1);
    expect(body.uniqueStudentsCount).toBe(1);
  });
});
