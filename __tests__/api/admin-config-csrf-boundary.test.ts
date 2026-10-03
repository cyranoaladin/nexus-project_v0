import { NextRequest, NextResponse } from 'next/server';
const mockRequireRole = jest.fn();
const mockTransaction = jest.fn();
jest.mock('@/lib/guards', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  requireAnyRole: jest.fn(),
  isErrorResponse: (value: unknown) => value instanceof NextResponse,
}));
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: (...args: unknown[]) => mockTransaction(...args) } }));
import { PATCH } from '@/app/api/admin/config/route';
import { POST } from '@/app/api/admin/config/rollback/route';

const originalEnv = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...process.env, NODE_ENV: 'production' };
  delete process.env.NEXTAUTH_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  mockRequireRole.mockResolvedValue({ user: { id: 'synthetic-admin', role: 'ADMIN' } });
});
afterEach(() => { process.env = { ...originalEnv }; });

test.each([{ name: 'PATCH', handler: PATCH }, { name: 'rollback', handler: POST }])(
  '$name rejects a hostile origin before reading its body or writing configuration', async ({ name, handler }) => {
    const request = new NextRequest('https://nexusreussite.academy/api/admin/config', {
      method: name === 'PATCH' ? 'PATCH' : 'POST',
      headers: { origin: 'https://hostile.example', 'content-type': 'text/plain' },
      body: JSON.stringify({ namespace: 'unknown', key: 'unknown', value: 'synthetic' }),
    });
    const read = jest.spyOn(request, 'json');
    expect((await handler(request)).status).toBe(403);
    expect(read).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  },
);
test.each([PATCH, POST])('preserves the authentication refusal', async handler => {
  mockRequireRole.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  const request = new NextRequest('https://nexusreussite.academy/api/admin/config', { method: 'POST' });
  expect((await handler(request)).status).toBe(401);
  expect(mockTransaction).not.toHaveBeenCalled();
});
