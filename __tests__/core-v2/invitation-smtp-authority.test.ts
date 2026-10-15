import { prisma } from '@/lib/prisma';
import { requestAccountInvitation } from '@/lib/core-v2/services';
import { setupV1Fixture } from './helpers/v1-provisioning-fixture';
const f = setupV1Fixture();

describe('invitation authority is revalidated immediately before SMTP', () => {
  test.each(['Core issuer', 'V1 issuer', 'membership', 'enrollment', 'recipient', 'token', 'expiration'] as const)
    ('%s change after V1 enqueue prevents every SMTP delivery', async change => {
      const user = await f.coreUser('PARENT', 'smtp-authority');
      await requestAccountInvitation(f.h.client, f.h.ctx(), user.id);
      await f.run({ limit: 1 });
      expect(await f.v1InvitationMailCount()).toBe(1);
      if (change === 'Core issuer') await f.h.client.user.update({ where: { id: f.h.admin.userId }, data: { accountStatus: 'SUSPENDED' } });
      if (change === 'V1 issuer') await prisma.user.update({ where: { id: f.h.admin.userId }, data: { disabledAt: new Date() } });
      if (change === 'membership') await f.h.client.householdParent.update({ where: { userId: user.id }, data: { verificationStatus: 'REVOKED', revokedAt: new Date(), isPrimaryContact: false } });
      if (change === 'enrollment') await f.h.client.studentAcademicYearEnrollment.updateMany({ data: { status: 'WITHDRAWN' } });
      if (change === 'recipient') await f.h.client.user.update({ where: { id: user.id }, data: { email: 'changed@example.test' } });
      if (change === 'token') await prisma.user.update({ where: { id: user.id }, data: { activationToken: 'another-flow-hash' } });
      if (change === 'expiration') f.clock.advance(4 * 86_400_000);
      await f.deliverMail();
      expect(f.mailbox).toHaveLength(0);
      expect(await prisma.jobOutbox.findFirst({ where: { aggregateType: 'account-invitation' }, select: { status: true } })).toEqual({ status: 'CANCELLED' });
    });
});
