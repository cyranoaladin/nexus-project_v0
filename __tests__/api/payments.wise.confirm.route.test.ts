import { POST } from '@/app/api/payments/wise/confirm/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: { findFirst: jest.fn(), update: jest.fn() },
  },
}));

function makeRequest(formData: FormData) {
  return {
    formData: async () => formData,
  } as any;
}

describe('POST /api/payments/wise/confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not parent', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const form = new FormData();
    const response = await POST(makeRequest(form));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Accès');
  });

  it('returns 404 when payment missing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

    const form = new FormData();
    form.set('orderId', 'pay-1');
    form.set('transferReference', 'ref');
    form.set('transferDate', '2025-01-01');
    form.set('transferAmount', '100');

    const response = await POST(makeRequest(form));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Commande');
  });

  it('updates payment metadata when valid', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue({ id: 'pay-1', metadata: {} });
    (prisma.payment.update as jest.Mock).mockResolvedValue({});

    const form = new FormData();
    form.set('orderId', 'pay-1');
    form.set('transferReference', 'ref');
    form.set('transferDate', '2025-01-01');
    form.set('transferAmount', '100');

    const response = await POST(makeRequest(form));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
