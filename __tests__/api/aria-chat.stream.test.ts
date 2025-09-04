jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { NextRequest } from 'next/server';

describe('API /api/aria/chat streaming modes', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns SSE error when stream=true in service mode', async () => {
    // Arrange env -> service mode
    process.env.USE_LLM_SERVICE = '1';
    // Mock session and rate limit
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u1', studentId: 's1', parentId: 'p1' } }) }));
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    // Mock prisma
    jest.doMock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn().mockResolvedValue({ id: 's1', parentId: 'p1', freemiumUsage: null }), update: jest.fn() } } }));

    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat?stream=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Bonjour', subject: 'MATHEMATIQUES' }) });
    // Act
    const res = await POST(req as any);
    const text = await (res as any).text();
    // Assert
    expect(res.status).toBe(200);
    expect(text).toContain('event: error');
    expect(text).toContain('stream_not_available_in_service_mode');
    expect(text).toContain('event: done');
  });

  it('streams tokens when direct mode with mocked OpenAI', async () => {
    // Arrange env -> direct mode
    process.env.DIRECT_OPENAI_DEV = '1';
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.USE_LLM_SERVICE;
    process.env.OPENAI_TIMEOUT_MS = '5000';
    process.env.RETRIES = '0';

    // Mock OpenAI streaming
    jest.doMock('openai', () => ({
      __esModule: true,
      default: class OpenAI {
        chat = {
          completions: {
            create: async () => ({
              [Symbol.asyncIterator]() {
                let i = 0;
                return {
                  next: async () => {
                    if (i === 0) { i++; return { value: { choices: [{ delta: { content: 'A' } }] }, done: false }; }
                    if (i === 1) { i++; return { value: { choices: [{ delta: { content: 'B' } }] }, done: false }; }
                    return { value: undefined, done: true };
                  }
                } as AsyncIterator<any>;
              }
            }),
          }
        };
      }
    }));

    // Mock session, rate limit, prisma
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u1', studentId: 's1', parentId: 'p1' } }) }));
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    jest.doMock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn().mockResolvedValue({ id: 's1', parentId: 'p1', freemiumUsage: null }), update: jest.fn() } } }));

    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat?stream=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Bonjour', subject: 'MATHEMATIQUES' }) });
    const res = await POST(req as any);
    const text = await (res as any).text();

    expect(res.status).toBe(200);
    expect(text).toContain('event: token');
    expect(text).toContain('A');
    expect(text).toContain('B');
    expect(text).toContain('event: done');
  });
});
