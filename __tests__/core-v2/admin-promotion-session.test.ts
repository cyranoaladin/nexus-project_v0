import { syntheticSecret } from './helpers/synthetic-secret';
import { randomUUID } from 'node:crypto';
import { limitedRoleUrl } from './helpers/limited-role-url';
import { encode } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { promoteCoreAdministrator } from '@/lib/core-v2/services/admin-promotion';
import { disconnectCoreV2AdminAuthorizer, requireCoreV2AdminAuthorizerClient } from '@/lib/core-v2/client';
import { setupV1Fixture } from './helpers/v1-provisioning-fixture';
import { installTestAdminPromotionRoles } from './helpers/admin-promotion';
jest.mock('@/lib/deployment/release-identity', () => ({ readRunningReleaseSha: async () => 'a'.repeat(40) }));
const f = setupV1Fixture();
const secret = syntheticSecret();
const previous = { secret: process.env.AUTH_SECRET, authUrl: process.env.AUTH_URL,
  nextAuthUrl: process.env.NEXTAUTH_URL, authorizer: process.env.CORE_V2_ADMIN_AUTHORIZER_DATABASE_URL };
beforeAll(async () => { await installTestAdminPromotionRoles(f.h.client);
  process.env.CORE_V2_ADMIN_AUTHORIZER_DATABASE_URL = await limitedRoleUrl(f.h.client, 'nexus_core_admin_authorizer');
  process.env.AUTH_SECRET = secret; process.env.AUTH_URL = 'http://localhost:3000'; process.env.NEXTAUTH_URL = 'http://localhost:3000'; });
afterAll(async () => { await disconnectCoreV2AdminAuthorizer();
  for (const [key, value] of Object.entries({ AUTH_SECRET: previous.secret, AUTH_URL: previous.authUrl,
    NEXTAUTH_URL: previous.nextAuthUrl, CORE_V2_ADMIN_AUTHORIZER_DATABASE_URL: previous.authorizer }))
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
});
async function authenticated(userId = f.h.admin.userId, role: 'ADMIN' | 'COACH' = 'ADMIN', overrides: Record<string, unknown> = {}) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const jwt = await encode({ secret, salt: 'authjs.session-token', maxAge: 300,
    token: { id: userId, role, authority: 'V1', sessionVersion: user.sessionVersion, ...overrides } });
  return { session: { user: { id: userId, role, email: 'synthetic@example.test', authority: 'V1' as const },
    expires: new Date(Date.now() + 300_000).toISOString() }, request: new NextRequest('http://localhost:3000/api/v2/staff/accounts/target/promote-admin',
    { method: 'POST', headers: { cookie: `authjs.session-token=${jwt}`, origin: 'http://localhost:3000' } }) };
}
async function promote(commandId = randomUUID(), changes: Record<string, unknown> = {}) {
  const auth = await authenticated();
  return promoteCoreAdministrator(f.h.client, f.h.ctx(), auth.session, auth.request,
    { targetId: f.h.assistante.userId, commandId, reason: 'STAFF_AUTHORIZATION', ...changes });
}
async function snapshot() { return { users: await f.h.client.user.findMany({ orderBy: { id: 'asc' } }),
  audit: await f.h.client.auditEvent.findMany({ orderBy: { id: 'asc' } }), v1: await prisma.user.findMany({
    where: { id: { in: [f.h.admin.userId, f.h.assistante.userId] } }, orderBy: { id: 'asc' } }),
  jobs: await f.h.client.coreV2JobOutbox.findMany() }; }
