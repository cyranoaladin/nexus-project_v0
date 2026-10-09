/**
 * Reservation Verify API — Complete Test Suite
 *
 * Tests: POST /api/reservation/verify
 *
 * Source: app/api/reservation/verify/route.ts
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
import { auth } from '@/auth';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { POST } from '@/app/api/reservation/verify/route';
import { NextRequest } from 'next/server';

import { prisma as database } from '@/lib/prisma';
const prisma = { stageReservation: { findFirst: jest.mocked(database.stageReservation.findFirst) } };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.stageReservation.findFirst.mockReset();
  prisma.stageReservation.findFirst.mockResolvedValue({ id: 'synthetic-reservation' } as never);
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-staff', role: 'ADMIN', email: 'staff@synthetic.test' } } as never);
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
    prisma.stageReservation.findFirst.mockResolvedValue({ id: 'res-1' } as never);

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


describe('reservation existence privacy boundary', () => {
  it.each([null, 'PARENT', 'ELEVE', 'COACH'])('denies unauthenticated or non-staff identity %s before looking up a private contact', async role => {
    jest.mocked(auth).mockResolvedValue(role === null ? null : { user: { id: 'synthetic-other', role, email: 'other@synthetic.test' } } as never);
    const response = await POST(makeRequest({ email: 'reserved@synthetic.test' }));
    expect([401, 403]).toContain(response.status);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
    expect(await response.json()).not.toHaveProperty('exists');
  });
  it('rate-limits the authenticated requester without using the searched email as authority', async () => {
    const { NextResponse } = await import('next/server');
    jest.mocked(guardSensitiveRateLimit).mockResolvedValueOnce(NextResponse.json({ error: 'Limite atteinte' }, { status: 429 }));
    const response = await POST(makeRequest({ email: 'reserved@synthetic.test' }));
    expect(response.status).toBe(429);
    expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
  });
});


test('bounds the actual request stream without trusting Content-Length', async () => {
  const response = await POST(makeRequest({ email: ' '.repeat(4096) + 'synthetic@example.test' }));
  expect(response.status).toBe(413);
  expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
});
test('rejects unexpected fields instead of accepting a nested query', async () => {
  const response = await POST(makeRequest({ email: 'synthetic@example.test', where: { OR: [] } }));
  expect(response.status).toBe(400);
  expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
});
test('keys throttling on staff identity and marks the existence response private', async () => {
  const request = makeRequest({ email: 'synthetic@example.test' });
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(guardSensitiveRateLimit).toHaveBeenCalledWith(request, { scope: 'reservation-verify', identity: 'synthetic-staff' });
});


test('fails closed with a private opaque error when throttling authority is unavailable', async () => {
  jest.mocked(guardSensitiveRateLimit).mockRejectedValueOnce(new Error('synthetic-private-backend-detail'));
  const response = await POST(makeRequest({ email: 'synthetic@example.test' }));
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(JSON.stringify(await response.json())).not.toContain('synthetic-private-backend-detail');
  expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
});


test('permits the existing administrative reservation lookup for ASSISTANTE', async () => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-staff', role: 'ASSISTANTE', email: 'staff@synthetic.test' } } as never);
  const response = await POST(makeRequest({ email: 'synthetic@example.test' }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ exists: true });
});
test('rejects a production cross-origin staff lookup before throttling or database access', async () => {
  const previous = process.env.NODE_ENV;
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true, writable: true });
  try {
    const request = new NextRequest('https://nexusreussite.academy/api/reservation/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.invalid' },
      body: JSON.stringify({ email: 'synthetic@example.test' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(guardSensitiveRateLimit).not.toHaveBeenCalled();
    expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(process.env, 'NODE_ENV', { value: previous, configurable: true, writable: true });
  }
});
