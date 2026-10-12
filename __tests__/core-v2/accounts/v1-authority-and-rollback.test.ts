/**
 * D2: under V1_ONLY Core v2 holds no credential authority at all, the staff
 * routes and the scheduler run the V1 saga, and taking Core away (outage or
 * gate rollback) leaves Core v1 fully operational and the saga resumable.
 */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/core-v2/accounts/email-handoff-scheduler', () => ({
  ...jest.requireActual('@/lib/core-v2/accounts/email-handoff-scheduler'),
  kickAccountEmailHandoffDrain: jest.fn(),
}));
import { NextRequest } from 'next/server';
import { Client } from 'pg';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  assertAccountEmailHandoffRuntimeConfiguration,
  kickAccountEmailHandoffDrain,
  startAccountEmailHandoffScheduler,
  stopAccountEmailHandoffScheduler,
} from '@/lib/core-v2/accounts/email-handoff-scheduler';
import {
  activateAccount, changePassword, confirmPasswordReset, inviteAccount,
  requestAccountInvitation, requestPasswordReset, resendInvitation,
} from '@/lib/core-v2/services';
import { assertAccountInvitationRuntimeConfiguration } from '@/lib/core-v2/accounts/invitation-runtime';
import { POST as inviteRoute } from '@/app/api/v2/staff/accounts/[id]/invite/route';
import { POST as resendRoute } from '@/app/api/v2/staff/accounts/[id]/resend-invitation/route';
import { POST as coreActivateRoute } from '@/app/api/v2/auth/activate/route';
import { activationLink, newPassword, setupV1Fixture } from '../helpers/v1-provisioning-fixture';

const f = setupV1Fixture();
const { h } = f;
const actualScheduler = jest.requireActual('@/lib/core-v2/accounts/email-handoff-scheduler') as typeof import('@/lib/core-v2/accounts/email-handoff-scheduler');
const CORE_URL = process.env.CORE_V2_DATABASE_URL;

beforeEach(() => {
  jest.mocked(kickAccountEmailHandoffDrain).mockClear();
  jest.mocked(auth).mockResolvedValue({
    user: { id: h.admin.userId, role: 'ADMIN', email: 'synthetic-d2-admin@example.test' }, expires: '2099-01-01',
  } as Awaited<ReturnType<typeof auth>>);
});
afterEach(async () => {
  process.env.CORE_V2_DATABASE_URL = CORE_URL;
  await stopAccountEmailHandoffScheduler();
});

function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', 'x-forwarded-for': '10.7.0.1', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('Core v2 never receives a credential under V1_ONLY', () => {
  test('every Core function that would persist a password, hash or raw token refuses before doing anything', async () => {
    const core = await f.coreUser('PARENT', 'refuses');
    const refusal = /CORE_CREDENTIAL_WRITE_DISABLED_V1_ONLY/;
    await expect(inviteAccount(h.client, h.ctx(), core.id)).rejects.toThrow(refusal);
    await expect(resendInvitation(h.client, h.ctx(), core.id)).rejects.toThrow(refusal);
    await expect(activateAccount(h.client, { rawToken: 'x'.repeat(32), password: newPassword() })).rejects.toThrow(refusal);
    await expect(confirmPasswordReset(h.client, { rawToken: 'x'.repeat(32), newPassword: newPassword() })).rejects.toThrow(refusal);
    await expect(requestPasswordReset(h.client, { email: core.email as string })).rejects.toThrow(refusal);
    await expect(changePassword(h.client, h.ctx(), { currentPassword: 'x', newPassword: newPassword() })).rejects.toThrow(refusal);

    expect(await h.client.invitation.count()).toBe(0);
    expect(await h.client.coreV2JobOutbox.count()).toBe(0);
    expect(await h.client.user.count({ where: { password: { not: null } } })).toBe(0);
    expect((await h.client.user.findUniqueOrThrow({ where: { id: core.id } })).accountStatus).toBe('PENDING_ACTIVATION');
  });

  test('the Core public activation route cannot be used to plant a credential', async () => {
    const core = await f.coreUser('ASSISTANTE', 'route-refuses');
    const response = await coreActivateRoute(post('/api/v2/auth/activate', { token: 'x'.repeat(40), password: newPassword() }));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await h.client.user.count({ where: { password: { not: null } } })).toBe(0);
    expect((await h.client.user.findUniqueOrThrow({ where: { id: core.id } })).accountStatus).toBe('PENDING_ACTIVATION');
  });

  test('outside V1_ONLY the Core invitation is unchanged (HYBRID still seals a Core handoff)', async () => {
    process.env.CORE_V2_AUTH_MODE = 'HYBRID';
    const core = await f.coreUser('PARENT', 'hybrid-unchanged');
    const requested = await requestAccountInvitation(h.client, h.ctx(), core.id);
    expect(requested.authority).toBe('CORE_V2');
    expect(await h.client.invitation.count()).toBe(1);
    expect(await h.client.accountV1Provisioning.count()).toBe(0);
    expect(await h.client.coreV2JobOutbox.count({ where: { aggregateType: 'ACCOUNT_EMAIL_HANDOFF' } })).toBe(1);
  });
});

