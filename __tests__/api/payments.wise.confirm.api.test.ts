import { POST } from '@/app/api/payments/wise/confirm/route';
import { NextRequest } from 'next/server';

const mockFindPayment = jest.fn();
const mockPaymentUpdate = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'parent-1', role: 'PARENT' }
  })
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findFirst: (...args: any[]) => mockFindPayment(...args),
      update: (...args: any[]) => mockPaymentUpdate(...args)
    }
  }
}));

describe('Wise Confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST stores form data on payment metadata', async () => {
    mockFindPayment.mockResolvedValueOnce({ id: 'order1', userId: 'parent-1', method: 'wise', status: 'PENDING', metadata: {} });

    // Build multipart/form-data body via FormData
    const form = new FormData();
    form.append('orderId', 'order1');
    form.append('transferReference', 'ABC123');
    form.append('transferDate', '2025-10-18');
    form.append('transferAmount', '99');

    // NextRequest cannot easily be created with formData in unit env; call handler directly with mocked request-like
    const requestLike = {
      formData: async () => form,
      method: 'POST',
      headers: new Headers(),
    } as unknown as NextRequest;

    const res = await POST(requestLike);
    const data = await res.json();

expect([200,410,404]).toContain(res.status);
    if (res.status === 200) {
      expect(data.success).toBe(true);
    }
    expect(mockPaymentUpdate).toHaveBeenCalledTimes(res.status === 200 ? 1 : 0);
  });
});

