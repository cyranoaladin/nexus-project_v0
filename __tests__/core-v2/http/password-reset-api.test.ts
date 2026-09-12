/**
 * Core v2 password reset (§AL/§AT) against a real Core v2 database, through
 * the services and the public routes: request → mail adapter (token never in
 * a response) → confirm sets the password and revokes sessions → replay
 * refused → preview semantics → enumeration-safe request → non-ACTIVE
 * accounts ineligible → expiry → the activation path refuses a reset token
 * and vice-versa → authority bridge delegates only CORE_V2 identities.
 */
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/email/core-v2-password-reset', () => ({
  deliverCoreV2PasswordReset: jest.fn(async () => ({ messageId: 'mocked' })),
}));

import { deliverCoreV2PasswordReset } from '@/lib/email/core-v2-password-reset';
import { requestPasswordResetByAuthority } from '@/lib/auth/password-reset-authority';
import { activateAccount, confirmPasswordReset, inspectInvitation, inspectPasswordReset, isSessionStillValid, requestPasswordReset, verifyCredentials } from '@/lib/core-v2/services';
import { setupServiceHarness } from '../helpers/service-harness';
import * as requestRoute from '@/app/api/v2/auth/password-reset/route';
import * as confirmRoute from '@/app/api/v2/auth/password-reset/confirm/route';

process.env.RATE_LIMIT_BACKEND ??= 'memory';
process.env.RATE_LIMIT_KEY_SECRET ??= 'change_me_rate_limit_key_secret_at_least_32_bytes';
process.env.RATE_LIMIT_KEY_NAMESPACE ??= 'core-v2-reset-test';
process.env.RATE_LIMIT_TRUST_PROXY_HOPS ??= '1';

const h = setupServiceHarness();
const mockedDeliver = deliverCoreV2PasswordReset as unknown as jest.Mock;

