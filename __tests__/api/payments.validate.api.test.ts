import { POST } from '@/app/api/payments/validate/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedGetServerSession = getServerSession as jest.Mock;
const mockedFindUnique = prisma.payment.findUnique as jest.Mock;
const mockedUpdate = prisma.payment.update as jest.Mock;

const basePayment = {
  id: 'pay-1',
  userId: 'user-1',
  amount: 150,
  currency: 'TND',
  description: 'Pack credits',
  status: 'PENDING',
  method: 'manual',
  type: 'CREDIT_PACK',
  externalId: 'ext-1',
  metadata: {},
  createdAt: new Date('2025-10-01T10:00:00Z'),
  updatedAt: new Date('2025-10-01T10:00:00Z'),
};

const mappedPayment = {
  ...basePayment,
  status: 'COMPLETED',
  metadata: { validatedBy: 'assistant-1' },
  updatedAt: new Date('2025-10-01T10:05:00Z'),
  user: {
    id: 'user-1',
    firstName: 'Bob',
    lastName: 'Martin',
    email: 'bob@example.com',
    role: 'PARENT',
  },
};

describe('POST /api/payments/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
    mockedFindUnique.mockResolvedValue(basePayment);
    mockedUpdate.mockResolvedValue(mappedPayment);
  });

  it('approves payment and returns normalized payload', async () => {
    const req = { json: jest.fn().mockResolvedValue({ paymentId: 'pay-1', action: 'approve' }) } as unknown as NextRequest;
    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.payment).toMatchObject({
      id: 'pay-1',
      status: 'COMPLETED',
      user: {
        id: 'user-1',
        email: 'bob@example.com',
      },
    });
    const updateArgs = mockedUpdate.mock.calls[0][0];
    expect(updateArgs.include).toBeDefined();
  });

  it('rejects payment and returns normalized payload', async () => {
    mockedUpdate.mockResolvedValueOnce({
      ...basePayment,
      status: 'FAILED',
      metadata: { rejectedBy: 'assistant-1' },
      updatedAt: new Date('2025-10-01T10:06:00Z'),
      user: {
        id: 'user-1',
        firstName: 'Bob',
        lastName: 'Martin',
        email: 'bob@example.com',
        role: 'PARENT',
      },
    });

    const req = { json: jest.fn().mockResolvedValue({ paymentId: 'pay-1', action: 'reject' }) } as unknown as NextRequest;
    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.payment.status).toBe('FAILED');
    expect(payload.payment.user.email).toBe('bob@example.com');
  });

  it('rejects invalid payments when schema fails', async () => {
    const req = { json: jest.fn().mockResolvedValue({ paymentId: '', action: 'approve' }) } as unknown as NextRequest;
    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe('Données invalides');
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('rejects unauthorized access', async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    const req = { json: jest.fn().mockResolvedValue({ paymentId: 'pay-1', action: 'approve' }) } as unknown as NextRequest;
    const res = await POST(req as any);

    expect(res.status).toBe(401);
  });
});
