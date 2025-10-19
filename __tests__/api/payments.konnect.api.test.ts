import { POST as POST_KONNECT } from '@/app/api/payments/konnect/route';
import { POST as KONNECT_WEBHOOK } from '@/app/api/webhooks/konnect/route';
import { NextRequest } from 'next/server';

const mockFindFirstStudent = jest.fn();
const mockUpsert = jest.fn();
const mockFindUniquePayment = jest.fn();
const mockPaymentUpdate = jest.fn();
const mockSubUpdateMany = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'parent-1', role: 'PARENT' }
  })
}));

jest.mock('@/lib/payments', () => ({
  upsertPaymentByExternalId: (...args: any[]) => mockUpsert(...args)
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: {
      findFirst: (...args: any[]) => mockFindFirstStudent(...args),
      findUnique: (...args: any[]) => mockFindFirstStudent(...args),
    },
    payment: {
      findFirst: (...args: any[]) => mockFindUniquePayment(...args),
      findUnique: (...args: any[]) => mockFindUniquePayment(...args),
      update: (...args: any[]) => mockPaymentUpdate(...args)
    },
    subscription: {
      updateMany: (...args: any[]) => mockSubUpdateMany(...args)
    }
  }
}));

describe('Konnect Payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/payments/konnect creates idempotent payment and returns payment URL', async () => {
    mockFindFirstStudent.mockResolvedValueOnce({ id: 'st1' });
    mockUpsert.mockResolvedValueOnce({ payment: { id: 'pay1' }, created: true });

    const req = new NextRequest('http://localhost/api/payments/konnect', {
      method: 'POST',
      body: JSON.stringify({ type: 'subscription', key: 'HYBRIDE', studentId: 'st1', amount: 99, description: 'Abonnement HYBRIDE' })
    } as any);
    const res = await POST_KONNECT(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.paymentId).toBe('pay1');
expect(data.payUrl).toContain('paymentId=pay1');
  });

  it('POST /api/webhooks/konnect marks payment completed and updates subscription', async () => {
    mockFindUniquePayment.mockResolvedValueOnce({ id: 'pay1', status: 'PENDING', type: 'SUBSCRIPTION', metadata: { studentId: 'st1', itemKey: 'HYBRIDE' }, user: { parentProfile: { children: [] } } });
    // Ensure student exists so subscription.updateMany path executes
    mockFindFirstStudent.mockResolvedValueOnce({ id: 'st1' });

    const req = new NextRequest('http://localhost/api/webhooks/konnect', {
      method: 'POST',
      body: JSON.stringify({ payment_id: 'pay1', status: 'completed' })
    } as any);
    const res = await KONNECT_WEBHOOK(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPaymentUpdate).toHaveBeenCalled();
    expect(mockSubUpdateMany).toHaveBeenCalled();
  });
});
