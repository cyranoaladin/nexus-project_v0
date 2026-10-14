/**
 * Offline, manifest-bound first ADMIN bootstrap. Core v1 owns credentials.
 * The database attestation closes this path after its one atomic effect.
 * Rollback restores the release/environment; it never removes actors or receipts.
 */
import { prisma } from '@/lib/prisma';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { credentialAuthorityIsV1 } from '@/lib/core-v2/accounts/v1-authority';
import { readRunningReleaseSha } from '@/lib/core-v2/diagnostics/release-identity';
import { assertEligibleV1Admin, bootstrapV1Admin, verifyBootstrap, type V1AdminSnapshot } from '@/lib/core-v2/accounts/bootstrap-v1-admin';
import type { Prisma } from '@prisma/client';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadBootstrapManifest } from '@/lib/core-v2/accounts/bootstrap-manifest';
import { isCoreV2DomainError } from '@/lib/core-v2/errors';

function arg(name: string): string | undefined {
  return process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main(): Promise<number> {
  const manifestPath = arg('manifest');
  const modes = ['--dry-run', '--apply', '--verify'].filter(mode => process.argv.includes(mode));
  if (!manifestPath || modes.length !== 1 || arg('rollback')) {
    console.error('Usage: bootstrap-v1-admin --manifest=<path> (--dry-run | --apply | --verify)');
    return 2;
  }
  if (!credentialAuthorityIsV1()) throw new Error('BOOTSTRAP_REQUIRES_V1_ONLY');
  const manifest = loadBootstrapManifest(manifestPath);
  const releaseSha = await readRunningReleaseSha();
  const expectedMigrationHead = readdirSync(join(process.cwd(), 'core-v2/prisma/migrations'))
    .filter(name => /^\d{4}_[a-z0-9_]+$/.test(name)).sort().at(-1);
  if (!expectedMigrationHead) throw new Error('BOOTSTRAP_RELEASE_MIGRATIONS_UNAVAILABLE');
  const client = await requireCoreV2Client();
  try {
    // Lock order is always Core -> V1. Keep the V1 row lock until the Core
    // transaction has committed, without entering a second Core transaction
    // while that V1 lock is still held.
    let releaseV1: () => void = () => undefined;
    let pendingV1: Promise<unknown> | undefined;
    let v1Lease: Prisma.TransactionClient | undefined;
    let authorityLost = false;
    const readAuthoritativeV1 = () => new Promise<V1AdminSnapshot | null>((resolve, reject) => {
      const untilCoreFinishes = new Promise<void>(done => { releaseV1 = done; });
      pendingV1 = prisma.$transaction(async v1 => {
        v1Lease = v1;
        await v1.$queryRaw`SELECT id FROM public.users WHERE id = ${manifest.v1UserId} FOR SHARE`;
        const row = await v1.user.findUnique({ where: { id: manifest.v1UserId },
          select: { id: true, role: true, activatedAt: true, disabledAt: true, mergedIntoUserId: true } });
        resolve(row ? { ...row, role: String(row.role) } : null);
        await untilCoreFinishes;
      }, { timeout: 15_000 });
      void pendingV1.catch(error => { authorityLost = true; reject(error); });
    });
    const verifyAuthoritativeV1 = async () => {
      if (authorityLost || !v1Lease) throw new Error('V1_AUTHORITY_LEASE_LOST');
      const row = await v1Lease.user.findUnique({ where: { id: manifest.v1UserId },
        select: { id: true, role: true, activatedAt: true, disabledAt: true, mergedIntoUserId: true } });
      assertEligibleV1Admin(row ? { ...row, role: String(row.role) } : null, manifest.v1UserId);
      if (authorityLost) throw new Error('V1_AUTHORITY_LEASE_LOST');
    };
    let result;
    try {
      result = await bootstrapV1Admin(client, null, {
        nonce: manifest.nonce, expectedV1UserId: manifest.v1UserId, manifest,
        expectedReleaseSha: releaseSha, expectedMigrationHead, dryRun: modes[0] !== '--apply', readAuthoritativeV1, verifyAuthoritativeV1,
      });
    } finally {
      releaseV1();
      await pendingV1;
    }
    if (modes[0] === '--verify') {
      const report = await verifyBootstrap(client, manifest.v1UserId);
      console.info(JSON.stringify({ mode: 'verify', ...report }));
    } else {
      console.info(JSON.stringify({ mode: modes[0].slice(2), outcome: result.outcome,
        wouldProvision: result.outcome === 'READY', ...(result.receiptId ? { receiptId: result.receiptId } : {}) }));
    }
    return 0;
  } finally {
    await disconnectCoreV2Client();
    await prisma.$disconnect();
  }
}

main().then(code => process.exit(code)).catch((error: unknown) => {
  // Domain codes are controlled constants. Infrastructure errors never expose
  // connection strings, paths, identities or manifests in operator logs.
  console.error(isCoreV2DomainError(error) && /^[A-Z][A-Z0-9_]+$/.test(error.message)
    ? error.message : 'BOOTSTRAP_FAILED');
  process.exit(1);
});
