import { randomBytes } from 'node:crypto';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/core-v2/accounts/email-handoff-scheduler', () => ({
  assertAccountEmailHandoffRuntimeConfiguration: jest.fn(), kickAccountEmailHandoffDrain: jest.fn(),
}));
jest.mock('@/lib/email/core-v2-invitation', () => ({ deliverCoreV2Invitation: jest.fn(async () => { throw new Error('SYNTHETIC_V1_UNAVAILABLE'); }) }));
jest.mock('@/lib/email/core-v2-password-reset', () => ({ deliverCoreV2PasswordReset: jest.fn(async () => { throw new Error('SYNTHETIC_V1_UNAVAILABLE'); }) }));
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { kickAccountEmailHandoffDrain } from '@/lib/core-v2/accounts/email-handoff-scheduler';
import { deliverCoreV2Invitation } from '@/lib/email/core-v2-invitation';
import { deliverCoreV2PasswordReset } from '@/lib/email/core-v2-password-reset';
import { createHousehold } from '@/lib/core-v2/services';
import { setupServiceHarness } from '../helpers/service-harness';
import { POST as invite } from '@/app/api/v2/staff/accounts/[id]/invite/route';
import { POST as reset } from '@/app/api/v2/auth/password-reset/route';

const h = setupServiceHarness();
process.env.RATE_LIMIT_BACKEND ??= 'memory';
process.env.RATE_LIMIT_KEY_NAMESPACE ??= 'synthetic-handoff-route-test';
process.env.RATE_LIMIT_KEY_SECRET ??= 'synthetic_handoff_rate_limit_key_not_a_credential_32';
process.env.RATE_LIMIT_TRUST_PROXY_HOPS ??= '1';
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auth).mockResolvedValue({ user: { id: h.admin.userId, role: 'ADMIN', email: 'synthetic-handoff-admin@example.test' }, expires: '2099-01-01' } as Awaited<ReturnType<typeof auth>>);
});
function request(path: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('staff invitation is durably queued without depending on a live V1 transaction', async () => {
  const { parent } = await createHousehold(h.client, h.ctx(), { parent: { firstName: 'Synthetic', lastName: 'Route', email: 'synthetic-handoff-route@example.test' } });
  const response = await invite(request('/api/v2/staff/accounts/synthetic/invite'), { params: Promise.resolve({ id: parent.id }) });
  expect(response.status).toBe(201);
  const text = await response.text();
  expect(text.includes('rawToken')).toBe(false);
  expect(await h.client.coreV2JobOutbox.count({ where: { aggregateType: 'ACCOUNT_EMAIL_HANDOFF' } })).toBe(1);
  expect(deliverCoreV2Invitation).not.toHaveBeenCalled();
  expect(kickAccountEmailHandoffDrain).toHaveBeenCalledTimes(1);
});

test('public reset is durably queued and enumeration-safe when the V1 destination is down', async () => {
  const savedMode = process.env.CORE_V2_AUTH_MODE;
  process.env.CORE_V2_AUTH_MODE = 'V2_ONLY';
  try {
    await h.client.user.create({ data: { role: 'PARENT', email: 'synthetic-reset-route@example.test', accountStatus: 'ACTIVE', password: await bcrypt.hash(randomBytes(32).toString('base64url') + 'Aa1!', 4) } });
    const active = await reset(request('/api/v2/auth/password-reset', { email: 'synthetic-reset-route@example.test' }));
    const absent = await reset(request('/api/v2/auth/password-reset', { email: 'synthetic-absent-route@example.test' }));
    expect(active.status).toBe(202);
    expect(absent.status).toBe(202);
    expect(await active.text()).toBe(await absent.text());
    expect(await h.client.coreV2JobOutbox.count({ where: { aggregateType: 'ACCOUNT_EMAIL_HANDOFF' } })).toBe(1);
    expect(deliverCoreV2PasswordReset).not.toHaveBeenCalled();
    expect(kickAccountEmailHandoffDrain).toHaveBeenCalledTimes(1);
  } finally {
    if (savedMode === undefined) delete process.env.CORE_V2_AUTH_MODE; else process.env.CORE_V2_AUTH_MODE = savedMode;
  }
});
