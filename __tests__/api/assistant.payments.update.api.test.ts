import { PATCH } from '@/app/api/assistant/payments/[id]/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      update: jest.fn(),
    },
  },
}));

const mockedGetServerSession = getServerSession as jest.Mock;
const mockedUpdate = prisma.payment.update as jest.Mock;

const updatedPaymentFixture = {
  id: 'pay_1',
  userId: 'user_1',
  amount: 120,
  currency: 'TND',
  description: 'Abonnement premium',
  status: 'COMPLETED',
  method: 'konnect',
  type: 'SUBSCRIPTION',
  externalId: 'ext_1',
  metadata: { studentId: 'stu_1' },
  createdAt: new Date('2025-10-01T10:00:00Z'),
  updatedAt: new Date('2025-10-01T10:05:00Z'),
  user: {
    id: 'user_1',
    firstName: 'Alice',
    lastName: 'Martin',
    email: 'alice@example.com',
    role: 'PARENT',
  },
};

describe('PATCH /api/assistant/payments/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    mockedUpdate.mockResolvedValue(updatedPaymentFixture);
  });

  it('updates payment status and returns mapped payment', async () => {
    const req = {
      json: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
    } as unknown as NextRequest;

    const res = await PATCH(req as any, { params: { id: 'pay_1' } });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.payment).toMatchObject({
      id: 'pay_1',
      status: 'COMPLETED',
      user: {
        id: 'user_1',
        email: 'alice@example.com',
      },
    });
    const updateArgs = mockedUpdate.mock.calls[0][0];
    expect(updateArgs.include).toBeDefined();
  });

  it('rejects invalid status values', async () => {
    const req = {
      json: jest.fn().mockResolvedValue({ status: 'INVALID' }),
    } as unknown as NextRequest;

    const res = await PATCH(req as any, { params: { id: 'pay_1' } });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toContain('Invalid status');
    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});