test('a session-authorized promotion is atomic, idempotent and changes no V1 credential or session', async () => {
  const before = await snapshot(); const command = randomUUID(); const first = await promote(command);
  expect(first).toMatchObject({ outcome: 'PROMOTED', targetId: f.h.assistante.userId });
  const after = await snapshot(); expect(after.v1).toEqual(before.v1); expect(after.jobs).toEqual(before.jobs);
  expect(after.users.find(u => u.id === f.h.assistante.userId)).toMatchObject({ role: 'ADMIN', password: null, sessionVersion: 1 });
  expect(after.audit.filter(a => a.action === 'account.admin_promoted')).toHaveLength(1);
  expect(await promote(command)).toMatchObject({ outcome: 'ALREADY_PROMOTED', receiptId: first.receiptId });
  expect(await snapshot()).toEqual(after);
});
test.each(['ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'] as const)('a %s actor cannot gain authority from a forged ADMIN context', async role => {
  if (role !== 'ASSISTANTE') await f.h.client.user.update({ where: { id: f.h.assistante.userId }, data: { role } });
  const before = await snapshot(); const auth = await authenticated();
  await expect(promoteCoreAdministrator(f.h.client, { ...f.h.ctx(), actor: { userId: f.h.assistante.userId, role: 'ADMIN' } },
    auth.session, auth.request, { targetId: f.h.admin.userId, commandId: randomUUID(), reason: 'STAFF_AUTHORIZATION' })).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});
test.each(['disabledAt', 'mergedIntoUserId', 'sessionVersion'] as const)('V1 %s changed after authentication refuses without Core mutation', async field => {
  const auth = await authenticated(); const beforeCore = await f.h.client.user.findMany(); const beforeAudit = await f.h.client.auditEvent.findMany();
  await prisma.user.update({ where: { id: f.h.admin.userId }, data: field === 'disabledAt' ? { disabledAt: new Date() }
    : field === 'mergedIntoUserId' ? { mergedIntoUserId: f.h.assistante.userId } : { sessionVersion: { increment: 1 } } });
  await expect(promoteCoreAdministrator(f.h.client, f.h.ctx(), auth.session, auth.request,
    { targetId: f.h.assistante.userId, commandId: randomUUID(), reason: 'STAFF_AUTHORIZATION' })).rejects.toThrow('Administrator promotion unavailable.');
  expect(await f.h.client.user.findMany()).toEqual(beforeCore); expect(await f.h.client.auditEvent.findMany()).toEqual(beforeAudit);
});
test.each([{ id: 'different-private-identity' }, { role: 'COACH' }, { authority: 'CORE_V2' }, { sessionVersion: -1 }])
  ('a divergent private cookie %p is refused', async override => {
    const before = await snapshot(); const auth = await authenticated(f.h.admin.userId, 'ADMIN', override);
    await expect(promoteCoreAdministrator(f.h.client, f.h.ctx(), auth.session, auth.request,
      { targetId: f.h.assistante.userId, commandId: randomUUID(), reason: 'STAFF_AUTHORIZATION' })).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });
test('a Bearer token cannot replace the private session cookie', async () => {
  const auth = await authenticated(); const cookie = auth.request.headers.get('cookie')!;
  const request = new NextRequest(auth.request.url, { headers: { authorization: `Bearer ${cookie.split('=')[1]}` } });
  const before = await snapshot(); await expect(promoteCoreAdministrator(f.h.client, f.h.ctx(), auth.session, request,
    { targetId: f.h.assistante.userId, commandId: randomUUID(), reason: 'STAFF_AUTHORIZATION' })).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});
