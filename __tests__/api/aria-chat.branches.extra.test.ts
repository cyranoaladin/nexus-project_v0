jest.mock('@/lib/auth', () => ({ authOptions: {} }));

describe('ARIA chat quota reset branch', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('resets usage when new day and sets to 1', async () => {
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { id: 'u1', studentId: 's1', parentId: 'p1' } }) }));
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ ok: true }) }));
    const fakePrisma = {
      student: {
        findUnique: jest.fn().mockResolvedValue({ id: 's1', freemiumUsage: { date: '1970-01-01', requestsToday: 5 } }),
        update: jest.fn().mockResolvedValue({}),
      }
    } as any;
    jest.doMock('@/lib/prisma', () => ({ prisma: fakePrisma }));
    jest.doMock('@/lib/aria/orchestrator', () => ({ AriaOrchestrator: class { async handleQuery() { return { response: 'ok' }; } } }));
    const { POST } = require('@/app/api/aria/chat/route');
    const body = JSON.stringify({ message: 'hello', subject: 'MATHEMATIQUES' });
    const req = new (require('next/server').NextRequest)('http://localhost/api/aria/chat', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const arg = fakePrisma.student.update.mock.calls[0][0];
    expect(arg.data.freemiumUsage.requestsToday).toBe(1);
  });
});
