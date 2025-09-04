/** @jest-environment node */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(async () => ({ user: { id: 'u1', studentId: 's1', parentId: 'p1' } })),
}));

describe('POST /api/aria/chat (E2E stub)', () => {
  const OLD = process.env.E2E;
  beforeAll(() => { process.env.E2E = '1'; });
  afterAll(() => { if (OLD !== undefined) process.env.E2E = OLD; });
  let POST: any;
  beforeAll(async () => {
    const mod = await import('@/app/api/aria/chat/route');
    POST = mod.POST;
  });

  it('returns stubbed reply', async () => {
    const req = { headers: new Headers(), json: async () => ({ studentId: 's1', message: 'bonjour' }) } as any;
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
