jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest
    .fn()
    .mockResolvedValue({ user: { id: 'u1', role: 'PARENT', studentId: 's1', parentId: 'p1' } }),
}));

describe('API /api/aria/chat branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).student = (prisma as any).student || {};
  });

  it('429 when rate-limit exceeded via rateLimit mock', async () => {
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: false }) }));
    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'hi', subject: 'MATHEMATIQUES' }),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.1.1.1' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(429);
    jest.resetModules();
  });

  it('401 when session missing studentId/parentId', async () => {
    jest.resetModules();
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    const { getServerSession } = require('next-auth');
    (getServerSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } });
    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'ok', subject: 'MATHEMATIQUES' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('429 freemium usage reached', async () => {
    jest.resetModules();
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    const fakePrisma = {
      student: {
        findUnique: jest.fn().mockResolvedValue({
          id: 's1',
          freemiumUsage: { date: new Date().toISOString().split('T')[0], requestsToday: 5 },
        }),
        update: jest.fn(),
      },
    } as any;
    jest.doMock('@/lib/prisma', () => ({ prisma: fakePrisma }));
    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'ok', subject: 'MATHEMATIQUES' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(429);
    expect(fakePrisma.student.update).not.toHaveBeenCalled();
  });

  it('increments freemium usage when under quota (covers line 64)', async () => {
    jest.resetModules();
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    const fakePrisma2 = {
      student: {
        findUnique: jest.fn().mockResolvedValue({
          id: 's1',
          freemiumUsage: { date: new Date().toISOString().split('T')[0], requestsToday: 2 },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    jest.doMock('@/lib/prisma', () => ({ prisma: fakePrisma2 }));
    jest.doMock('@/lib/aria/orchestrator', () => ({
      AriaOrchestrator: class {
        constructor() {}
        async handleQuery() {
          return { response: 'ok', documentUrl: undefined };
        }
      },
    }));
    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'ok', subject: 'MATHEMATIQUES' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const args = (fakePrisma2 as any).student.update.mock.calls[0][0];
    expect(args.data.freemiumUsage.requestsToday).toBe(3);
  });
});
