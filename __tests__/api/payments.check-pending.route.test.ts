/**
 * Payments Check Pending API — Complete Test Suite
 *
 * Tests: GET /api/payments/check-pending
 *
 * Source: app/api/payments/check-pending/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { GET } from '@/app/api/payments/check-pending/route';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(params?: string): NextRequest {
  const url = params
    ? `http://localhost:3000/api/payments/check-pending?${params}`
    : 'http://localhost:3000/api/payments/check-pending';
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/payments/check-pending', () => {
  it('should return hasPending=false when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET(makeRequest('description=test&amount=100'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasPending).toBe(false);
  });

  it('should return hasPending=false for non-PARENT role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);

    const res = await GET(makeRequest('description=test&amount=100'));
    const body = await res.json();

    expect(body.hasPending).toBe(false);
  });

  it('should return hasPending=false when params missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.hasPending).toBe(false);
  });

  it('should return hasPending=true when pending payment exists', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } } as any);
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      createdAt: new Date('2026-02-15T10:00:00Z'),
    });

    const res = await GET(makeRequest('description=Abonnement+Hybride&amount=450'));
    const body = await res.json();

    expect(body.hasPending).toBe(true);
    expect(body.paymentId).toBe('pay-1');
    expect(body.createdAt).toBeTruthy();
  });

  it('should return hasPending=false when no pending payment', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } } as any);
    prisma.payment.findFirst.mockResolvedValue(null);

    const res = await GET(makeRequest('description=Abonnement&amount=450'));
    const body = await res.json();

    expect(body.hasPending).toBe(false);
    expect(body.paymentId).toBeNull();
  });

  it('should query with correct filters', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } } as any);
    prisma.payment.findFirst.mockResolvedValue(null);

    await GET(makeRequest('description=Test+Payment&amount=150'));

    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'parent-1',
          method: 'bank_transfer',
          status: 'PENDING',
          description: 'Test Payment',
          amount: 150,
        }),
      })
    );
  });

  it('should return hasPending=false on DB error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } } as any);
    prisma.payment.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await GET(makeRequest('description=test&amount=100'));
    const body = await res.json();

    expect(body.hasPending).toBe(false);
  });
});
