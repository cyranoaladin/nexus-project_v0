import { prisma } from '@/lib/prisma';
import { requestAccountInvitation } from '@/lib/core-v2/services';
import { issueV1AccountInvitation, revokeV1AccountInvitation, type V1InvitationTarget } from '@/lib/auth/v1-account-invitation';
import { assertCurrentInvitationBinding } from '@/lib/core-v2/accounts/invitation-scope';
import { setupV1Fixture } from '../helpers/v1-provisioning-fixture';

const f = setupV1Fixture();
async function issued() {
  const user = await f.coreUser('COACH', 'durable-receipt');
  await requestAccountInvitation(f.h.client, f.h.ctx(), user.id);
  const saga = await f.h.client.accountV1Provisioning.findUniqueOrThrow({ where: { userId: user.id } });
  const binding = await f.h.client.$transaction(tx => assertCurrentInvitationBinding(tx, saga));
  const target: V1InvitationTarget = { coreUserId: user.id, email: user.email!, role: user.role,
    firstName: null, lastName: null, phone: null, generation: saga.generation,
    authority: { issuerId: binding.scope.issuerId, issuerVersion: binding.v1IssuerVersion!,
      bindingDigest: binding.fingerprint, databaseIdentity: binding.scope.databaseIdentity, operation: binding.scope.operation } };
  expect(await issueV1AccountInvitation(target)).toMatchObject({ outcome: 'INVITED', replayed: false });
  return { user, target };
}
describe('durable V1 invitation issuance authority', () => {
  test('outbox retention never erases the generation receipt or creates another invitation', async () => {
    const { user, target } = await issued();
    const before = await f.snapshotV1(user.id);
    await prisma.jobOutbox.deleteMany({ where: { aggregateType: 'account-invitation' } });
    expect(await issueV1AccountInvitation(target)).toMatchObject({ outcome: 'INVITED', replayed: true });
    expect(await f.snapshotV1(user.id)).toEqual(before);
    expect(await f.v1InvitationMailCount()).toBe(0);
    expect(await prisma.$queryRaw`SELECT generation FROM public.v1_account_invitation_issuances WHERE "userId" = ${user.id}`)
      .toEqual([{ generation: 1 }]);
  });
  test('a generation cannot be adopted by a different immutable authority binding', async () => {
    const { user, target } = await issued();
    const before = await f.snapshotV1(user.id);
    expect(await issueV1AccountInvitation({ ...target, authority: { ...target.authority!, bindingDigest: 'f'.repeat(64) } }))
      .toMatchObject({ outcome: 'REFUSED' });
    expect(await f.snapshotV1(user.id)).toEqual(before);
    expect(await f.v1InvitationMailCount()).toBe(1);
  });
  test('revocation cancels the queued mail and preserves a token rotated by another V1 flow', async () => {
    const { user } = await issued();
    await prisma.user.update({ where: { id: user.id }, data: { activationToken: 'another-v1-flow-token-hash' } });
    const before = await f.snapshotV1(user.id);
    expect(await revokeV1AccountInvitation({ coreUserId: user.id, generation: 1 })).toEqual({ revoked: false });
    expect(await f.snapshotV1(user.id)).toEqual(before);
    expect(await prisma.jobOutbox.findFirst({ where: { aggregateType: 'account-invitation' }, select: { status: true } }))
      .toEqual({ status: 'CANCELLED' });
    expect(await issueV1AccountInvitation((await issuedTarget(user.id))))
      .toMatchObject({ outcome: 'REFUSED' });
  });
  test('V1 suspension and reactivation invalidates the old issuer version', async () => {
    const user = await f.coreUser('COACH', 'issuer-v1-aba');
    await requestAccountInvitation(f.h.client, f.h.ctx(), user.id);
    await prisma.user.update({ where: { id: f.h.admin.userId }, data: { disabledAt: new Date() } });
    await prisma.user.update({ where: { id: f.h.admin.userId }, data: { disabledAt: null } });
    await f.run();
    expect((await f.saga(user.id)).state).toBe('CANCELLED');
    expect(await f.v1InvitationMailCount()).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });
});
async function issuedTarget(userId: string): Promise<V1InvitationTarget> {
  const user = await f.h.client.user.findUniqueOrThrow({ where: { id: userId } });
  const saga = await f.h.client.accountV1Provisioning.findUniqueOrThrow({ where: { userId } });
  const binding = await f.h.client.$transaction(tx => assertCurrentInvitationBinding(tx, saga));
  return { coreUserId: user.id, email: user.email!, role: user.role, firstName: null, lastName: null,
    phone: null, generation: saga.generation, authority: { issuerId: binding.scope.issuerId,
      issuerVersion: binding.v1IssuerVersion!, bindingDigest: binding.fingerprint,
      databaseIdentity: binding.scope.databaseIdentity, operation: binding.scope.operation } };
}
