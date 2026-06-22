import { POST } from '@/app/api/subscriptions/change/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findFirst: jest.fn() },
    subscription: { create: jest.fn() },
  },
}));

describe('POST /api/subscriptions/change', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 410 because the route is deprecated', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain('dépréciée');
  });

  it('points callers to the canonical plan change request flow', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain('/api/parent/subscription-requests');
    expect(body.error).toContain('PLAN_CHANGE');
  });

  it('does not create a dormant inactive subscription', async () => {
    await POST();

    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });
});
