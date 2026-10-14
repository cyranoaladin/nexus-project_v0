import { syntheticSecret } from './helpers/synthetic-secret';
import { validateSessionToken } from '@/lib/auth/session-revocation';
import { prisma } from '@/lib/prisma';
import { setupV1Fixture } from './helpers/v1-provisioning-fixture';
const f = setupV1Fixture();
test.each(['disabledAt', 'mergedIntoUserId'] as const)('a version-matching V1 token cannot validate an identity with %s', async field => {
  const mergedInto = field === 'mergedIntoUserId' ? (await prisma.user.create({ data: {
    email: 'merged-target@d2.example.test', role: 'ADMIN', password: syntheticSecret(), activatedAt: new Date() } })).id : null;
  const user = await prisma.user.create({ data: { email: `inactive-${field}@d2.example.test`, role: 'ADMIN',
    password: syntheticSecret(), activatedAt: new Date(),
    ...(field === 'disabledAt' ? { disabledAt: new Date() } : { mergedIntoUserId: mergedInto }) } });
  const token = { id: user.id, role: user.role, authority: 'V1' as const, sessionVersion: user.sessionVersion };
  expect(await validateSessionToken(token)).toBeNull();
  expect(await f.v1InvitationMailCount()).toBe(0);
});
