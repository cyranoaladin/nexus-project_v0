/**
 * The administrator bootstrap: mutual exclusion under real concurrency, and
 * recovery when the invitation never reaches its recipient.
 *
 * The concurrency test uses two INDEPENDENT connections with a controlled
 * overlap, because that is the only thing that distinguishes a guard that
 * works from one that merely looks careful: an in-transaction re-check alone
 * lets both READ COMMITTED transactions read zero and both insert.
 */
import { PrismaClient } from '@/core-v2/generated/client';
import { resolveCoreV2DatabaseUrl } from '@/lib/core-v2/client';
import { CoreV2DomainError } from '@/lib/core-v2/errors';
import {
  activateAccount,
  bootstrapFirstAdmin,
  inspectInvitation,
  inviteAccount,
  resendInvitation,
} from '@/lib/core-v2/services';
import { createServiceContext } from '@/lib/core-v2/services/context';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

const OWNER = { email: 'owner@example.com', firstName: 'Proprietaire', lastName: 'Nexus' } as const;
const PW = 'change_me_owner_bootstrap';

/** The harness seeds an ADMIN for the other suites; the bootstrap needs none. */
async function clearAdmins(): Promise<void> {
  await h.client.user.deleteMany({ where: { role: 'ADMIN' } });
}

describe('bootstrapFirstAdmin — mutual exclusion', () => {
  test('two INDEPENDENT connections overlapping deliberately produce exactly one ADMIN', async () => {
    await clearAdmins();
    const url = resolveCoreV2DatabaseUrl();
    const a = new PrismaClient({ datasources: { db: { url } } });
    const b = new PrismaClient({ datasources: { db: { url } } });
    try {
      // Both calls are in flight before either can commit: the advisory lock,
      // not the ordering of these two promises, is what decides the outcome.
      const results = await Promise.allSettled([
        bootstrapFirstAdmin(a, { ...OWNER, email: 'race-a@example.com' }),
        bootstrapFirstAdmin(b, { ...OWNER, email: 'race-b@example.com' }),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(CoreV2DomainError);
      expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/bootstrap is closed/i);

      // The loser left nothing behind: no row, and no audit event either.
      expect(await h.client.user.count({ where: { role: 'ADMIN' } })).toBe(1);
      expect(await h.client.user.count({ where: { email: { in: ['race-a@example.com', 'race-b@example.com'] } } })).toBe(1);
      expect(await h.client.auditEvent.count({ where: { action: 'staff.bootstrap_admin_created' } })).toBe(1);
    } finally {
      await a.$disconnect();
      await b.$disconnect();
    }
  });

  test('once an ADMIN exists the bootstrap refuses, whatever that ADMIN’s status', async () => {
    await clearAdmins();
    const admin = await bootstrapFirstAdmin(h.client, OWNER);
    for (const accountStatus of ['PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'] as const) {
      await h.client.user.update({ where: { id: admin.id }, data: { accountStatus } });
      await expect(bootstrapFirstAdmin(h.client, { ...OWNER, email: 'second@example.com' })).rejects.toThrow(/bootstrap is closed/i);
    }
    expect(await h.client.user.count({ where: { role: 'ADMIN' } })).toBe(1);
  });

  test('the bootstrap creates an account only — no password, no invitation, no session', async () => {
    await clearAdmins();
    const admin = await bootstrapFirstAdmin(h.client, OWNER);
    expect(admin.role).toBe('ADMIN');
    expect(admin.accountStatus).toBe('PENDING_ACTIVATION');
    expect(admin.password).toBeNull();
    expect(admin.activatedAt).toBeNull();
    expect(admin.sessionVersion).toBe(0);
    expect(await h.client.invitation.count()).toBe(0);
  });

  test('the audit records the bootstrap with no actor, because none existed yet', async () => {
    await clearAdmins();
    const admin = await bootstrapFirstAdmin(h.client, OWNER);
    const rows = await h.client.auditEvent.findMany({ where: { subjectId: admin.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('staff.bootstrap_admin_created');
    expect(rows[0].actorUserId).toBeNull();
  });
});

describe('recovery when the invitation never arrives', () => {
  test('the same account is re-invited: one ADMIN, the old link dies, the new one works', async () => {
    await clearAdmins();
    const admin = await bootstrapFirstAdmin(h.client, OWNER);
    const ctx = createServiceContext({ userId: admin.id, role: 'ADMIN' });

    const lost = await inviteAccount(h.client, ctx, admin.id); // delivery is assumed to have failed
    const reissued = await resendInvitation(h.client, ctx, admin.id);

    expect(reissued.rawToken).not.toBe(lost.rawToken);
    expect(await h.client.user.count({ where: { role: 'ADMIN' } })).toBe(1);

    // The lost link is revoked, not merely superseded.
    expect(await inspectInvitation(h.client, lost.rawToken)).toBeNull();
    await expect(activateAccount(h.client, { rawToken: lost.rawToken, password: PW })).rejects.toThrow(CoreV2DomainError);

    const activated = await activateAccount(h.client, { rawToken: reissued.rawToken, password: PW });
    expect(activated.accountStatus).toBe('ACTIVE');
    expect(activated.sessionVersion).toBe(1);
  });

  test('a consumed token cannot be replayed', async () => {
    await clearAdmins();
    const admin = await bootstrapFirstAdmin(h.client, OWNER);
    const issued = await inviteAccount(h.client, createServiceContext({ userId: admin.id, role: 'ADMIN' }), admin.id);
    await activateAccount(h.client, { rawToken: issued.rawToken, password: PW });
    await expect(activateAccount(h.client, { rawToken: issued.rawToken, password: 'change_me_other' })).rejects.toThrow(CoreV2DomainError);
    expect(await h.client.user.count({ where: { role: 'ADMIN' } })).toBe(1);
  });

  test('an expired invitation is refused and can be replaced', async () => {
    await clearAdmins();
    const admin = await bootstrapFirstAdmin(h.client, OWNER);
    const ctx = createServiceContext({ userId: admin.id, role: 'ADMIN' });
    const issued = await inviteAccount(h.client, ctx, admin.id);

    await h.client.invitation.update({
      where: { tokenHash: issued.invitation.tokenHash },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect(await inspectInvitation(h.client, issued.rawToken)).toBeNull();
    await expect(activateAccount(h.client, { rawToken: issued.rawToken, password: PW })).rejects.toThrow(CoreV2DomainError);

    // An expired invitation is not an open one, so a fresh invite is allowed.
    const fresh = await resendInvitation(h.client, ctx, admin.id);
    const activated = await activateAccount(h.client, { rawToken: fresh.rawToken, password: PW });
    expect(activated.accountStatus).toBe('ACTIVE');
  });
});