describe('the staff API under V1_ONLY', () => {
  test('invite and resend queue the saga; no proof reaches the client', async () => {
    const core = await f.coreUser('COACH', 'api-invite');
    const invited = await inviteRoute(post('/x'), { params: Promise.resolve({ id: core.id }) });
    expect(invited.status).toBe(201);
    const body = await invited.text();
    expect(body).not.toMatch(/token|password|hash/i);
    expect(JSON.parse(body).data.invitation.deliveryStatus).toBe('QUEUED');
    expect(kickAccountEmailHandoffDrain).toHaveBeenCalledTimes(1);
    expect(await h.client.invitation.count()).toBe(0);

    const again = await inviteRoute(post('/x'), { params: Promise.resolve({ id: core.id }) });
    expect(again.status).toBeGreaterThanOrEqual(400); // already in flight: use resend

    const resent = await resendRoute(post('/x', undefined, { 'idempotency-key': '00000000-0000-4000-8000-000000000001' }), { params: Promise.resolve({ id: core.id }) });
    expect(resent.status).toBe(201);
    expect((await f.saga(core.id)).generation).toBe(2);
  });

  test('a signed-in actor without the capability is refused and nothing is queued', async () => {
    const core = await f.coreUser('COACH', 'api-forbidden');
    jest.mocked(auth).mockResolvedValue({
      user: { id: h.parentActor.userId, role: 'PARENT', email: 'outsider-parent@synthetic.test' }, expires: '2099-01-01',
    } as Awaited<ReturnType<typeof auth>>);
    const response = await inviteRoute(post('/x'), { params: Promise.resolve({ id: core.id }) });
    expect(response.status).toBe(403);
    expect(await h.client.accountV1Provisioning.count()).toBe(0);
    expect(await h.client.coreV2JobOutbox.count()).toBe(0);
  });
});

describe('the runtime availability check replaces the blanket refusal', () => {
  test('passes when Core, the v1 mail outbox and the public origin are all configured', () => {
    expect(() => assertAccountInvitationRuntimeConfiguration()).not.toThrow();
  });

  test('the Core-credential handoff check keeps refusing under V1_ONLY (the first-administrator CLI relies on it)', () => {
    expect(() => assertAccountEmailHandoffRuntimeConfiguration()).toThrow('ACCOUNT_EMAIL_CORE_AUTH_DISABLED');
  });

  test.each([
    ['CORE_V2_DATABASE_URL', undefined, 'ACCOUNT_V1_PROVISIONING_CORE_UNAVAILABLE'],
    ['EMAIL_OUTBOX_ENCRYPTION_KEY', 'short', 'ACCOUNT_V1_PROVISIONING_EMAIL_UNCONFIGURED'],
    ['NEXTAUTH_URL', 'http://not-local.example.org', 'ACCOUNT_V1_PROVISIONING_ORIGIN_INVALID'],
  ])('refuses up front when %s is missing or unusable', (name, value, code) => {
    const saved = process.env[name];
    try {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
      expect(() => assertAccountInvitationRuntimeConfiguration()).toThrow(code);
    } finally {
      // `process.env[x] = undefined` écrit la CHAÎNE "undefined" ; il ne
      // supprime pas la variable. La lane tourne à un seul worker, donc cette
      // valeur polluait les fichiers suivants sans aucun signal.
      if (saved === undefined) delete process.env[name]; else process.env[name] = saved;
    }
  });

  test('a V1-only deployment without any Core database starts nothing and fails nothing', async () => {
    delete process.env.CORE_V2_DATABASE_URL;
    await expect(startAccountEmailHandoffScheduler()).resolves.toBeUndefined();
    actualScheduler.kickAccountEmailHandoffDrain();
    const state = (globalThis as { __accountEmailHandoffScheduler?: { timer?: unknown; draining?: unknown } }).__accountEmailHandoffScheduler;
    expect(state?.timer).toBeUndefined();
    expect(state?.draining).toBeUndefined();
  });

  test('the production scheduler drives a request to SENT by itself', async () => {
    const core = await f.coreUser('ASSISTANTE', 'scheduler-drive');
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    await startAccountEmailHandoffScheduler();
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && (await f.saga(core.id)).state !== 'SENT') {
      await new Promise((resolve) => setTimeout(resolve, 100));
      actualScheduler.kickAccountEmailHandoffDrain();
    }
    await stopAccountEmailHandoffScheduler();
    expect((await f.saga(core.id)).state).toBe('SENT');
    expect(await f.v1InvitationMailCount()).toBe(1);
  });
});

