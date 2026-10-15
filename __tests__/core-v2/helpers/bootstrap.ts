import type { PrismaClient } from '@/core-v2/generated/client';
import { bootstrapV1Admin } from '@/lib/core-v2/accounts/bootstrap-v1-admin';
import { fingerprintOfBootstrapManifest } from '@/lib/core-v2/accounts/bootstrap-manifest';

export async function bootstrapTestAdmin(client: PrismaClient, id = 'authoritative-test-admin') {
  const identity = await client.coreV2DatabaseIdentity.findUniqueOrThrow({ where: { id: 1 } });
  const [head] = await client.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
    AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1`;
  const at = new Date();
  const body = { finalSha: 'a'.repeat(40), databaseIdentity: identity.instanceId,
    migrationHead: head.migration_name, v1UserId: id,
    expectedV1State: { role: 'ADMIN' as const, activated: true as const, disabled: false as const, merged: false as const },
    capability: 'ADMIN' as const, nonce: 'authoritative-test-nonce',
    expiresAt: new Date(at.getTime() + 86_400_000).toISOString(), reason: 'ISOLATED_TEST' };
  return bootstrapV1Admin(client, { id, role: 'ADMIN', activatedAt: at, disabledAt: null, mergedIntoUserId: null }, {
    nonce: body.nonce, expectedV1UserId: id, manifest: { ...body, fingerprint: fingerprintOfBootstrapManifest(body) },
    expectedReleaseSha: body.finalSha, now: () => at,
  });
}
