jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { NextRequest } from 'next/server';

describe('API /api/aria/chat edge cases: rate limit, freemium cap, invalid input', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });
  afterEach(() => { process.env = OLD_ENV; });

  test('429 when rate limit exceeded', async () => {
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: false }) }));
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u', studentId: 's', parentId: 'p' } }) }));
    jest.doMock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn().mockResolvedValue({ id: 's', freemiumUsage: null }), update: jest.fn() } } }));

    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'hello', subject: 'MATHEMATIQUES' }) });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  test('429 freemium limit reached returns CTA', async () => {
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    const today = new Date().toISOString().split('T')[0];
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u', studentId: 's', parentId: 'p' } }) }));
    jest.doMock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn().mockResolvedValue({ id: 's', freemiumUsage: { date: today, requestsToday: 5 } }), update: jest.fn() } } }));

    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'x', subject: 'MATHEMATIQUES' }) });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.cta?.label).toBeDefined();
  });

  test('400 on invalid JSON', async () => {
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u', studentId: 's', parentId: 'p' } }) }));
    jest.doMock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn().mockResolvedValue({ id: 's', freemiumUsage: null }), update: jest.fn() } } }));

    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json' as any });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('400 on invalid subject enum', async () => {
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u', studentId: 's', parentId: 'p' } }) }));
    jest.doMock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn().mockResolvedValue({ id: 's', freemiumUsage: null }), update: jest.fn() } } }));

    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'x', subject: 'INVALID' }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Requête invalide');
  });
});
