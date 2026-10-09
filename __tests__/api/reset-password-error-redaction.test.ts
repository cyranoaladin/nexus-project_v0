import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/reset-password/route';
import { requestPasswordResetByAuthority } from '@/lib/auth/password-reset-authority';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'node:crypto';
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/auth/password-reset-authority', () => ({
  requestPasswordResetByAuthority: jest.fn().mockResolvedValue('V1'), canApplyV1CredentialProof: jest.fn(),
}));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
const originalEnv = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null);
  (requestPasswordResetByAuthority as jest.Mock).mockResolvedValue('V1');
  process.env = { ...process.env, NODE_ENV: 'production', NEXTAUTH_URL: 'https://nexusreussite.academy' };
});
it('contains a rejected confirmation database read inside the public error boundary', async () => {
  const error = new Error('SYNTHETIC_PRIVATE_CONFIRMATION_DETAIL');
  (prisma.user.findUnique as jest.Mock).mockRejectedValue(error);
  const token = `${Buffer.from(JSON.stringify({ userId: 'synthetic-user' })).toString('base64url')}.synthetic-signature`;
  const input = new NextRequest('https://nexusreussite.academy/api/auth/reset-password', {
    method: 'POST', headers: { origin: 'https://nexusreussite.academy' },
    body: JSON.stringify({ token, newPassword: `${randomBytes(32).toString('base64url')}Aa1!` }),
  });
  const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = await POST(input);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(error.message);
    expect(logger).toHaveBeenCalledWith('PASSWORD_RESET_REQUEST_FAILED');
    expect(JSON.stringify(logger.mock.calls)).not.toContain(error.message);
  } finally { logger.mockRestore(); }
});
afterEach(() => { process.env = { ...originalEnv }; });
function request() {
  return new NextRequest('https://nexusreussite.academy/api/auth/reset-password', {
    method: 'POST', headers: { origin: 'https://nexusreussite.academy' },
    body: JSON.stringify({ email: 'synthetic@example.test' }),
  });
}
it.each(['boundary', 'authority'])('redacts %s failure details while retaining the public error contract', async phase => {
  const error = new Error('SYNTHETIC_PRIVATE_EXCEPTION_DETAIL');
  const input = request();
  if (phase === 'boundary') (guardSensitiveRateLimit as jest.Mock).mockRejectedValueOnce(error);
  else (requestPasswordResetByAuthority as jest.Mock).mockRejectedValue(error);
  const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = await POST(input);
    expect(response.status).toBe(phase === 'boundary' ? 500 : 200);
    const body = await response.json();
    if (phase === 'authority') expect(body.success).toBe(true);
    expect(JSON.stringify(body)).not.toContain(error.message);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(error.message);
    expect(logger).toHaveBeenCalledWith(phase === 'boundary' ? 'PASSWORD_RESET_REQUEST_FAILED' : 'PASSWORD_RESET_DISPATCH_FAILED');
  } finally { logger.mockRestore(); }
});
