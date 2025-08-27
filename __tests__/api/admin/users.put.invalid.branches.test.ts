jest.mock('@/lib/auth', () => ({ authOptions: {} }));

describe('Admin Users PUT invalid branches', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('415 when content-type not application/json', async () => {
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { role: 'ADMIN' } }) }));
    const { PUT } = require('@/app/api/admin/users/route');
    const req = { headers: new Map([['content-type', 'text/plain']]), text: async () => '' } as any;
    (req.headers as any).get = (k: string) => (k.toLowerCase() === 'content-type' ? 'text/plain' : null);
    const res = await PUT(req);
    expect(res.status).toBe(415);
  });

  it('400 when empty body', async () => {
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { role: 'ADMIN' } }) }));
    const { PUT } = require('@/app/api/admin/users/route');
    const req = { headers: new Map([['content-type', 'application/json']]), text: async () => '' } as any;
    (req.headers as any).get = (k: string) => 'application/json';
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('400 when malformed JSON', async () => {
    jest.doMock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue({ user: { role: 'ADMIN' } }) }));
    const { PUT } = require('@/app/api/admin/users/route');
    const req = { headers: new Map([['content-type', 'application/json']]), text: async () => '{bad' } as any;
    (req.headers as any).get = (k: string) => 'application/json';
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
