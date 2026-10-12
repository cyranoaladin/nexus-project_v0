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
 * SHA de release, une base, une tête de migrations, une identité V1 et son état
 * attendu, un nonce et une expiration. Chacune de ces liaisons est RÉELLEMENT
 * comparée à l'environnement ; l'empreinte est recalculée sur une sérialisation
 * canonique à toute profondeur, donc un manifeste modifié est refusé.
 *
 * Ce n'est PAS le seul chemin vers un acteur Core ADMIN, et il ne faut pas le
 * lire comme tel : `sync-staff-actors --execute` reflète dans Core tout
 * ADMIN/ASSISTANTE/COACH de V1, et crée donc un ADMIN Core sans manifeste. Ce
 * n'est pas une élévation — il faut déjà être ADMIN en V1 et avoir un accès
 * shell — mais l'ordre compte : si la synchronisation passe d'abord, un acteur
 * ADMIN existe et cet amorçage refuse avec `BOOTSTRAP_CLOSED`. Aucun mécanisme
 * n'impose cet ordre ; il appartient à la procédure de go-live.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { credentialAuthorityIsV1 } from '@/lib/core-v2/accounts/v1-authority';
import { readRunningReleaseSha } from '@/lib/core-v2/diagnostics/release-identity';
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

/**
 * Sérialisation canonique : clés triées à TOUTE profondeur.
 *
 * L'implémentation précédente passait `Object.keys(rest).sort()` comme replacer
 * de `JSON.stringify`. Un replacer tableau est une liste blanche appliquée
 * RÉCURSIVEMENT : les clés imbriquées d'`expectedV1State` n'y figuraient pas,
 * donc cet objet se sérialisait en `{}` et un état V1 entièrement falsifié
 * produisait la MÊME empreinte. Mesuré, pas supposé.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
}

/** L'empreinte couvre tout le manifeste SAUF elle-même, à toute profondeur. */
function fingerprintOf(manifest: Manifest): string {
  const rest: Record<string, unknown> = { ...manifest };
  delete rest.fingerprint;
  return createHash('sha256').update(canonicalize(rest)).digest('hex');
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

function assertManifestMatchesEnvironment(manifest: Manifest, identity: string, head: string, releaseSha: string | null): void {
  if (manifest.databaseIdentity !== identity) {
    throw new Error(`MANIFEST_DATABASE_MISMATCH — manifeste pour « ${manifest.databaseIdentity} », base « ${identity} ».`);
  }
  if (manifest.migrationHead !== head) {
    throw new Error(`MANIFEST_MIGRATION_HEAD_MISMATCH — manifeste pour « ${manifest.migrationHead} », base en « ${head} ».`);
  }
  // `finalSha` était parsé, empreinté et documenté comme liant — et comparé à
  // rien. Un manifeste taillé pour une release pouvait donc être rejoué, intact
  // et dans sa fenêtre, contre une AUTRE release sur la même base.
  if (releaseSha === null) {
    throw new Error('RELEASE_IDENTITY_UNAVAILABLE — l’amorçage n’a lieu que depuis une release vérifiée, '
      + 'la seule situation où le SHA que le manifeste prétend lier peut être établi.');
  }
  if (manifest.finalSha !== releaseSha) {
    throw new Error(`MANIFEST_RELEASE_MISMATCH — manifeste pour « ${manifest.finalSha} », release « ${releaseSha} ».`);
  }
}

/**
 * L'état V1 déclaré au manifeste doit correspondre à l'état LU. Sans cela, le
 * manifeste décrit une intention que personne ne confronte au réel.
 */
function assertManifestMatchesV1State(manifest: Manifest, snapshot: V1AdminSnapshot | null): void {
  if (!snapshot) throw new Error('V1_IDENTITY_NOT_FOUND — aucun compte V1 ne porte cet identifiant.');
  const observed = {
    role: String(snapshot.role),
    activated: snapshot.activatedAt !== null,
    disabled: snapshot.disabledAt !== null,
    merged: snapshot.mergedIntoUserId !== null,
  };
  const expected = manifest.expectedV1State;
  if (observed.role !== expected.role
    || observed.activated !== expected.activated
    || observed.disabled !== expected.disabled
    || observed.merged !== expected.merged) {
    // Aucune donnée d'identité dans le message : seuls les champs divergents.
    const diverging = (Object.keys(expected) as Array<keyof typeof expected>)
      .filter((key) => observed[key] !== expected[key]);
    throw new Error(`MANIFEST_V1_STATE_MISMATCH — champs divergents : ${diverging.join(', ')}.`);
  }
  if (manifest.capability !== 'ADMIN' || observed.role !== 'ADMIN') {
    throw new Error('MANIFEST_CAPABILITY_MISMATCH — cet amorçage ne crée qu’un ADMIN.');
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
    const releaseSha = await readRunningReleaseSha();
    assertManifestMatchesEnvironment(manifest, identityRow?.schemaIdentity ?? '', headRow?.migration_name ?? '', releaseSha);

    const snapshot = await readV1Admin(manifest.v1UserId);
    assertManifestMatchesV1State(manifest, snapshot);

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
      // Le reçu doit EXISTER et porter l'action d'amorçage. Un `deleteMany` sur
      // un identifiant erroné supprimait 0 ligne, laissait le reçu en place, et
      // la commande annonçait quand même « removed » — un rollback qui réussit
      // en apparence tout en laissant une trace contradictoire.
      const receipt = await client.auditEvent.findFirst({
        where: { id: rollbackReceipt, subjectId: manifest.v1UserId, action: 'account.bootstrap_v1_admin' },
      });
      if (!receipt) {
        console.error(JSON.stringify({ mode: 'rollback', refused: 'RECEIPT_NOT_FOUND' }));
        return 1;
      }
      await client.$transaction([
        client.auditEvent.delete({ where: { id: receipt.id } }),
        client.user.delete({ where: { id: manifest.v1UserId } }),
        // Un rollback n'EFFACE pas l'histoire : il la compense. Sans cette
        // écriture, la seule trace de l'amorçage serait celle qu'on supprime,
        // et un `--apply` ultérieur paraîtrait être le premier.
        client.auditEvent.create({
          data: {
            action: 'account.bootstrap_v1_admin.rolled_back',
            subjectType: 'User',
            subjectId: manifest.v1UserId,
            metadata: { nonce: manifest.nonce, receiptId: receipt.id, migrationHead: manifest.migrationHead },
          },
        }),
      ]);
      console.info(JSON.stringify({ mode: 'rollback', removed: manifest.v1UserId, compensated: receipt.id }));
      return 0;
    }

    if (!process.argv.includes('--apply')) {
      console.error('Aucun mode fourni : --dry-run, --apply, --verify ou --rollback=<receiptId>.');
      return 2;
    }

    // L'identifiant attendu vient du MANIFESTE, pas de l'instantané : les deux
    // modes appliquent ainsi la même liaison, et un identifiant introuvable
    // produit le refus prévu au lieu d'un déréférencement de `null`.
    const result = await bootstrapV1Admin(client, snapshot, {
      nonce: manifest.nonce, expectedV1UserId: manifest.v1UserId, now: () => now,
    });
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
