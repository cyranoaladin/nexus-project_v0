jest.mock('@/lib/auth', () => ({ authOptions: {} }));
// Helper to build a minimal NextRequest-like object with .text() and headers Map
function buildJsonRequest(url: string, body: any, extraHeaders: Record<string, string> = {}) {
  const headers = new Map<string, string>([
    ['content-type', 'application/json'],
    ...Object.entries(extraHeaders),
  ] as any);
  return {
    url,
    method: 'POST',
    headers,
    text: async () => JSON.stringify(body),
  } as any;
}

// Always mock prisma under alias path to be safe across jest projects
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findFirst: jest.fn() },
    productPricing: { findUnique: jest.fn() },
    payment: { create: jest.fn(), findUnique: jest.fn() },
  },
}));
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'parent1', role: 'PARENT' } }),
}));

describe('Payments APIs - dynamic pricing + idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_URL = 'http://localhost';
    // Ensure required prisma methods exist on mocked client
    (prisma as any).productPricing = (prisma as any).productPricing || {};
    (prisma as any).payment = (prisma as any).payment || {};
    (prisma as any).student = (prisma as any).student || {};
  });

  it('returns 400 when pricing is missing/inactive', async () => {
    (prisma.student.findFirst as any) = jest.fn().mockResolvedValue({ id: 's1', parentId: 'pp1' });
    (prisma.productPricing.findUnique as any) = jest.fn().mockResolvedValue(null);

    const req = buildJsonRequest('http://localhost/api/payments/konnect', { type: 'subscription', key: 'UNKNOWN', studentId: 's1' });
    const { POST } = require('@/app/api/payments/konnect/route');
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/inconnu|inactif|tarifé/i);
  });

  it('creates payment using dynamic ProductPricing (Konnect)', async () => {
    (prisma.student.findFirst as any) = jest.fn().mockResolvedValue({ id: 's1', parentId: 'pp1' });
    (prisma.productPricing.findUnique as any) = jest.fn().mockResolvedValue({ amount: 450, currency: 'TND', active: true, description: 'Abonnement Hybride' });
    (prisma.payment.create as any) = jest.fn().mockResolvedValue({ id: 'pay_1' });

    const req = buildJsonRequest('http://localhost/api/payments/konnect', { type: 'subscription', key: 'HYBRIDE', studentId: 's1' });
    const { POST } = require('@/app/api/payments/konnect/route');
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.paymentId).toBe('pay_1');
    expect(prisma.payment.create).toHaveBeenCalled();
  });

  it('is idempotent when Idempotency-Key is provided (Wise)', async () => {
    (prisma.student.findFirst as any) = jest.fn().mockResolvedValue({ id: 's1', parentId: 'pp1' });
    (prisma.productPricing.findUnique as any) = jest.fn().mockResolvedValue({ amount: 120, currency: 'TND', active: true, description: 'Abonnement Accès Plateforme' });
    (prisma.payment.findUnique as any) = jest.fn().mockResolvedValue({ id: 'pay_same', userId: 'parent1', amount: 120, method: 'wise' });
    (prisma.payment.create as any) = jest.fn();

    const req = buildJsonRequest('http://localhost/api/payments/wise', { type: 'subscription', key: 'ACCES_PLATEFORME', studentId: 's1' }, { 'Idempotency-Key': 'IDEMP-123' });
    const { POST } = require('@/app/api/payments/wise/route');
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.orderId).toBe('pay_same');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
