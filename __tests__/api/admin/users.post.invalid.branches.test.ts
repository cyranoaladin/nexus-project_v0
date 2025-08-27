jest.mock('@/lib/auth', () => ({ authOptions: {} }));

describe('Admin Users POST invalid branches', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('415 when content-type is not application/json', async () => {
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { role: 'ADMIN' } }) }));
    const { POST } = require('@/app/api/admin/users/route');
    const req = { headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'text/plain' : null) } } as any;
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  it('400 when JSON body is malformed', async () => {
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { role: 'ADMIN' } }) }));
    const { POST } = require('@/app/api/admin/users/route');
    const req = { headers: { get: () => 'application/json' }, json: async () => { throw new Error('bad'); } } as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