test('simultaneous identical commands produce one promotion and one receipt', async () => {
  const command = randomUUID(); const outcomes = await Promise.all([promote(command), promote(command)]);
  expect(outcomes.map(o => o.outcome).sort()).toEqual(['ALREADY_PROMOTED', 'PROMOTED']);
  expect(await f.h.client.auditEvent.count({ where: { action: 'account.admin_promoted' } })).toBe(1);
});
test('an explicitly promoted Core ADMIN authenticates with its unchanged V1 staff role', async () => {
  await f.h.client.user.update({ where: { id: f.h.assistante.userId }, data: { role: 'COACH' } });
  await prisma.user.update({ where: { id: f.h.assistante.userId }, data: { role: 'COACH' } });
  await promote();
  const next = await f.v1User('ASSISTANTE', 'next-admin', 'ACTIVE');
  await f.h.client.user.create({ data: { id: next.id, role: 'ASSISTANTE', accountStatus: 'ACTIVE' } });
  const beforeV1 = await prisma.user.findMany({ where: { id: { in: [next.id, f.h.assistante.userId] } }, orderBy: { id: 'asc' } });
  const auth = await authenticated(f.h.assistante.userId, 'COACH');
  await expect(promoteCoreAdministrator(f.h.client, { ...f.h.ctx(), actor: { userId: f.h.assistante.userId, role: 'ADMIN' } },
    auth.session, auth.request, { targetId: next.id, commandId: randomUUID(), reason: 'SUCCESSION' })).resolves.toMatchObject({ outcome: 'PROMOTED' });
  expect(await prisma.user.findMany({ where: { id: { in: [next.id, f.h.assistante.userId] } }, orderBy: { id: 'asc' } })).toEqual(beforeV1);
});
test('a receipt without its ADMIN effect cannot commit under the actual authorizer role', async () => {
  const before = await snapshot(); const authorizer = await requireCoreV2AdminAuthorizerClient();
  await expect(authorizer.$transaction(async tx => {
    await tx.auditEvent.create({ data: { action: 'account.admin_promoted', subjectType: 'User', actorUserId: f.h.admin.userId,
      subjectId: f.h.assistante.userId, correlationId: randomUUID(), metadata: { operation: 'CORE_ADMIN_PROMOTION',
        reason: 'STAFF_AUTHORIZATION', releaseSha: 'a'.repeat(40), issuerV1Role: 'ADMIN', issuerV1Version: 0,
        expiresAt: new Date(Date.now() + 3_000).toISOString() } } });
  })).rejects.toThrow('UNATTESTED_ADMIN_STATE');
  expect(await snapshot()).toEqual(before);
});
test('the authorizer cannot assume the function owner or execute a command without its receipt', async () => {
  const authorizer = await requireCoreV2AdminAuthorizerClient(); const before = await snapshot();
  await expect(authorizer.$executeRaw`SET LOCAL ROLE nexus_core_admin_promoter_owner`).rejects.toThrow();
  await expect(authorizer.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL ROLE nexus_core_admin_promotion`;
    await tx.$queryRaw`SELECT public.core_promote_admin(${randomUUID()}::uuid)`;
  })).rejects.toThrow('SESSION_AUTHORIZED_PROMOTION_REQUIRED');
  expect(await snapshot()).toEqual(before);
});
test('a different replay intent and client-supplied authority fields refuse without mutation', async () => {
  const command = randomUUID(); await promote(command); const before = await snapshot();
  for (const changes of [{ reason: 'SUCCESSION' }, { issuerId: f.h.assistante.userId }, { role: 'ADMIN' },
    { databaseIdentity: 'forged' }, { expiresAt: new Date(Date.now() + 60_000).toISOString() }]) {
    await expect(promote(command, changes)).rejects.toThrow(); expect(await snapshot()).toEqual(before);
  }
});
test.each(['missing-identity', 'suspended-core', 'suspended-v1'] as const)('%s target produces the same refusal and no receipt', async fault => {
  const targetId = fault === 'missing-identity' ? 'missing-target' : f.h.assistante.userId;
  if (fault === 'suspended-core') await f.h.client.user.update({ where: { id: targetId }, data: { accountStatus: 'SUSPENDED' } });
  if (fault === 'suspended-v1') await prisma.user.update({ where: { id: targetId }, data: { disabledAt: new Date() } });
  const before = await snapshot(); await expect(promote(randomUUID(), { targetId })).rejects.toThrow('Administrator promotion unavailable.');
  expect(await snapshot()).toEqual(before);
});
