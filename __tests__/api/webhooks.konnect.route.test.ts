import { POST } from '@/app/api/webhooks/konnect/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: { findUnique: jest.fn(), update: jest.fn() },
    student: { findUnique: jest.fn() },
    subscription: { updateMany: jest.fn(), findFirst: jest.fn() },
    creditTransaction: { create: jest.fn() },
  },
}));

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return {
    text: async () => body,
    headers: {
      get: (key: string) => headers[key],
    },
  } as any;
}

describe('POST /api/webhooks/konnect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when payload missing', async () => {
    const response = await POST(makeRequest(JSON.stringify({})));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('invalides');
  });

  it('returns 404 when payment not found', async () => {
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest(JSON.stringify({ payment_id: 'pay-1', status: 'completed' })));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Paiement');
  });

  it('updates payment when status failed', async () => {
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({ id: 'pay-1' });
    (prisma.payment.update as jest.Mock).mockResolvedValue({});

    const response = await POST(makeRequest(JSON.stringify({ payment_id: 'pay-1', status: 'failed' })));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
