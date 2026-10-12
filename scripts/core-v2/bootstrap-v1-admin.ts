/**
 * bootstrap-v1-admin — amorçage HORS LIGNE du premier administrateur Core v2.
 *
 *   bootstrap-v1-admin --manifest=<chemin> --dry-run
 *   bootstrap-v1-admin --manifest=<chemin> --apply
 *   bootstrap-v1-admin --manifest=<chemin> --verify
 *   bootstrap-v1-admin --manifest=<chemin> --rollback=<receiptId>
 *
 * Il n'existe aucun endpoint HTTP équivalent, et il n'en existera pas : un
 * amorçage accessible en ligne serait un contournement permanent des capacités.
 *
 * Le premier ADMIN Core n'est jamais invité et ne reçoit jamais de credential
 * Core : il est RATTACHÉ à un ADMIN Core v1 déjà actif, désigné par son
 * identifiant immuable — jamais par son adresse e-mail, qui peut changer de
 * porteur. Rien d'autre n'est créé que l'acteur, son rôle ADMIN et un reçu.
 *
 * L'opération est autorisée par un manifeste en 0400 qui lie l'exécution à un
 * SHA, une base, une tête de migrations, une identité V1, un nonce et une
 * expiration. Son empreinte est recalculée : un manifeste modifié est refusé.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { credentialAuthorityIsV1 } from '@/lib/core-v2/accounts/v1-authority';
import {
  bootstrapV1Admin,
  verifyBootstrap,
  type V1AdminSnapshot,
} from '@/lib/core-v2/accounts/bootstrap-v1-admin';

const manifestSchema = z.object({
  finalSha: z.string().regex(/^[0-9a-f]{40}$/),
  databaseIdentity: z.string().min(1).max(128),
  migrationHead: z.string().regex(/^[0-9]{4}_[a-z0-9_]+$/),
  v1UserId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  expectedV1State: z.object({
    role: z.literal('ADMIN'),
    activated: z.literal(true),
    disabled: z.literal(false),
    merged: z.literal(false),
  }).strict(),
  capability: z.literal('ADMIN'),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  expiresAt: z.string().datetime(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

type Manifest = z.infer<typeof manifestSchema>;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

/** L'empreinte couvre tout le manifeste SAUF elle-même. */
function fingerprintOf(manifest: Manifest): string {
  const rest: Record<string, unknown> = { ...manifest };
  delete rest.fingerprint;
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

function loadManifest(path: string, now: Date): Manifest {
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o400) {
    throw new Error(`MANIFEST_PERMISSIONS:${mode.toString(8)} — attendu 0400, lisible par son seul propriétaire.`);
  }
  const parsed = manifestSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  if (fingerprintOf(parsed) !== parsed.fingerprint) {
    throw new Error('MANIFEST_FINGERPRINT_MISMATCH — le manifeste a été modifié après signature.');
  }
  if (new Date(parsed.expiresAt) <= now) {
    throw new Error(`MANIFEST_EXPIRED:${parsed.expiresAt} — un manifeste périmé ne peut plus autoriser l'amorçage.`);
  }
  return parsed;
}

/** L'identité V1 est lue sans jamais toucher à un champ de credential. */
async function readV1Admin(v1UserId: string): Promise<V1AdminSnapshot | null> {
  const row = await prisma.user.findUnique({
    where: { id: v1UserId },
    select: { id: true, role: true, activatedAt: true, disabledAt: true, mergedIntoUserId: true },
  });
  return row ? { ...row, role: String(row.role) } : null;
}

function assertManifestMatchesEnvironment(manifest: Manifest, identity: string, head: string): void {
  if (manifest.databaseIdentity !== identity) {
    throw new Error(`MANIFEST_DATABASE_MISMATCH — manifeste pour « ${manifest.databaseIdentity} », base « ${identity} ».`);
  }
  if (manifest.migrationHead !== head) {
    throw new Error(`MANIFEST_MIGRATION_HEAD_MISMATCH — manifeste pour « ${manifest.migrationHead} », base en « ${head} ».`);
  }
}

