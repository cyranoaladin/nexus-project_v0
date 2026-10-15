import { prisma } from '@/lib/prisma';
import { withInvitationActor } from '@/lib/core-v2/accounts/invitation-scope';
import { acquireV1InvitationIdentity, V1InvitationScopeRefusal } from '@/lib/auth/v1-invitation-authority';
import { setupV1Fixture } from './helpers/v1-provisioning-fixture';
import { waitForLockWaiter } from './helpers/service-harness';
const f = setupV1Fixture();
test('loss of the actual V1 backend is a generic refusal and rolls back every Core mutation', async () => {
  const before = await f.h.client.household.findMany();
  await expect(withInvitationActor(f.h.client, f.h.ctx(), async tx => {
    await tx.household.create({ data: {} });
    const [row] = await prisma.$queryRaw<Array<{ terminated: boolean }>>`
      SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity
      WHERE application_name = 'nexus-v1-invitation-authority' AND datname = current_database()`;
    expect(row.terminated).toBe(true);
  })).rejects.toThrow('Invitation operation unavailable.');
  expect(await f.h.client.household.findMany()).toEqual(before);
});
test('the identity row remains leased until the Core transaction has committed', async () => {
  let release!: () => void; let ready!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const acquired = new Promise<void>(resolve => { ready = resolve; });
  const core = withInvitationActor(f.h.client, f.h.ctx(), async tx => {
    await tx.household.create({ data: {} }); ready(); await gate;
  });
  await acquired;
  let suspended = false;
  const v1 = Promise.resolve(prisma.user.update({ where: { id: f.h.admin.userId }, data: { disabledAt: new Date() } }))
    .then(() => { suspended = true; });
  try {
    await waitForLockWaiter(prisma as never);
    expect(suspended).toBe(false);
    release(); await core; await v1;
    expect(await f.h.client.household.count()).toBe(1);
    expect(suspended).toBe(true);
  } finally { release(); await Promise.allSettled([core, v1]); }
});
test('a lost lease verifier emits no database path, driver message or connection details', async () => {
  const lease = await acquireV1InvitationIdentity({ issuerId: f.h.admin.userId });
  await prisma.$queryRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE application_name = 'nexus-v1-invitation-authority' AND datname = current_database()`;
  try { await expect(lease.verify()).rejects.toBeInstanceOf(V1InvitationScopeRefusal); }
  finally { await lease.release().catch(() => undefined); }
});

test.each(['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT'] as const)('an active immutable target lease cannot substitute the expected ELEVE role: %s', async role => {
  const target = await f.v1User(role, 'wrong-foundation-role', 'ACTIVE');
  const before = await f.snapshotV1(target.id);
  await expect(acquireV1InvitationIdentity({ issuerId: f.h.admin.userId, targetId: target.id,
    expectedIssuerRole: 'ADMIN', requireActiveTargetById: true, targetRole: 'ELEVE', recipient: target.email }).then(async lease => { await lease.release(); return lease; }))
    .rejects.toBeInstanceOf(V1InvitationScopeRefusal);
  expect(await f.snapshotV1(target.id)).toEqual(before);
});
test('an active immutable target lease cannot silently adopt another recipient', async () => {
  const target = await f.v1User('ELEVE', 'wrong-foundation-recipient', 'ACTIVE');
  await expect(acquireV1InvitationIdentity({ issuerId: f.h.admin.userId, targetId: target.id,
    expectedIssuerRole: 'ADMIN', requireActiveTargetById: true, targetRole: 'ELEVE', recipient: 'foreign@example.test' }).then(async lease => { await lease.release(); return lease; }))
    .rejects.toBeInstanceOf(V1InvitationScopeRefusal);
});
