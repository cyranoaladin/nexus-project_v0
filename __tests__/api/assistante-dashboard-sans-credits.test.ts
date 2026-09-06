import { GET } from '@/app/api/assistante/dashboard/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/bilans/staff/notification-service', () => ({ computeAssistantWorkQueue: jest.fn().mockResolvedValue({ pendingReview: 2 }) }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  student: { count: jest.fn().mockResolvedValue(3) },
  coachProfile: { count: jest.fn().mockResolvedValue(1) },
  sessionBooking: { count: jest.fn().mockResolvedValue(4), findMany: jest.fn().mockResolvedValue([]) },
  payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 750 } }), count: jest.fn().mockResolvedValue(1) },
  subscription: { aggregate: jest.fn().mockResolvedValue({ _sum: { monthlyPrice: 450 } }) },
  diagnostic: { count: jest.fn().mockResolvedValue(2) },
  creditTransaction: { count: jest.fn().mockResolvedValue(3) },
  subscriptionRequest: { count: jest.fn().mockResolvedValue(1) },
} }));
describe('assistant dashboard without credits', () => {
  beforeEach(() => { jest.clearAllMocks(); (auth as jest.Mock).mockResolvedValue({ user: { role: 'ASSISTANTE' } }); });
  it('counts only completed payments as collected revenue', async () => {
    const body = await (await GET(new NextRequest('http://localhost/api/assistante/dashboard'))).json();
    expect(body.stats.totalRevenue).toBe(750);
    expect(prisma.subscription.aggregate).not.toHaveBeenCalled();
  });
  it('retains the pedagogical queue without reading or publishing credit balances', async () => {
    const body = await (await GET(new NextRequest('http://localhost/api/assistante/dashboard'))).json();
    expect(body.canonicalBilans.pendingReview).toBe(2);
    expect(body.stats).not.toHaveProperty('pendingCreditRequests');
    expect(prisma.creditTransaction.count).not.toHaveBeenCalled();
  });
  it('denies a parent access', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } });
    expect((await GET(new NextRequest('http://localhost/'))).status).toBe(401);
    expect(prisma.payment.aggregate).not.toHaveBeenCalled();
  });
});