async function main(): Promise<number> {
  const manifestPath = arg('manifest');
  if (!manifestPath) {
    console.error('Usage: bootstrap-v1-admin --manifest=<chemin> (--dry-run | --apply | --verify | --rollback=<receiptId>)');
    return 2;
  }
  // Ce chemin n'existe QUE parce que Core v1 détient les identifiants. Sous un
  // autre mode, l'amorçage passe par le parcours Core ordinaire.
  if (!credentialAuthorityIsV1()) {
    console.error('CORE_V2_AUTH_MODE n’est pas V1_ONLY : cet amorçage ne s’applique pas à ce déploiement.');
    return 2;
  }

  const now = new Date();
  const manifest = loadManifest(manifestPath, now);
  const client = await requireCoreV2Client();
  try {
    const [identityRow] = await client.$queryRaw<Array<{ schemaIdentity: string }>>`
      SELECT "schemaIdentity" FROM core_v2_database_identity WHERE id = 1`;
    const [headRow] = await client.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name DESC LIMIT 1`;
    assertManifestMatchesEnvironment(manifest, identityRow?.schemaIdentity ?? '', headRow?.migration_name ?? '');

    const snapshot = await readV1Admin(manifest.v1UserId);

    if (process.argv.includes('--verify')) {
      const report = await verifyBootstrap(client, manifest.v1UserId);
      console.info(JSON.stringify({ mode: 'verify', ...report }));
      return report.ok ? 0 : 1;
    }

    if (process.argv.includes('--dry-run')) {
      // Aucune écriture : on prouve seulement que l'identité est éligible.
      const { assertEligibleV1Admin } = await import('@/lib/core-v2/accounts/bootstrap-v1-admin');
      assertEligibleV1Admin(snapshot, manifest.v1UserId);
      const admins = await client.user.count({ where: { role: 'ADMIN' } });
      console.info(JSON.stringify({
        mode: 'dry-run', eligible: true, v1UserId: manifest.v1UserId,
        existingCoreAdmins: admins, wouldProvision: admins === 0,
      }));
      return 0;
    }

    const rollbackReceipt = arg('rollback');
    if (rollbackReceipt) {
      // Le rollback retire l'acteur amorcé et SON reçu, rien d'autre, et
      // seulement si l'acteur n'a encore rien fait d'autre.
      const report = await verifyBootstrap(client, manifest.v1UserId);
      if (!report.ok) {
        console.error(JSON.stringify({ mode: 'rollback', refused: 'BOOTSTRAP_NOT_IN_EXPECTED_STATE', ...report }));
        return 1;
      }
      const otherAudit = await client.auditEvent.count({
        where: { actorUserId: manifest.v1UserId, action: { not: 'account.bootstrap_v1_admin' } },
      });
      if (otherAudit > 0) {
        console.error(JSON.stringify({ mode: 'rollback', refused: 'ACTOR_ALREADY_ACTED', otherAudit }));
        return 1;
      }
      await client.$transaction([
        client.auditEvent.deleteMany({ where: { id: rollbackReceipt, subjectId: manifest.v1UserId } }),
        client.user.delete({ where: { id: manifest.v1UserId } }),
      ]);
      console.info(JSON.stringify({ mode: 'rollback', removed: manifest.v1UserId }));
      return 0;
    }

    if (!process.argv.includes('--apply')) {
      console.error('Aucun mode fourni : --dry-run, --apply, --verify ou --rollback=<receiptId>.');
      return 2;
    }

    const eligible = snapshot as V1AdminSnapshot;
    const result = await bootstrapV1Admin(client, eligible, { nonce: manifest.nonce, now: () => now });
    console.info(JSON.stringify({ mode: 'apply', ...result }));
    return 0;
  } finally {
    await disconnectCoreV2Client();
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    // Jamais de pile ni de payload : un message court, sans secret.
    console.error(error instanceof Error ? error.message : 'BOOTSTRAP_FAILED');
    process.exit(1);
  });
