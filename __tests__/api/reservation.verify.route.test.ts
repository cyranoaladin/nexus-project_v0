/**
 * Reservation Verify API — Complete Test Suite
 *
 * Tests: POST /api/reservation/verify
 *
 * Source: app/api/reservation/verify/route.ts
 */

import { POST } from '@/app/api/reservation/verify/route';
import { NextRequest } from 'next/server';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/reservation/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/reservation/verify', () => {
  it('should return exists=true when reservation found', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue({ id: 'res-1' });

    const res = await POST(makeRequest({ email: 'parent@test.com' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exists).toBe(true);
  });

  it('should return exists=false when no reservation', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ email: 'unknown@test.com' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exists).toBe(false);
  });

  it('should return 400 for invalid email', async () => {
    const res = await POST(makeRequest({ email: 'not-email' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.exists).toBe(false);
  });

  it('should return 400 for missing email', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('should normalize email to lowercase', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(null);

    await POST(makeRequest({ email: '  Parent@Test.COM  ' }));

    expect(prisma.stageReservation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'parent@test.com' },
      })
    );
  });

  it('should return 500 on DB error', async () => {
    prisma.stageReservation.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest({ email: 'test@test.com' }));
    expect(res.status).toBe(500);
  });
});
