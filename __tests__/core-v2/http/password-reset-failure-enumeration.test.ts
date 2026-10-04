jest.mock('@/lib/core-v2/accounts/email-handoff-scheduler', () => ({ assertAccountEmailHandoffRuntimeConfiguration: jest.fn(), kickAccountEmailHandoffDrain: jest.fn() }));
jest.mock('@/lib/email/account-handoff-envelope', () => {
  const actual = jest.requireActual<typeof import('@/lib/email/account-handoff-envelope')>('@/lib/email/account-handoff-envelope');
  return { ...actual, sealAccountEmailHandoff: jest.fn(actual.sealAccountEmailHandoff) };
});
import { sealAccountEmailHandoff } from '@/lib/email/account-handoff-envelope';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { setupServiceHarness } from '../helpers/service-harness';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/email/core-v2-password-reset', () => ({ deliverCoreV2PasswordReset: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: {
  error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(),
} }));

import { deliverCoreV2PasswordReset } from '@/lib/email/core-v2-password-reset';
import { logger } from '@/lib/logger';
import { ACCOUNT_TOKEN_KEYS_ENV } from '@/lib/core-v2/account-token';
import { ConflictError } from '@/lib/core-v2/errors';
import { POST } from '@/app/api/v2/auth/password-reset/route';

const ephemeralRateLimitKey = randomBytes(32).toString('hex');
const syntheticAccountPassword = randomBytes(32).toString('hex');
process.env.RATE_LIMIT_BACKEND ??= 'memory';
process.env.RATE_LIMIT_KEY_SECRET = `${ephemeralRateLimitKey}`;
process.env.RATE_LIMIT_KEY_NAMESPACE = 'reset-failure-fixture';
process.env.RATE_LIMIT_TRUST_PROXY_HOPS = '1';
const h = setupServiceHarness();
let requestCounter = 0;

function request(email: string): NextRequest {
  requestCounter += 1;
  return new NextRequest('http://localhost:3000/api/v2/auth/password-reset', {
    method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json',
      'x-forwarded-for': `10.77.0.${requestCounter}`, 'x-correlation-id': 'synthetic-reset-correlation' },
    body: JSON.stringify({ email }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(sealAccountEmailHandoff).mockImplementation(jest.requireActual<typeof import('@/lib/email/account-handoff-envelope')>('@/lib/email/account-handoff-envelope').sealAccountEmailHandoff);
  jest.mocked(deliverCoreV2PasswordReset).mockReset();
  jest.mocked(deliverCoreV2PasswordReset).mockResolvedValue({ messageId: 'synthetic-outbox-message' });
});

test.each(['HYBRID', 'V2_ONLY'])('missing HMAC configuration does not enumerate an eligible account in %s', async mode => {
  const savedMode = process.env.CORE_V2_AUTH_MODE;
  const savedKeys = process.env[ACCOUNT_TOKEN_KEYS_ENV];
  const email = `active-missing-key-${mode.toLowerCase()}@synthetic.test`;
  await h.client.user.create({ data: { role: 'PARENT', email, accountStatus: 'ACTIVE',
    password: await bcrypt.hash(syntheticAccountPassword, 4), activatedAt: new Date('2026-10-01T00:00:00Z') } });
  try {
    process.env.CORE_V2_AUTH_MODE = mode;
    delete process.env[ACCOUNT_TOKEN_KEYS_ENV];
    const active = await POST(request(email));
    const absent = await POST(request(`absent-missing-key-${mode.toLowerCase()}@synthetic.test`));
    expect([active.status, absent.status]).toEqual([202, 202]);
    expect((await active.clone().json()).error?.code ?? 'accepted').toBe('accepted');
    expect(active.status).toBe(absent.status);
    expect(active.status).toBe(202);
    expect(await active.json()).toEqual(await absent.json());
    expect(active.headers.get('cache-control')).toBe(absent.headers.get('cache-control'));
    expect(await h.client.invitation.count()).toBe(0);
    expect(deliverCoreV2PasswordReset).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(JSON.stringify(jest.mocked(logger.error).mock.calls)).not.toContain('CORE_V2_ACCOUNT_TOKEN_KEYS_REQUIRED');
  } finally {
    if (savedMode === undefined) delete process.env.CORE_V2_AUTH_MODE;
    else process.env.CORE_V2_AUTH_MODE = savedMode;
    if (savedKeys === undefined) delete process.env[ACCOUNT_TOKEN_KEYS_ENV];
    else process.env[ACCOUNT_TOKEN_KEYS_ENV] = savedKeys;
  }
});

test.each(['handoff-unavailable', 'reset-conflict'])('an eligible-only %s failure is neutral and observable without a credential in logs', async kind => {
  const savedMode = process.env.CORE_V2_AUTH_MODE;
  process.env.CORE_V2_AUTH_MODE = 'V2_ONLY';
  const email = `active-${kind}@synthetic.test`;
  await h.client.user.create({ data: { role: 'PARENT', email, accountStatus: 'ACTIVE',
    password: await bcrypt.hash(syntheticAccountPassword, 4), activatedAt: new Date('2026-10-01T00:00:00Z') } });
  const marker = 'synthetic-private-error-marker';
  const error = kind === 'reset-conflict' ? new ConflictError(marker, { userId: 'synthetic-private-id' }) : new Error(marker);
  jest.mocked(sealAccountEmailHandoff).mockImplementationOnce(() => { throw error; });
  try {
    const active = await POST(request(email));
    const absent = await POST(request(`absent-${kind}@synthetic.test`));
    expect([active.status, absent.status]).toEqual([202, 202]);
    expect((await active.clone().json()).error?.code ?? 'accepted').toBe('accepted');
    expect(active.status).toBe(202);
    expect(absent.status).toBe(202);
    expect(await active.json()).toEqual(await absent.json());
    expect(logger.error).toHaveBeenCalledWith({ correlationId: 'synthetic-reset-correlation',
      event: 'PASSWORD_RESET_PROCESSING_FAILED' }, '[auth] password reset request processing failed');
    const logs = JSON.stringify(jest.mocked(logger.error).mock.calls);
    expect(logs).not.toContain(marker);
    expect(logs).not.toContain(email);
    for (const [input] of jest.mocked(sealAccountEmailHandoff).mock.calls) expect(logs).not.toContain(input.rawToken);
  } finally {
    if (savedMode === undefined) delete process.env.CORE_V2_AUTH_MODE;
    else process.env.CORE_V2_AUTH_MODE = savedMode;
  }
});
