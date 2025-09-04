jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import { NextRequest } from 'next/server';

describe('API /api/aria/chat - dev-token, E2E fallback, SSE retry', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('dev-token bypass: uses first student and returns JSON response', async () => {
    // Arrange mocks
    jest.doMock('@/lib/api/auth', () => ({ getAuthFromRequest: jest.fn().mockResolvedValue({ via: 'dev-token' }) }));
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn() }));
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    const fakePrisma = {
      student: {
        findFirst: jest.fn().mockResolvedValue({ id: 's1', parentId: 'p1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 's1', freemiumUsage: null }),
        update: jest.fn().mockResolvedValue({ id: 's1', freemiumUsage: { requestsToday: 1, date: new Date().toISOString().split('T')[0] } }),
      },
    } as any;
    jest.doMock('@/lib/prisma', () => ({ prisma: fakePrisma }));
    jest.doMock('@/lib/aria/orchestrator', () => ({ AriaOrchestrator: class { constructor() {} async handleQuery() { return { response: 'ok', documentUrl: undefined }; } } }));

    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Hi', subject: 'MATHEMATIQUES' }) });

    // Act
    const res = await POST(req);
    const json = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(json.response).toBe('ok');
    expect(fakePrisma.student.findFirst).toHaveBeenCalled();
    expect(fakePrisma.student.findUnique).toHaveBeenCalled();
    expect(fakePrisma.student.update).toHaveBeenCalled();
  });

  it('E2E fallback: builds fake session from first student when E2E=1 and ARIA_LIVE!=1', async () => {
    process.env.E2E = '1';
    delete process.env.ARIA_LIVE; // ensure not live
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u1' } }) }));
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    const fakePrisma = {
      student: {
        findFirst: jest.fn().mockResolvedValue({ id: 's-e2e', parentId: 'p-e2e' }),
        findUnique: jest.fn().mockResolvedValue({ id: 's-e2e', freemiumUsage: null }),
        update: jest.fn().mockResolvedValue({ id: 's-e2e', freemiumUsage: { requestsToday: 1, date: new Date().toISOString().split('T')[0] } }),
      },
    } as any;
    jest.doMock('@/lib/prisma', () => ({ prisma: fakePrisma }));
    jest.doMock('@/lib/aria/orchestrator', () => ({ AriaOrchestrator: class { async handleQuery() { return { response: 'ok-e2e' }; } } }));

    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'E2E', subject: 'MATHEMATIQUES' }) });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.response).toBe('ok-e2e');
    expect(fakePrisma.student.findFirst).toHaveBeenCalled();
    expect(fakePrisma.student.findUnique).toHaveBeenCalled();
    expect(fakePrisma.student.update).toHaveBeenCalled();
  });

  it('SSE retry: first OpenAI stream fails then succeeds (RETRIES=1)', async () => {
    process.env.DIRECT_OPENAI_DEV = '1';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.OPENAI_TIMEOUT_MS = '5000';
    process.env.RETRIES = '1';
    delete process.env.USE_LLM_SERVICE;
    delete process.env.ARIA_LIVE;

    // State to simulate first failure then success
    let attempts = 0;
    jest.doMock('openai', () => ({
      __esModule: true,
      default: class OpenAI {
        chat = { completions: { create: async () => {
          if (attempts === 0) { attempts++; throw new Error('upstream fail'); }
          // success path: return async iterator of tokens
          return {
            [Symbol.asyncIterator]() {
              let i = 0;
              return {
                next: async () => {
                  if (i === 0) { i++; return { value: { choices: [{ delta: { content: 'X' } }] }, done: false }; }
                  if (i === 1) { i++; return { value: { choices: [{ delta: { content: 'Y' } }] }, done: false }; }
                  return { value: undefined, done: true };
                }
              } as AsyncIterator<any>;
            }
          };
        } } };
      }
    }));

    jest.doMock('@/lib/api/auth', () => ({ getAuthFromRequest: jest.fn().mockResolvedValue(null) }));
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u1', studentId: 's1', parentId: 'p1' } }) }));
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    const fakePrisma = { student: { findUnique: jest.fn().mockResolvedValue({ id: 's1', parentId: 'p1', freemiumUsage: null }), update: jest.fn() } } as any;
    jest.doMock('@/lib/prisma', () => ({ prisma: fakePrisma }));

    const { POST } = require('@/app/api/aria/chat/route');
    const req = new NextRequest('http://localhost/api/aria/chat?stream=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Retry me', subject: 'MATHEMATIQUES' }) });
    const res = await POST(req);
    const text = await (res as any).text();

    expect(res.status).toBe(200);
    expect(text).toContain('event: token');
    expect(text).toContain('X');
    expect(text).toContain('Y');
    expect(text).toContain('event: done');
    expect(attempts).toBe(1);
  });
});
