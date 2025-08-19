jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } }),
}));

describe('Admin Activities - subscription and credit mapping coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).session = (prisma as any).session || {};
    (prisma as any).user = (prisma as any).user || {};
    (prisma as any).subscription = (prisma as any).subscription || {};
    (prisma as any).creditTransaction = (prisma as any).creditTransaction || {};
  });

  it('maps subscriptions and credits including fallbacks and fields near lines 106-123', async () => {
    // Minimal sessions and users to not interfere
    (prisma as any).session.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).user.findMany = jest.fn().mockResolvedValue([]);

    (prisma as any).subscription.findMany = jest.fn().mockResolvedValue([
      {
        id: 'sub1',
        planName: 'Gold',
        status: 'ACTIVE',
        createdAt: new Date(),
        student: { user: { firstName: undefined, lastName: undefined } },
      },
    ]);

    (prisma as any).creditTransaction.findMany = jest.fn().mockResolvedValue([
      {
        id: 'c1',
        type: 'USAGE',
        amount: -2,
        createdAt: new Date(),
        student: { user: { firstName: 'Alice', lastName: 'A' } },
      },
    ]);

    const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/activities?type=ALL'));
    expect(res.status).toBe(200);
    const json = await res.json();

    const sub = json.activities.find((a: any) => a.type === 'subscription');
    expect(sub).toBeTruthy();
    expect(sub.description).toContain('Unknown'); // fallback first/last name
    expect(sub.status).toBe('ACTIVE');
    expect(sub.subject).toBe('Gold');

    const credit = json.activities.find((a: any) => a.type === 'credit');
    expect(credit).toBeTruthy();
    expect(credit.status).toBe('COMPLETED');
    expect(credit.action).toBe('Transaction USAGE');
    expect(credit.description).toContain('- -2 crédits');
  });
});
