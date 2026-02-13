import { POST } from '@/app/api/payments/wise/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findFirst: jest.fn() },
    payment: { create: jest.fn() },
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/payments/wise', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not parent', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Accès');
  });

  it('returns 404 when student not found', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({
      type: 'subscription',
      key: 'PLAN',
      studentId: 'student-1',
      amount: 100,
      description: 'Sub',
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Élève');
  });

  it('creates payment when valid', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });

    const response = await POST(makeRequest({
      type: 'subscription',
      key: 'PLAN',
      studentId: 'student-1',
      amount: 100,
      description: 'Sub',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.orderId).toBe('pay-1');
  });
});
