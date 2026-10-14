/**
 * D2: the saga REQUESTED -> V1_ISSUE_PENDING -> SENT -> V1_ACTIVATED ->
 * CORE_PROVISIONED is idempotent and resumable at every boundary, and a failure
 * on either side never damages the credential Core v1 owns.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { issueSessionToken } from '@/lib/auth/session-claims';
import { revokeAllUserSessions, validateSessionToken } from '@/lib/auth/session-revocation';
import { inspectV1Account, issueV1AccountInvitation } from '@/lib/auth/v1-account-invitation';
import { defaultV1Gateway, type V1Gateway } from '@/lib/core-v2/accounts/v1-provisioning-worker';
import { InvalidStateError } from '@/lib/core-v2/errors';
import { disableAccount, requestAccountInvitation, requestAccountInvitationResend } from '@/lib/core-v2/services';
import { activationLink, newPassword, setupV1Fixture, type Role } from '../helpers/v1-provisioning-fixture';
import { decryptEmailIntent } from '@/lib/email/outbox';
import type { InvitationBinding } from '@/lib/core-v2/accounts/invitation-scope';
import type { User } from '@/core-v2/generated/client';

const f = setupV1Fixture();
const { h } = f;
const DAY = 86_400_000;
async function authoritativeTarget(core: User) {
  const saga = await h.client.accountV1Provisioning.findUniqueOrThrow({ where: { userId: core.id } });
  const binding = saga.invitationBinding as unknown as InvitationBinding;
  return { coreUserId: core.id, email: core.email!, role: core.role, firstName: null, lastName: null, phone: null,
    generation: saga.generation, authority: { issuerId: binding.scope.issuerId, issuerVersion: binding.v1IssuerVersion!,
      bindingDigest: binding.fingerprint, databaseIdentity: binding.scope.databaseIdentity, operation: binding.scope.operation } };
}

async function invitedAndDelivered(role: Role, label: string) {
  const core = await f.coreUser(role, label);
  await requestAccountInvitation(h.client, h.ctx(), core.id);
  await f.settle();
  await f.deliverMail();
  return { core, link: activationLink(f.mailbox[f.mailbox.length - 1]) };
}

function withFault(fault: { crashAfterIssue?: boolean; inspectFails?: boolean }): V1Gateway {
  return {
    ...defaultV1Gateway,
    async issue(target, now) {
      const outcome = await defaultV1Gateway.issue(target, now);
      if (fault.crashAfterIssue) throw new Error('SYNTHETIC_CRASH_AFTER_V1_COMMIT');
      return outcome;
    },
    async inspect(target) {
      if (fault.inspectFails) throw new Error('SYNTHETIC_V1_UNREACHABLE');
      return defaultV1Gateway.inspect(target);
    },
  };
}

async function blockCoreActivation() {
  await h.client.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION d2_block_activation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD."accountStatus" = 'PENDING_ACTIVATION' AND NEW."accountStatus" = 'ACTIVE' THEN
        RAISE EXCEPTION 'D2_SYNTHETIC_CORE_FAILURE';
      END IF;
      RETURN NEW;
    END $$`);
  await h.client.$executeRawUnsafe('DROP TRIGGER IF EXISTS d2_block_activation ON "users"');
  await h.client.$executeRawUnsafe('CREATE TRIGGER d2_block_activation BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION d2_block_activation()');
}
async function unblockCoreActivation() {
  await h.client.$executeRawUnsafe('DROP TRIGGER IF EXISTS d2_block_activation ON "users"');
}
afterEach(unblockCoreActivation);

describe('double click and concurrency', () => {
  test('two simultaneous invitations: exactly one is accepted', async () => {
    const core = await f.coreUser('ASSISTANTE', 'double-invite');
    const results = await Promise.allSettled([
      requestAccountInvitation(h.client, h.ctx(), core.id),
      requestAccountInvitation(h.client, h.ctx(), core.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const refused = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(refused.reason).toBeInstanceOf(InvalidStateError);
    expect(await h.client.coreV2JobOutbox.count()).toBe(1);
  });

  test('two simultaneous resends: the last generation wins and exactly one link works', async () => {
    const { core } = await invitedAndDelivered('COACH', 'double-resend');
    const first = activationLink(f.mailbox[0]);
    const results = await Promise.allSettled([
      requestAccountInvitationResend(h.client, h.ctx(), core.id),
      requestAccountInvitationResend(h.client, h.ctx(), core.id),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    await f.settle();
    await f.deliverMail();
    expect((await f.saga(core.id)).generation).toBe(3);

    const links = f.mailbox.map(activationLink);
    const valid: number[] = [];
    for (const [index, link] of links.entries()) {
      if (((await f.verifyLink(link)).body as { valid?: boolean }).valid) valid.push(index);
    }
    expect(valid).toHaveLength(1);
    expect(valid[0]).toBe(links.length - 1);
    expect(((await f.verifyLink(first)).body as { valid?: boolean }).valid).toBe(false);
  });

  test('the same generation issued twice at once creates one account, one token, one mail', async () => {
    const core = await f.coreUser('PARENT', 'concurrent-issue');
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    const target = await authoritativeTarget(core);
    const outcomes = await Promise.allSettled([issueV1AccountInvitation(target), issueV1AccountInvitation(target)]);
    const fulfilled = outcomes.flatMap((o) => (o.status === 'fulfilled' ? [o.value] : []));
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.filter((o) => o.outcome === 'INVITED' && !o.replayed)).toHaveLength(1);
    expect(await prisma.user.count({ where: { id: core.id } })).toBe(1);
    expect(await f.v1InvitationMailCount()).toBe(1);
  });

  test('an older generation can never overwrite a newer token', async () => {
    const core = await f.coreUser('ASSISTANTE', 'stale-generation');
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    const oldTarget = await authoritativeTarget(core);
    await requestAccountInvitationResend(h.client, h.ctx(), core.id); // generation 2 before the worker ever ran
    await f.settle();
    await f.deliverMail();
    expect(f.mailbox).toHaveLength(1); // generation 1 was superseded before it issued anything

    const before = await f.snapshotV1(core.id);
    const stale = await issueV1AccountInvitation(oldTarget);
    expect(stale).toEqual({ outcome: 'REFUSED', code: 'V1_GENERATION_STALE' });
    expect(await f.snapshotV1(core.id)).toEqual(before);
  });

  test('an Idempotency-Key replay returns the same request and does not start another generation', async () => {
    const { core } = await invitedAndDelivered('ASSISTANTE', 'command-replay');
    const commandId = '6f1d8c52-3b0a-4d6e-9a41-2c7f5e8b9d10';
    const first = await requestAccountInvitationResend(h.client, h.ctx(), core.id, { commandId });
    const again = await requestAccountInvitationResend(h.client, h.ctx(), core.id, { commandId });
    expect(again.handoffId).toBe(first.handoffId);
    expect((await f.saga(core.id)).generation).toBe(2);
    expect(await h.client.coreV2JobOutbox.count({ where: { aggregateId: core.id } })).toBe(2);
  });
});

describe('crash and recovery at every boundary', () => {
  test('crash after the v1 commit and before the Core acknowledgement: replay, no second token, no second mail', async () => {
    const core = await f.coreUser('PARENT', 'crash-after-v1');
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    await f.run({ gateway: withFault({ crashAfterIssue: true }) });

    // v1 committed; Core never heard. The saga is parked at the boundary, the job waits to retry.
    expect((await f.saga(core.id)).state).toBe('V1_ISSUE_PENDING');
    const pending = await prisma.user.findUniqueOrThrow({ where: { id: core.id } });
    expect(pending.activationToken).not.toBeNull();
    expect(await f.v1InvitationMailCount()).toBe(1);
    const job = await h.client.coreV2JobOutbox.findFirstOrThrow({ where: { aggregateId: core.id } });
    expect(job).toMatchObject({ status: 'RETRY_SCHEDULED', attemptCount: 1, lastError: 'SYNTHETIC_CRASH_AFTER_V1_COMMIT' });

    f.clock.advance(60_000);
    await f.settle();
    expect(await f.saga(core.id)).toMatchObject({ state: 'SENT', v1UserId: core.id });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: core.id } });
    expect(after.activationToken).toBe(pending.activationToken); // replayed, not rotated
    expect(await f.v1InvitationMailCount()).toBe(1);
    await f.deliverMail();
    expect(f.mailbox).toHaveLength(1);
  });

  test('crash after v1 activation and before Core provisioning: resumes from V1_ACTIVATED', async () => {
    const { core, link } = await invitedAndDelivered('ASSISTANTE', 'crash-before-provision');
    const password = newPassword();
    expect((await f.activate(link, password)).status).toBe(200);
    await f.run({ gateway: withFault({ inspectFails: true }) });
    expect(['SENT', 'V1_ACTIVATED']).toContain((await f.saga(core.id)).state);
    expect((await h.client.user.findUniqueOrThrow({ where: { id: core.id } })).accountStatus).toBe('PENDING_ACTIVATION');

    f.clock.advance(60_000);
    await f.settle();
    expect((await f.saga(core.id)).state).toBe('CORE_PROVISIONED');
    expect((await f.loginChain(core.email as string, password)).ok).toBe(true);
  });

  test('a Core failure after v1 activation yields PROVISIONING_RETRY and never touches the v1 account', async () => {
    const { core, link } = await invitedAndDelivered('COACH', 'core-failure');
    const password = newPassword();
    expect((await f.activate(link, password)).status).toBe(200);
    const activated = await f.snapshotV1(core.id);

    await blockCoreActivation();
    await f.settle();
    expect(await f.saga(core.id)).toMatchObject({ state: 'PROVISIONING_RETRY', lastErrorCode: 'CORE_PROVISIONING_FAILED' });
    expect((await h.client.user.findUniqueOrThrow({ where: { id: core.id } })).accountStatus).toBe('PENDING_ACTIVATION');
    const job = await h.client.coreV2JobOutbox.findFirstOrThrow({ where: { aggregateId: core.id } });
    expect(job.status).toBe('RETRY_SCHEDULED');
    expect(job.attemptCount).toBeGreaterThanOrEqual(1);
    // The v1 account is intact and fully usable while Core is failing.
    expect(await f.snapshotV1(core.id)).toEqual(activated);
    expect((await f.loginChain(core.email as string, password)).ok).toBe(true);

    // A staff "resend" during the outage does not reissue anything: the account is already active in v1.
    const mailsBefore = await f.v1InvitationMailCount();
    await requestAccountInvitationResend(h.client, h.ctx(), core.id);
    expect(await f.snapshotV1(core.id)).toEqual(activated);
    expect(await f.v1InvitationMailCount()).toBe(mailsBefore);

    await unblockCoreActivation();
    f.clock.advance(10 * 60_000);
    await f.settle();
    expect((await f.saga(core.id)).state).toBe('CORE_PROVISIONED');
    expect(await f.snapshotV1(core.id)).toEqual(activated);
  });
});

describe('delivery', () => {
  test('SMTP fails transiently, then recovers: the invitation arrives once and activates', async () => {
    const core = await f.coreUser('PARENT', 'smtp-transient');
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    await f.settle();
    f.failSmtp(2, 'transient');
    for (let attempt = 0; attempt < 4 && f.mailbox.length === 0; attempt += 1) {
      await f.deliverMail();
      f.clock.advance(120_000);
      await f.settle();
    }
    expect(f.mailbox).toHaveLength(1);
    expect((await f.saga(core.id)).state).toBe('SENT');
    const password = newPassword();
    expect((await f.activate(activationLink(f.mailbox[0]), password)).status).toBe(200);
    await f.settle();
    expect((await f.saga(core.id)).state).toBe('CORE_PROVISIONED');
  });

  test('a permanent SMTP failure ends in DELIVERY_FAILED; a resend recovers with a new generation', async () => {
    const core = await f.coreUser('ELEVE', 'smtp-permanent');
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    await f.settle();
    f.failSmtp(1, 'permanent');
    expect((await f.deliverMail()).finalFailed).toBe(1);
    expect(f.mailbox).toHaveLength(0);
    await f.settle();
    expect(await f.saga(core.id)).toMatchObject({ state: 'DELIVERY_FAILED', lastErrorCode: 'EMAIL_DELIVERY_FAILED' });

    await requestAccountInvitationResend(h.client, h.ctx(), core.id);
    await f.settle();
    await f.deliverMail();
    expect(f.mailbox).toHaveLength(1);
    expect((await f.saga(core.id)).generation).toBe(2);
    const password = newPassword();
    expect((await f.activate(activationLink(f.mailbox[0]), password)).status).toBe(200);
    await f.settle();
    expect((await f.saga(core.id)).state).toBe('CORE_PROVISIONED');
    expect((await f.loginChain(core.email as string, password)).ok).toBe(true);
  });
});

describe('expiry, replay, resend', () => {
  test('an expired invitation cannot activate; the saga reports EXPIRED; a resend recovers', async () => {
    const core = await f.coreUser('ASSISTANTE', 'expiry');
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    // Core v1's clock is four days behind: the token it issues is already expired for real.
    const skewed: V1Gateway = { ...defaultV1Gateway, issue: (target, now) => defaultV1Gateway.issue(target, new Date(now.getTime() - 4 * DAY)) };
    await f.run({ gateway: skewed });
    // The same pass that queued the mail already sees the window is closed.
    expect(await f.saga(core.id)).toMatchObject({ state: 'EXPIRED', lastErrorCode: 'INVITATION_EXPIRED' });
    const queued = await prisma.jobOutbox.findFirstOrThrow({ where: { aggregateId: `${core.id}:g1`, aggregateType: 'account-invitation' } });
    const content = decryptEmailIntent(queued.payload).content;
    const expired = activationLink({ text: content.text ?? '', html: content.html, to: 'synthetic@example.test', subject: 'Synthetic' });
    await f.deliverMail();
    expect(f.mailbox).toHaveLength(0);
    expect((await f.verifyLink(expired)).body).toMatchObject({ valid: false });
    expect((await f.activate(expired, newPassword())).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: core.id } })).password).toBeNull();

    await requestAccountInvitationResend(h.client, h.ctx(), core.id);
    await f.settle();
    await f.deliverMail();
    expect(f.mailbox).toHaveLength(1);
    const fresh = activationLink(f.mailbox[0]);
    expect((await f.activate(fresh, newPassword())).status).toBe(200);
    await f.settle();
    expect((await f.saga(core.id)).state).toBe('CORE_PROVISIONED');
  });

  test('a link is single use: replay is refused and the password it set is unchanged', async () => {
    const { core, link } = await invitedAndDelivered('PARENT', 'replay');
    const first = newPassword();
    expect((await f.activate(link, first)).status).toBe(200);
    expect((await f.activate(link, newPassword())).status).toBe(400);
    expect((await f.verifyLink(link)).body).toMatchObject({ valid: false });
    expect((await f.loginChain(core.email as string, first)).ok).toBe(true);
  });

  test('a resend invalidates the previous link and never asks Core for anything secret', async () => {
    const { core, link: first } = await invitedAndDelivered('COACH', 'resend');
    await requestAccountInvitationResend(h.client, h.ctx(), core.id);
    await f.settle();
    await f.deliverMail();
    const second = activationLink(f.mailbox[1]);
    expect(second.token).not.toBe(first.token);
    expect((await f.activate(first, newPassword())).status).toBe(400);
    expect((await f.verifyLink(second)).body).toMatchObject({ valid: true });
    expect((await f.saga(core.id)).generation).toBe(2);
  });

  test('an invitation resent after activation is refused and the credential is untouched', async () => {
    const { core, link } = await invitedAndDelivered('ASSISTANTE', 'resend-after-activation');
    const password = newPassword();
    await f.activate(link, password);
    await f.settle();
    const before = await f.snapshotV1(core.id);
    await expect(requestAccountInvitationResend(h.client, h.ctx(), core.id)).rejects.toBeInstanceOf(InvalidStateError);
    await expect(requestAccountInvitation(h.client, h.ctx(), core.id)).rejects.toBeInstanceOf(InvalidStateError);
    await f.settle();
    expect(await f.snapshotV1(core.id)).toEqual(before);
    expect((await f.loginChain(core.email as string, password)).ok).toBe(true);
  });

  test('activation racing the worker: the pending token is used first, the worker then only links', async () => {
    const v1 = await f.v1User('PARENT', 'activation-race', 'PENDING');
    const earlier = (await import('@/lib/auth/activation-token')).createActivationToken('parent');
    await prisma.user.update({ where: { id: v1.id }, data: { activationToken: earlier.tokenHash, activationExpiry: earlier.expiresAt } });
    const core = await f.coreUser('PARENT', 'activation-race-core', { id: v1.id, email: v1.email });
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    const password = newPassword();
    expect((await f.activate({ token: earlier.rawToken, purpose: 'parent' }, password)).status).toBe(200);
    const activated = await f.snapshotV1(core.id);
    await f.settle();
    expect((await f.saga(core.id)).state).toBe('CORE_PROVISIONED');
    expect(await f.snapshotV1(core.id)).toEqual(activated);
    expect(await f.v1InvitationMailCount()).toBe(0);
  });
});

describe('reset and revocation stay in Core v1', () => {
  test.each<Role>(['PARENT', 'ASSISTANTE'])('%s: reset changes the v1 password, revokes v1 sessions, Core is not involved', async (role) => {
    const { core, link } = await invitedAndDelivered(role, `reset-${role.toLowerCase()}`);
    const password = newPassword();
    await f.activate(link, password);
    await f.settle();
    const email = core.email as string;
    const coreBefore = await h.client.user.findUniqueOrThrow({ where: { id: core.id } });

    const v1Row = await prisma.user.findUniqueOrThrow({ where: { id: core.id } });
    const oldSession = issueSessionToken({} as never, { id: core.id, role, sessionVersion: v1Row.sessionVersion, authority: 'V1' } as never);
    expect(await validateSessionToken(oldSession)).not.toBeNull();

    const { POST } = await import('@/app/api/auth/reset-password/route');
    const post = (body: unknown, address: string) => POST(new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': address },
      body: JSON.stringify(body),
    }));
    expect((await post({ email }, '10.9.0.1')).status).toBe(200);
    await f.deliverMail();
    const resetMail = f.mailbox[f.mailbox.length - 1];
    const resetToken = new URL(/https?:\/\/\S+/.exec(resetMail.text)![0]).searchParams.get('token')!;
    const replacement = newPassword();
    expect((await post({ token: resetToken, newPassword: replacement }, '10.9.0.2')).status).toBe(200);

    expect((await f.loginChain(email, password)).ok).toBe(false);
    expect((await f.loginChain(email, replacement)).ok).toBe(true);
    expect(await validateSessionToken(oldSession)).toBeNull();
    // Core saw none of it.
    expect(await h.client.user.findUniqueOrThrow({ where: { id: core.id } })).toEqual(coreBefore);
    expect(await h.client.invitation.count()).toBe(0);
  });

  test('revoking all sessions is a v1 operation and leaves Core untouched', async () => {
    const { core, link } = await invitedAndDelivered('COACH', 'revoke');
    const password = newPassword();
    await f.activate(link, password);
    await f.settle();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: core.id } });
    const claims = issueSessionToken({} as never, { id: core.id, role: 'COACH', sessionVersion: row.sessionVersion, authority: 'V1' } as never);
    expect(await validateSessionToken(claims)).not.toBeNull();
    const coreBefore = await h.client.user.findUniqueOrThrow({ where: { id: core.id } });
    await revokeAllUserSessions(core.id);
    expect(await validateSessionToken(claims)).toBeNull();
    expect(await h.client.user.findUniqueOrThrow({ where: { id: core.id } })).toEqual(coreBefore);
    expect((await f.loginChain(core.email as string, password)).ok).toBe(true);
  });
});

describe('cancellation never destroys a v1 credential', () => {
  test('disabling the Core account withdraws the pending v1 link and nothing else', async () => {
    const { core, link } = await invitedAndDelivered('PARENT', 'cancel-pending');
    await disableAccount(h.client, h.ctx(), core.id);
    expect(await f.saga(core.id)).toMatchObject({ state: 'CANCELLED', lastErrorCode: 'CORE_ACCOUNT_DISABLED' });
    await f.settle();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: core.id } });
    expect(row.activationToken).toBeNull();
    expect(row.disabledAt).toBeNull();
    expect(row.password).toBeNull();
    expect((await f.activate(link, newPassword())).status).toBe(400);
  });

  test('disabling after v1 activation leaves the v1 password and account exactly as they are', async () => {
    const { core, link } = await invitedAndDelivered('ASSISTANTE', 'cancel-after-activation');
    const password = newPassword();
    await f.activate(link, password);
    await blockCoreActivation();
    await f.settle();
    expect((await f.saga(core.id)).state).toBe('PROVISIONING_RETRY');
    const activated = await f.snapshotV1(core.id);
    await disableAccount(h.client, h.ctx(), core.id);
    await f.settle();
    expect((await f.saga(core.id)).state).toBe('CANCELLED');
    expect(await f.snapshotV1(core.id)).toEqual(activated);
    expect((await f.loginChain(core.email as string, password)).ok).toBe(true);
  });
});

describe('no secret leaks', () => {
  test('no log line, audit row or job row carries the token or the password', async () => {
    const lines: string[] = [];
    const spies = (['log', 'info', 'warn', 'error'] as const).map((name) =>
      jest.spyOn(console, name).mockImplementation((...args: unknown[]) => { lines.push(args.map(String).join(' ')); }));
    try {
      const core = await f.coreUser('ASSISTANTE', 'no-leak');
      await requestAccountInvitation(h.client, h.ctx(), core.id);
      await f.settle();
      await f.deliverMail();
      const link = activationLink(f.mailbox[0]);
      const password = newPassword();
      await f.activate(link, password);
      await f.settle();
      const everything = [
        ...lines,
        JSON.stringify(await h.client.auditEvent.findMany()),
        JSON.stringify(await h.client.coreV2JobOutbox.findMany()),
        JSON.stringify(await h.client.accountV1Provisioning.findMany()),
      ].join('\n');
      expect(everything).not.toContain(link.token);
      expect(everything).not.toContain(password);
      expect(everything).not.toMatch(/\$2[aby]\$/);
      const queued = JSON.stringify(await prisma.jobOutbox.findMany({ where: { aggregateType: 'account-invitation' } }));
      expect(queued).not.toContain(link.token); // encrypted at rest in v1
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe('le refus d’un rôle non invitable vaut aux DEUX points d’entrée', () => {
  test('issue ET inspect refusent un ADMIN avec le même code', async () => {
    // `issue` le refusait déjà, et c'était le correctif D1. Mais le worker
    // appelle aussi `inspect`, puis provisionne Core sur un ACTIVE : un refus
    // posé d'un seul côté laisserait ce second chemin produire un rattachement.
    const core = await f.coreUser('ADMIN', 'not-invitable-both-gates');
    const target = {
      coreUserId: core.id, email: core.email, role: 'ADMIN' as Role,
      firstName: null, lastName: null, phone: null, generation: 1,
    };

    const issued = await issueV1AccountInvitation(target as never);
    expect(issued).toMatchObject({ outcome: 'REFUSED', code: 'V1_ROLE_NOT_INVITABLE' });

    const observed = await inspectV1Account(target as never);
    expect(observed).toMatchObject({ state: 'REFUSED', code: 'V1_ROLE_NOT_INVITABLE' });

    // Et rien n'a été écrit d'aucun côté.
    expect(await prisma.user.findUnique({ where: { id: core.id } })).toBeNull();
  });

  test('un rôle invitable n’est PAS refusé par inspect (contrôle positif)', async () => {
    // Sans ce contrôle, un `inspect` qui refuserait TOUT passerait le test
    // ci-dessus sans rien garantir.
    const core = await f.coreUser('ASSISTANTE', 'invitable-passes-inspect');
    const observed = await inspectV1Account({
      coreUserId: core.id, email: core.email, role: 'ASSISTANTE' as Role,
      firstName: null, lastName: null, phone: null, generation: 1,
    } as never);
    expect(observed).not.toMatchObject({ code: 'V1_ROLE_NOT_INVITABLE' });
  });
});
