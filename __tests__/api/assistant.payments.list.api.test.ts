import { GET } from '@/app/api/assistant/payments/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findMany: jest.fn(),
    },
  },
}));

const mockedGetServerSession = getServerSession as jest.Mock;
const mockedFindMany = prisma.payment.findMany as jest.Mock;

const paymentFixture = {
  id: 'pay_1',
  userId: 'user_1',
  amount: 120,
  currency: 'TND',
  description: 'Abonnement premium',
  status: 'PENDING',
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

describe('GET /api/assistant/payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    mockedFindMany.mockResolvedValue([paymentFixture]);
  });

  it('returns mapped payments for assistant', async () => {
    const req = new NextRequest('http://localhost/api/assistant/payments');
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toMatchObject({
      id: 'pay_1',
      userId: 'user_1',
      amount: 120,
      user: {
        id: 'user_1',
        firstName: 'Alice',
        lastName: 'Martin',
        email: 'alice@example.com',
        role: 'PARENT',
      },
    });
    const args = mockedFindMany.mock.calls[0][0];
    expect(args.include).toBeDefined();
  });

  it('returns 401 when session is missing', async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/assistant/payments');
    const res = await GET(req as any);

    expect(res.status).toBe(401);
    expect(mockedFindMany).not.toHaveBeenCalled();
  });
});
