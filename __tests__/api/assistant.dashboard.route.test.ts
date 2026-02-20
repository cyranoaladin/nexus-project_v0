import { GET } from '@/app/api/assistant/dashboard/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { count: jest.fn() },
    coachProfile: { count: jest.fn() },
    sessionBooking: { count: jest.fn(), findMany: jest.fn() },
    payment: { aggregate: jest.fn(), count: jest.fn() },
    subscription: { aggregate: jest.fn() },
    creditTransaction: { count: jest.fn() },
    subscriptionRequest: { count: jest.fn() },
    user: { count: jest.fn() },
    diagnostic: { count: jest.fn() },
  },
}));

function makeRequest() {
  return {} as any;
}

describe('GET /api/assistant/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not assistant', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns dashboard data for assistant', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    (prisma.student.count as jest.Mock).mockResolvedValue(10);
    (prisma.coachProfile.count as jest.Mock).mockResolvedValue(4);
    (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(20);
    (prisma.payment.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 1000 } });
    (prisma.subscription.aggregate as jest.Mock).mockResolvedValue({ _sum: { monthlyPrice: 500 } });
    (prisma.user.count as jest.Mock).mockResolvedValue(2);
    (prisma.payment.count as jest.Mock).mockResolvedValue(1);
    (prisma.creditTransaction.count as jest.Mock).mockResolvedValue(3);
    (prisma.subscriptionRequest.count as jest.Mock).mockResolvedValue(4);
    (prisma.diagnostic.count as jest.Mock).mockResolvedValue(0);
    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', subject: 'MATHEMATIQUES', startTime: '10:00', status: 'SCHEDULED', type: 'INDIVIDUAL' },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats.totalStudents).toBe(10);
    expect(body.stats.totalRevenue).toBe(1500);
    expect(body.todaySessions).toHaveLength(1);
  });
});
