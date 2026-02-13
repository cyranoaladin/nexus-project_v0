import { POST } from '@/app/api/payments/validate/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: { findUnique: jest.fn(), update: jest.fn() },
    student: { findUnique: jest.fn() },
    subscription: { updateMany: jest.fn(), findFirst: jest.fn() },
    creditTransaction: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/payments/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not assistant', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Accès');
  });

  it('returns 404 when payment not found', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ paymentId: 'pay-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Paiement');
  });

  it('returns 400 on invalid payload', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await POST(makeRequest({ paymentId: 'pay-1', action: 'invalid' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Données');
  });

  it('approves payment via transaction', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-1',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1', itemKey: 'PLAN' },
      user: { parentProfile: { children: [] } },
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        payment: { update: jest.fn().mockResolvedValue({}) },
        student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
        subscription: { updateMany: jest.fn(), findFirst: jest.fn().mockResolvedValue({ creditsPerMonth: 0 }) },
        creditTransaction: { create: jest.fn() },
      };
      return cb(tx);
    });

    const response = await POST(makeRequest({ paymentId: 'pay-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('allocates credits when subscription has credits', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-2',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1', itemKey: 'PLAN' },
      user: { parentProfile: { children: [] } },
    });
    let capturedTx: any = null;
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        payment: { update: jest.fn().mockResolvedValue({}) },
        student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
        subscription: { updateMany: jest.fn(), findFirst: jest.fn().mockResolvedValue({ creditsPerMonth: 4 }) },
        creditTransaction: { create: jest.fn() },
      };
      capturedTx = tx;
      return cb(tx);
    });

    const response = await POST(makeRequest({ paymentId: 'pay-2', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(capturedTx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-1',
          type: 'MONTHLY_ALLOCATION',
          amount: 4,
        }),
      })
    );
  });

  it('rejects payment and updates status', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-3',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1' },
      user: { parentProfile: { children: [] } },
    });

    const response = await POST(makeRequest({ paymentId: 'pay-3', action: 'reject', note: 'Nope' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-3' },
        data: expect.objectContaining({
          status: 'FAILED',
        }),
      })
    );
  });

  it('returns 409 on transaction conflict', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-4',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1', itemKey: 'PLAN' },
      user: { parentProfile: { children: [] } },
    });
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2034' });

    const response = await POST(makeRequest({ paymentId: 'pay-4', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('Conflit');
  });

  it('returns 404 on transaction P2025', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-5',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1', itemKey: 'PLAN' },
      user: { parentProfile: { children: [] } },
    });
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2025' });

    const response = await POST(makeRequest({ paymentId: 'pay-5', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Ressource');
  });
});
