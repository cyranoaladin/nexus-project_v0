/** The legacy credential bootstrap is closed in every rollout mode. */
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@/core-v2/generated/client';
import { resolveCoreV2DatabaseUrl } from '@/lib/core-v2/client';
import { bootstrapFirstAdmin, inviteAccount, resendInvitation } from '@/lib/core-v2/services';
import { setupServiceHarness } from '../helpers/service-harness';
import { resetCoreV2Database } from '../helpers/reset-db';
const h = setupServiceHarness();
const owner = { email: 'synthetic-owner@example.test', firstName: 'Synthetic', lastName: 'Owner' };
const message = 'The legacy administrator bootstrap is closed; use bootstrap-v1-admin.';
let originalMode: string | undefined;
beforeEach(() => { originalMode = process.env.CORE_V2_AUTH_MODE; });
afterEach(() => { if (originalMode === undefined) delete process.env.CORE_V2_AUTH_MODE; else process.env.CORE_V2_AUTH_MODE = originalMode; });
async function snapshot() {
  return { users: await h.client.user.findMany({ orderBy: { id: 'asc' } }),
    receipts: await h.client.coreAdminBootstrap.findMany(),
    audit: await h.client.auditEvent.findMany({ orderBy: { id: 'asc' } }),
    invitations: await h.client.invitation.findMany(), jobs: await h.client.coreV2JobOutbox.findMany() };
}
test.each(['V1_ONLY', 'HYBRID', 'V2_ONLY'])('%s refuses the legacy bootstrap before any first ADMIN or receipt', async mode => {
  process.env.CORE_V2_AUTH_MODE = mode;
  await resetCoreV2Database(h.client);
  const before = await snapshot();
  await expect(bootstrapFirstAdmin(h.client, owner)).rejects.toMatchObject({ code: 'INVALID_STATE', message });
  expect(await snapshot()).toEqual(before);
});
test('two independent legacy bootstrap connections cannot create an ADMIN', async () => {
  process.env.CORE_V2_AUTH_MODE = 'HYBRID';
  await resetCoreV2Database(h.client);
  const a = new PrismaClient({ datasources: { db: { url: resolveCoreV2DatabaseUrl() } } });
  const b = new PrismaClient({ datasources: { db: { url: resolveCoreV2DatabaseUrl() } } });
  try {
    const before = await snapshot();
    const results = await Promise.allSettled([bootstrapFirstAdmin(a, owner), bootstrapFirstAdmin(b, owner)]);
    expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
    for (const result of results) if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'INVALID_STATE', message });
    expect(await snapshot()).toEqual(before);
  } finally { await a.$disconnect(); await b.$disconnect(); }
});
test('an attested ADMIN remains untouched by every legacy bootstrap mode', async () => {
  const before = await snapshot();
  for (const mode of ['V1_ONLY', 'HYBRID', 'V2_ONLY']) {
    process.env.CORE_V2_AUTH_MODE = mode;
    await expect(bootstrapFirstAdmin(h.client, owner)).rejects.toMatchObject({ code: 'INVALID_STATE', message });
  }
  expect(await snapshot()).toEqual(before);
});
test('an attested first ADMIN is never invited or resent a credential', async () => {
  const before = await snapshot();
  for (const mode of ['V1_ONLY', 'HYBRID', 'V2_ONLY']) {
    process.env.CORE_V2_AUTH_MODE = mode;
    await expect(inviteAccount(h.client, h.ctx(), h.admin.userId)).rejects.toThrow();
    await expect(resendInvitation(h.client, h.ctx(), h.admin.userId)).rejects.toThrow();
  }
  expect(await snapshot()).toEqual(before);
});
test('malformed input cannot open the closed bootstrap or leak a credential', async () => {
  const before = await snapshot();
  await expect(bootstrapFirstAdmin(h.client, { ...owner, password: randomBytes(24).toString('base64url') } as never))
    .rejects.toMatchObject({ code: 'INVALID_STATE', message });
  expect(await snapshot()).toEqual(before);
});
