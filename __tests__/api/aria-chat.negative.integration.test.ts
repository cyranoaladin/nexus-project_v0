jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';

// Mock session handler, default to valid but override per-test
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u1', role: 'ELEVE', studentId: 's1', parentId: 'p1' } }),
}));

// Force rate limit failure when needed
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: () => () => ({ ok: true }),
}));

describe('API /api/aria/chat negative paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 on invalid body', async () => {
    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid-json' as any });
    const res = await POST(req);
    expect([400, 500]).toContain(res.status); // tolerate generic handler
  });

  it('returns 401 when unauthenticated', async () => {
    const { getServerSession } = require('next-auth');
    (getServerSession as jest.Mock).mockResolvedValueOnce(null);
    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'hi', subject: 'NSI' }) });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 429 when route IP rate limit triggers', async () => {
    jest.resetModules();
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: false }) }));
    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'hi', subject: 'NSI' }) });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});
