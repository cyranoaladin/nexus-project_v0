/**
 * One-shot Core v1 → Core v2 migrator (go-live §AP). Dry run by default.
 *
 *   DATABASE_URL=<core v1, read only> CORE_V2_DATABASE_URL=<core v2 target> \
 *   npx tsx scripts/core-v2/migrate-to-core-v2.ts \
 *     --approval=<owner approval .json> --actor=<ADMIN user id present in the plan> \
 *     --migrated-at=<ISO instant> --out=<manifest .json> [--execute]
 *
 * Exit codes: 0 = manifest written, reconciliation clean; 2 = anomalies
 * (UNKNOWN / SILENT_DROPPED / DUPLICATE_TARGET / UNMAPPED_APPROVED > 0) or
 * any REJECTED object — the manifest is still written for review; 1 = refused
 * before doing anything (bad inputs, target holds foreign rows, source
 * unreadable).
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { prisma as coreV1 } from '@/lib/prisma';
import { approvalDigest, parseApprovalFile } from './migration/approval';
import { applyPlan } from './migration/apply';
import { readSourceSnapshot } from './migration/source';
import { buildTargetPlan } from './migration/transform';
import { TRANSFORM_VERSION } from './migration/types';

function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

async function main(): Promise<number> {
  const approvalPath = arg('approval');
  const actorUserId = arg('actor');
  const migratedAtRaw = arg('migrated-at');
  const out = arg('out');
  const execute = process.argv.includes('--execute');
  if (!approvalPath || !actorUserId || !migratedAtRaw || !out) {
    console.error('usage: --approval=<file> --actor=<userId> --migrated-at=<ISO> --out=<manifest.json> [--execute]');
    return 1;
  }
  const migratedAt = new Date(migratedAtRaw);
  if (Number.isNaN(migratedAt.getTime())) {
    console.error('--migrated-at must be an ISO instant');
    return 1;
  }
  const approval = parseApprovalFile(JSON.parse(readFileSync(approvalPath, 'utf8')));
  const digest = approvalDigest(approval);

  const v2 = await requireCoreV2Client();
  const snapshot = await readSourceSnapshot(coreV1, approval);
  const plan = buildTargetPlan(snapshot, approval, migratedAt);
  if (!plan.users.some((u) => u.id === actorUserId && u.role === 'ADMIN')) {
    console.error(`--actor ${actorUserId} is not an ADMIN user of this plan; the migrating actor must exist in Core v2.`);
    return 1;
  }
  const manifest = await applyPlan(v2, plan, {
    execute,
    actorUserId,
    migratedAt,
    approvalDigest: digest,
    sourceFingerprint: snapshot.fingerprint,
    transformVersion: TRANSFORM_VERSION,
    correlationId: `migration:${randomUUID()}`,
  });
  writeFileSync(out, JSON.stringify(manifest, null, 2));
  const rejected = manifest.objects.filter((o) => o.result === 'REJECTED').length;
  console.log(
    `[migrate-to-core-v2] ${manifest.mode} approval=${digest.slice(0, 12)} source=${manifest.sourceFingerprint} target=${manifest.targetFingerprint} objects=${manifest.objects.length} rejected=${rejected} anomalies=${manifest.anomalies.join(',') || 'none'} → ${out}`,
  );
  return manifest.anomalies.length > 0 || rejected > 0 ? 2 : 0;
}

main()
  .then(async (code) => {
    await disconnectCoreV2Client().catch(() => undefined);
    await coreV1.$disconnect().catch(() => undefined);
    process.exit(code);
  })
  .catch(async (error) => {
    console.error('[migrate-to-core-v2] REFUSED', error instanceof Error ? error.message : error);
    await disconnectCoreV2Client().catch(() => undefined);
    await coreV1.$disconnect().catch(() => undefined);
    process.exit(1);
  });