function req(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(response: Response) {
  return { status: response.status, body: await response.json() };
}

async function activeParent(email: string, password = 'change_me_old_password') {
  return h.client.user.create({
    data: { role: 'PARENT', email, firstName: 'Amel', lastName: 'Synthetic', accountStatus: 'ACTIVE', password: await bcrypt.hash(password, 4), activatedAt: new Date() },
  });
}

beforeEach(() => mockedDeliver.mockClear());

describe('services', () => {
  test('request → one open token, mail adapter gets the raw token once; confirm sets the password and revokes sessions; replay refused', async () => {
    const user = await activeParent('amel@synthetic.test');
    const issued = await requestPasswordReset(h.client, { email: 'Amel@Synthetic.test' });
    expect(issued).toMatchObject({ userId: user.id, email: 'amel@synthetic.test', displayName: 'Amel Synthetic' });
    expect(issued!.rawToken.length).toBeGreaterThanOrEqual(40);
    expect(await inspectPasswordReset(h.client, issued!.rawToken)).toBe(true);
    expect(await inspectInvitation(h.client, issued!.rawToken)).toBeNull(); // not an activation token

    // A second request replaces the first (one open reset per account).
    const second = await requestPasswordReset(h.client, { email: 'amel@synthetic.test' });
    expect(await inspectPasswordReset(h.client, issued!.rawToken)).toBe(false);
    expect(await h.client.invitation.count({ where: { userId: user.id, purpose: 'PASSWORD_RESET', revokedAt: null, consumedAt: null } })).toBe(1);

    const before = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    const updated = await confirmPasswordReset(h.client, { rawToken: second!.rawToken, newPassword: 'change_me_new_password' });
    expect(updated.sessionVersion).toBe(before.sessionVersion + 1);
    expect(await isSessionStillValid(h.client, { userId: user.id, role: 'PARENT', sessionVersion: before.sessionVersion })).toBe(false);
    expect(await verifyCredentials(h.client, { email: 'amel@synthetic.test', password: 'change_me_new_password' })).toMatchObject({ userId: user.id });
    expect(await verifyCredentials(h.client, { email: 'amel@synthetic.test', password: 'change_me_old_password' })).toBeNull();

    await expect(confirmPasswordReset(h.client, { rawToken: second!.rawToken, newPassword: 'change_me_again' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await expect(activateAccount(h.client, { rawToken: second!.rawToken, password: 'change_me_x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const actions = (await h.client.auditEvent.findMany({ where: { OR: [{ subjectId: user.id }, { subjectType: 'Invitation' }] }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(actions).toEqual(['account.password_reset_requested', 'account.password_reset_requested', 'account.password_reset']);
    expect(JSON.stringify(await h.client.auditEvent.findMany())).not.toContain(second!.rawToken);
  });

  test('only an ACTIVE account with a password is eligible; unknown e-mails and invalid addresses yield null, never an error', async () => {
    expect(await requestPasswordReset(h.client, { email: 'nobody@synthetic.test' })).toBeNull();
    expect(await requestPasswordReset(h.client, { email: 'not an email' })).toBeNull();
    const pending = await h.client.user.create({ data: { role: 'PARENT', email: 'pending@synthetic.test', accountStatus: 'PENDING_ACTIVATION' } });
    expect(await requestPasswordReset(h.client, { email: pending.email! })).toBeNull();
    const suspended = await activeParent('suspended@synthetic.test');
    await h.client.user.update({ where: { id: suspended.id }, data: { accountStatus: 'SUSPENDED' } });
    expect(await requestPasswordReset(h.client, { email: 'suspended@synthetic.test' })).toBeNull();
  });

  test('an expired token is refused and previews as invalid; a token of a meanwhile-suspended account is refused', async () => {
    await activeParent('amel@synthetic.test');
    const clock = { t: Date.parse('2026-09-12T10:00:00Z') };
    const now = () => new Date(clock.t);
    const issued = await requestPasswordReset(h.client, { email: 'amel@synthetic.test' }, { now });
    clock.t += 61 * 60_000; // TTL is 60 minutes in the harness
    expect(await inspectPasswordReset(h.client, issued!.rawToken, now)).toBe(false);
    await expect(confirmPasswordReset(h.client, { rawToken: issued!.rawToken, newPassword: 'change_me_new' }, { now })).rejects.toMatchObject({ code: 'INVALID_STATE' });

    const other = await activeParent('other@synthetic.test');
    const fresh = await requestPasswordReset(h.client, { email: 'other@synthetic.test' });
    await h.client.user.update({ where: { id: other.id }, data: { accountStatus: 'SUSPENDED' } });
    expect(await inspectPasswordReset(h.client, fresh!.rawToken)).toBe(false);
    await expect(confirmPasswordReset(h.client, { rawToken: fresh!.rawToken, newPassword: 'change_me_new' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});

describe('authority bridge', () => {
  test('a CORE_V2 identity is issued and mailed through Core v2; an unknown e-mail is V1 (left to the Core v1 flow); an ineligible Core v2 account is neither', async () => {
    await activeParent('amel@synthetic.test');
    expect(await requestPasswordResetByAuthority('amel@synthetic.test')).toBe('CORE_V2_ISSUED');
    expect(mockedDeliver).toHaveBeenCalledTimes(1);
    const delivery = mockedDeliver.mock.calls[0][0];
    expect(delivery).toMatchObject({ email: 'amel@synthetic.test', displayName: 'Amel Synthetic' });
    expect(delivery.rawToken.length).toBeGreaterThanOrEqual(40);
    expect(await requestPasswordResetByAuthority('stranger@synthetic.test')).toBe('V1');
    const pending = await h.client.user.create({ data: { role: 'PARENT', email: 'pending@synthetic.test', accountStatus: 'PENDING_ACTIVATION' } });
    expect(await requestPasswordResetByAuthority(pending.email!)).toBe('CORE_V2_NOT_ELIGIBLE');
    expect(mockedDeliver).toHaveBeenCalledTimes(1);
  });

  test('the rollout mode is the only switch: V1_ONLY never opens Core v2, V2_ONLY never falls back to Core v1', async () => {
    await activeParent('amel@synthetic.test');
    const saved = process.env.CORE_V2_AUTH_MODE;
    try {
      process.env.CORE_V2_AUTH_MODE = 'V1_ONLY';
      expect(await requestPasswordResetByAuthority('amel@synthetic.test')).toBe('V1');
      process.env.CORE_V2_AUTH_MODE = 'V2_ONLY';
      expect(await requestPasswordResetByAuthority('amel@synthetic.test')).toBe('CORE_V2_ISSUED');
      expect(await requestPasswordResetByAuthority('stranger@synthetic.test')).toBe('CORE_V2_NOT_ELIGIBLE'); // never 'V1'
    } finally {
      process.env.CORE_V2_AUTH_MODE = saved;
    }
  });
});

describe('public routes', () => {
  test('request always answers 202 accepted; confirm route enforces the envelope and the 404/409 pair; preview never consumes', async () => {
    const user = await activeParent('amel@synthetic.test');
    const accepted = await json(await requestRoute.POST(req('POST', '/api/v2/auth/password-reset', { email: 'AMEL@synthetic.test' })));
    expect(accepted.status).toBe(202);
    expect(accepted.body).toMatchObject({ ok: true, data: { accepted: true } });
    const unknown = await json(await requestRoute.POST(req('POST', '/api/v2/auth/password-reset', { email: 'nobody@synthetic.test' })));
    expect(unknown.status).toBe(202);
    expect(JSON.stringify(unknown.body)).toBe(JSON.stringify(accepted.body).replace(accepted.body.correlationId, unknown.body.correlationId));
    expect((await json(await requestRoute.POST(req('POST', '/api/v2/auth/password-reset', { email: 'x' })))).status).toBe(400);
    expect(mockedDeliver).toHaveBeenCalledTimes(1);
    const rawToken: string = mockedDeliver.mock.calls[0][0].rawToken;
    expect(JSON.stringify(accepted.body)).not.toContain(rawToken);

    const preview = await json(await confirmRoute.GET(new NextRequest(`http://localhost:3000/api/v2/auth/password-reset/confirm?token=${rawToken}`)));
    expect(preview.body.data).toEqual({ valid: true });
    expect((await json(await confirmRoute.GET(new NextRequest(`http://localhost:3000/api/v2/auth/password-reset/confirm?token=${'A'.repeat(43)}`)))).body.data).toEqual({ valid: false });

    expect((await json(await confirmRoute.POST(req('POST', '/x', { token: rawToken, newPassword: 'short' })))).status).toBe(400);
    const done = await json(await confirmRoute.POST(req('POST', '/x', { token: rawToken, newPassword: 'change_me_new_password' })));
    expect(done.status).toBe(200);
    expect(done.body.data.user).toMatchObject({ id: user.id, accountStatus: 'ACTIVE' });
    expect(done.body.data.user).not.toHaveProperty('password');
    expect((await json(await confirmRoute.POST(req('POST', '/x', { token: rawToken, newPassword: 'change_me_other' })))).status).toBe(409);
    expect((await json(await confirmRoute.POST(req('POST', '/x', { token: 'B'.repeat(43), newPassword: 'change_me_other' })))).status).toBe(404);
    expect(await verifyCredentials(h.client, { email: 'amel@synthetic.test', password: 'change_me_new_password' })).not.toBeNull();
  });
  // CSRF (same-origin) is enforced by lib/csrf.ts outside NODE_ENV=test; the disposable-stack E2E exercises it in production mode.
});
