import { prisma } from '@/lib/prisma';
import { requestAccountInvitation } from '@/lib/core-v2/services';
import { defaultV1Gateway, drainV1Provisioning } from '@/lib/core-v2/accounts/v1-provisioning-worker';
import { setupV1Fixture } from './helpers/v1-provisioning-fixture';
const f = setupV1Fixture();
describe('worker revalidates invitation authority before issuing a V1 token', () => {
  test.each(['Core issuer', 'V1 issuer', 'membership', 'enrollment', 'recipient', 'child ABA'] as const)('%s change after enqueue cancels without token or mail', async change => {
    const target = await f.coreUser('PARENT', 'worker-authority');
    await requestAccountInvitation(f.h.client, f.h.ctx(), target.id);
    if (change === 'Core issuer') await f.h.client.user.update({ where: { id: f.h.admin.userId }, data: { accountStatus: 'SUSPENDED' } });
    if (change === 'V1 issuer') await prisma.user.update({ where: { id: f.h.admin.userId }, data: { disabledAt: new Date() } });
    if (change === 'membership') await f.h.client.householdParent.update({ where: { userId: target.id }, data: { verificationStatus: 'REVOKED', revokedAt: new Date(), isPrimaryContact: false } });
    if (change === 'enrollment') await f.h.client.studentAcademicYearEnrollment.updateMany({ data: { status: 'WITHDRAWN' } });
    if (change === 'recipient') await f.h.client.user.update({ where: { id: target.id }, data: { email: 'edited@example.test' } });
    if (change === 'child ABA') {
      const child = await f.h.client.student.findFirstOrThrow();
      await f.h.client.user.update({ where: { id: child.userId }, data: { accountStatus: 'SUSPENDED' } });
      await f.h.client.user.update({ where: { id: child.userId }, data: { accountStatus: 'ACTIVE' } });
    }
    await f.run();
    expect((await f.saga(target.id)).state).toBe('CANCELLED');
    expect(await prisma.user.findUnique({ where: { id: target.id } })).toBeNull();
    expect(await f.v1InvitationMailCount()).toBe(0);
    expect(f.mailbox).toHaveLength(0);
  });
  test('an old unbound saga fails closed and is never silently adopted', async () => {
    const target = await f.coreUser('ASSISTANTE', 'unbound-saga');
    await requestAccountInvitation(f.h.client, f.h.ctx(), target.id);
    // Manufacture a PRE-migration job only in this disposable superuser fixture.
    await f.h.client.$transaction(async tx => {
      await tx.$executeRawUnsafe('ALTER TABLE public.account_v1_provisioning DISABLE TRIGGER core_invitation_binding_immutable');
      await tx.$executeRaw`UPDATE public.account_v1_provisioning SET "invitationBinding" = NULL WHERE "userId" = ${target.id}`;
      await tx.$executeRawUnsafe('ALTER TABLE public.account_v1_provisioning ENABLE TRIGGER core_invitation_binding_immutable');
    });
    await f.run();
    expect((await f.saga(target.id)).state).toBe('CANCELLED');
    expect(await f.v1InvitationMailCount()).toBe(0);
  });
  test('the same process owner gets a distinct fence on each new claim', async () => {
    const target = await f.coreUser('ASSISTANTE', 'fence-owner');
    await requestAccountInvitation(f.h.client, f.h.ctx(), target.id);
    const owners: string[] = [];
    const gateway = { ...defaultV1Gateway, async inspect(input: Parameters<typeof defaultV1Gateway.inspect>[0]) {
      const job = await f.h.client.coreV2JobOutbox.findFirstOrThrow({ where: { status: 'LEASED' } });
      owners.push(job.leaseOwner!);
      return defaultV1Gateway.inspect(input);
    } };
    await drainV1Provisioning(f.h.client, { owner: 'one-process', gateway, limit: 1, pollMs: 0, now: f.clock.now });
    await drainV1Provisioning(f.h.client, { owner: 'one-process', gateway, limit: 1, pollMs: 0, now: f.clock.now });
    expect(owners.length).toBeGreaterThanOrEqual(2);
    expect(new Set(owners).size).toBe(owners.length);
  });
});
