import { POST } from '@/app/api/subscriptions/aria-addon/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findFirst: jest.fn() },
  },
}));

describe('POST /api/subscriptions/aria-addon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 410 because the route is deprecated', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain('dépréciée');
  });

  it('points callers to the canonical ARIA add-on request flow', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain('/api/parent/subscription-requests');
    expect(body.error).toContain('ARIA_ADDON');
  });

  it('does not inspect students through the dormant route', async () => {
    await POST();

    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });
});
