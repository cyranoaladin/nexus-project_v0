/**
 * Disposable E2E stacks only: the exclusive, attested first-ADMIN bootstrap that
 * production performs offline (scripts/core-v2/bootstrap-v1-admin.ts), bound to
 * the seeded V1 ADMIN. No credential is read or written; Core v1 stays the
 * credential authority (V1_ONLY).
 */
import { randomBytes } from 'node:crypto';
import { prisma as coreV1 } from '@/lib/prisma';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import { bootstrapV1Admin } from '@/lib/core-v2/accounts/bootstrap-v1-admin';
import { fingerprintOfBootstrapManifest } from '@/lib/core-v2/accounts/bootstrap-manifest';
import { readRuntimeCredentialsManifest } from '@/lib/security/seed-runtime';
import { assertCoreV1E2eSeedTarget, assertCoreV2E2eSeedTarget, type CoreV2E2eSeedEnvironment } from './e2e-seed-target';

/** Synthetic release identity: the disposable stack runs no attested release artifact. */
const E2E_RELEASE_SHA = '0'.repeat(40);

export async function bootstrapE2eCoreV2Admin(env: CoreV2E2eSeedEnvironment = process.env): Promise<string> {
  assertCoreV2E2eSeedTarget(env);
  assertCoreV1E2eSeedTarget(env);
  if (env.CORE_V2_AUTH_MODE !== 'V1_ONLY') throw new Error('E2E_BOOTSTRAP_REQUIRES_V1_ONLY');
  const credentials = readRuntimeCredentialsManifest(env.E2E_CREDENTIALS_PATH ?? 'e2e/.credentials.json') as Record<string, { email?: unknown }>;
  if (typeof credentials.admin?.email !== 'string') throw new Error('E2E_BOOTSTRAP_ADMIN_IDENTITY_INVALID');
  const admin = await coreV1.user.findUnique({ where: { email: credentials.admin.email },
    select: { id: true, role: true, activatedAt: true, disabledAt: true, mergedIntoUserId: true } });
  if (!admin) throw new Error('E2E_BOOTSTRAP_ADMIN_IDENTITY_INVALID');
  const client = await requireCoreV2Client();
  const identity = await client.coreV2DatabaseIdentity.findUniqueOrThrow({ where: { id: 1 } });
  const [head] = await client.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL
    AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1`;
  const body = {
    finalSha: E2E_RELEASE_SHA, databaseIdentity: identity.instanceId, migrationHead: head!.migration_name, v1UserId: admin.id,
    expectedV1State: { role: 'ADMIN' as const, activated: true as const, disabled: false as const, merged: false as const },
    capability: 'ADMIN' as const, nonce: randomBytes(24).toString('base64url'),
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), reason: 'E2E_DISPOSABLE_STACK',
  };
  const outcome = await bootstrapV1Admin(client, { ...admin, role: String(admin.role) }, {
    nonce: body.nonce, expectedV1UserId: admin.id, manifest: { ...body, fingerprint: fingerprintOfBootstrapManifest(body) },
    expectedReleaseSha: E2E_RELEASE_SHA, expectedMigrationHead: head!.migration_name,
  });
  return outcome.outcome;
}

if (require.main === module) {
  bootstrapE2eCoreV2Admin().then(outcome => console.info(`E2E_CORE_V2_ADMIN_BOOTSTRAP_${outcome}`))
    .catch((error: unknown) => {
      // Controlled codes only: never a URL, path or identity.
      const code = error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'E2E_CORE_V2_ADMIN_BOOTSTRAP_FAILED';
      console.error(code); process.exitCode = 1;
    })
    .finally(async () => { await disconnectCoreV2Client(); await coreV1.$disconnect(); });
}