/** Nom de la base Core derive de l'URL reelle : coder un nom en dur ciblait la
 *  base propre a l'environnement de developpement d'origine. */
function coreDatabaseName(): string {
  const raw = process.env.CORE_V2_DATABASE_URL;
  if (!raw) throw new Error('CORE_V2_DATABASE_URL is required');
  const name = new URL(raw).pathname.replace(/^\//, '');
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`UNSAFE_DATABASE_NAME:${name}`);
  return name;
}


describe('Core taken away: V1 stays fully operational and the saga resumes', () => {
  async function setCoreAvailability(allowed: boolean) {
    const admin = new Client({ connectionString: process.env.CORE_V2_IDENTITY_TEST_ADMIN_URL });
    await admin.connect();
    try {
      await admin.query(`ALTER DATABASE "${coreDatabaseName()}" ALLOW_CONNECTIONS ${allowed ? 'true' : 'false'}`);
      if (!allowed) {
        await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${coreDatabaseName()}' AND pid <> pg_backend_pid()`);
      }
    } finally {
      await admin.end();
    }
  }

  test('with the Core database refusing connections, activation and login still work; on return Core catches up', async () => {
    const core = await f.coreUser('PARENT', 'core-outage');
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    await f.settle();
    await f.deliverMail();
    const link = activationLink(f.mailbox[0]);
    const password = newPassword();

    await setCoreAvailability(false);
    const savedUrl = process.env.CORE_V2_DATABASE_URL;
    delete process.env.CORE_V2_DATABASE_URL; // the gate is off as well as the server
    try {
      await expect(h.client.$queryRaw`SELECT 1`).rejects.toThrow();
      expect((await f.verifyLink(link)).body).toMatchObject({ valid: true });
      expect((await f.activate(link, password)).status).toBe(200);
      expect((await f.loginChain(core.email as string, password)).ok).toBe(true);
      expect((await f.loginChain(core.email as string, `${password}x`)).ok).toBe(false);
      // The worker cannot run: it must fail and wait, never invent progress.
      await expect(f.run()).rejects.toThrow();
    } finally {
      process.env.CORE_V2_DATABASE_URL = savedUrl;
      await setCoreAvailability(true);
    }

    // Connections killed during the outage are replaced one failure at a time: warm the whole pool.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const probes = await Promise.allSettled(Array.from({ length: 12 }, () => h.client.$queryRaw`SELECT 1`));
      if (probes.every((probe) => probe.status === 'fulfilled')) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect((await f.saga(core.id)).state).toBe('SENT'); // Core never saw the activation while it was away
    await f.settle();
    expect((await f.saga(core.id)).state).toBe('CORE_PROVISIONED');
    expect((await h.client.user.findUniqueOrThrow({ where: { id: core.id } })).accountStatus).toBe('ACTIVE');
    expect((await f.loginChain(core.email as string, password)).ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: core.id } })).activatedAt).not.toBeNull();
  });
});
