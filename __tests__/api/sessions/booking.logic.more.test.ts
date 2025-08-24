jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { NextRequest } from 'next/server';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } }),
}));

describe('POST /api/sessions/book - booking logic branches', () => {
  const prisma = require('@/lib/prisma').prisma;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    const { getServerSession } = require('next-auth/next');
    getServerSession.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/sessions/book', {
      method: 'POST',
      body: JSON.stringify({}),
    } as any);
    const { POST } = require('@/app/api/sessions/book/route');
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('fails when credits are insufficient', async () => {
    // Mock $transaction to run callback with tx methods
    (prisma.$transaction as jest.Mock | any) = jest.fn(async (cb: any) => {
      const tx = {
        creditTransaction: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0.5 } }),
        },
      } as any;
      return cb(tx);
    });

    const body = {
      coachId: 'coach1',
      studentId: 'stud1',
      subject: 'MATHEMATIQUES',
      scheduledDate: '2025-09-01',
      startTime: '14:00',
      duration: 60,
      creditsToUse: 1,
      title: 'Révision équations',
    };
    const req = new NextRequest('http://localhost/api/sessions/book', {
      method: 'POST',
      body: JSON.stringify(body),
    } as any);
    const { POST } = require('@/app/api/sessions/book/route');
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Crédits insuffisants/i);
  });

  it('fails when coach has conflicting session', async () => {
    (prisma.$transaction as any) = jest.fn(async (cb: any) => {
      const tx = {
        creditTransaction: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 5 } }) },
        session: { findFirst: jest.fn().mockResolvedValue({ id: 'conflict' }) },
      } as any;
      return cb(tx);
    });

    const body = {
      coachId: 'coach1',
      studentId: 'stud1',
      subject: 'MATHEMATIQUES',
      scheduledDate: '2025-09-01',
      startTime: '15:00',
      duration: 60,
      creditsToUse: 1,
      title: 'Révision',
    };
    const req = new NextRequest('http://localhost/api/sessions/book', { method: 'POST', body: JSON.stringify(body) } as any);
    const { POST } = require('@/app/api/sessions/book/route');
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/créneau n'est plus disponible/i);
  });

  it('succeeds and debits credits when everything is valid', async () => {
    const createdSession = { id: 'sess1' };
    const createTx = jest.fn().mockResolvedValue({ id: 'tx1' });
    (prisma.$transaction as any) = jest.fn(async (cb: any) => {
      const tx = {
        creditTransaction: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 10 } }),
          create: createTx,
        },
        session: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(createdSession),
        },
      } as any;
      return cb(tx);
    });

    const body = {
      coachId: 'coach1',
      studentId: 'stud1',
      subject: 'MATHEMATIQUES',
      scheduledDate: '2025-09-03',
      startTime: '16:00',
      duration: 60,
      creditsToUse: 2,
      title: 'Révision dérivées',
    };
    const req = new NextRequest('http://localhost/api/sessions/book', { method: 'POST', body: JSON.stringify(body) } as any);
    const { POST } = require('@/app/api/sessions/book/route');
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.sessionId).toBe('sess1');
    expect(createTx).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: -2 }) }));
  });
});


