/**
 * Amorçage du PREMIER administrateur Core v2 à partir d'un ADMIN Core v1 déjà
 * actif — jamais par invitation, jamais avec un credential Core.
 *
 * Sous `CORE_V2_AUTH_MODE=V1_ONLY`, Core v1 est la seule autorité des
 * identifiants. Un ADMIN ne peut donc pas être « invité » : l'invitation
 * suppose un parcours d'activation, et l'activation d'un ADMIN par lien est
 * interdite (lib/auth/v1-account-invitation.ts). Le premier ADMIN Core est donc
 * RATTACHÉ à une identité V1 existante, et rien d'autre n'est créé.
 *
 * Ce module n'écrit JAMAIS, ni ne lit, ni ne copie : mot de passe, hash, jeton,
 * réinitialisation ou session. Il ne pose que l'acteur, son rôle, l'état du
 * rattachement et un reçu d'audit.
 *
 * Il n'existe aucun endpoint HTTP d'amorçage : l'opération est hors ligne, et
 * autorisée par un manifeste (voir scripts/core-v2/bootstrap-v1-admin.ts).
 */
import type { PrismaClient, User } from '@/core-v2/generated/client';
import { InvalidStateError, NotFoundError, ValidationError } from '../errors';
import { subjectHasRole, isAdminPromotionRoleProof } from '../rbac';
import { inTransaction, type Tx } from '../services/context';
import { canonicalBootstrapJson, parseBootstrapManifest, type BootstrapManifest } from './bootstrap-manifest';
import { assertBootstrapSchema } from './bootstrap-schema';

/** Verrou d'avis distinct de celui du bootstrap historique. */
const BOOTSTRAP_V1_ADMIN_LOCK = [4_242, 1_026] as const;

export async function lockV1AdminBootstrap(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_V1_ADMIN_LOCK[0]}::int, ${BOOTSTRAP_V1_ADMIN_LOCK[1]}::int)`;
}

/** Must be checked under the bootstrap lock before any staff synchronization. */
export async function assertBootstrapAttested(tx: Tx): Promise<string> {
  await assertBootstrapSchema(tx);
  const [attestation, receipts, admins, identity] = await Promise.all([
    tx.coreAdminBootstrap.findUnique({ where: { id: 1 } }),
    tx.auditEvent.findMany({ where: { action: 'account.bootstrap_v1_admin' } }),
    tx.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, accountStatus: true, password: true } }),
    tx.coreV2DatabaseIdentity.findUnique({ where: { id: 1 } }),
  ]);
  if (!attestation && receipts.length === 0 && admins.length === 0) throw new InvalidStateError('BOOTSTRAP_REQUIRED');
  if (!attestation || receipts.length !== 1 || admins.length === 0 || !identity) {
    throw new InvalidStateError('UNATTESTED_ADMIN_STATE');
  }
  let manifest: BootstrapManifest;
  try { manifest = parseBootstrapManifest(attestation.manifest); }
  catch { throw new InvalidStateError('UNATTESTED_ADMIN_STATE'); }
  const receipt = receipts[0];
  const firstAdmin = admins.find(admin => admin.id === attestation.v1UserId);
  if (!firstAdmin || receipt.subjectType !== 'User' || receipt.id !== attestation.receiptId || receipt.subjectId !== firstAdmin.id
    || receipt.actorUserId !== firstAdmin.id || firstAdmin.password !== null
    || manifest.databaseIdentity !== identity.instanceId || manifest.v1UserId !== attestation.v1UserId
    || manifest.nonce !== attestation.nonce || receipt.correlationId !== attestation.nonce
    || manifest.fingerprint !== attestation.fingerprint
    || canonicalBootstrapJson(receipt.metadata) !== canonicalBootstrapJson(manifest)) {
    throw new InvalidStateError('UNATTESTED_ADMIN_STATE');
  }
  const promotions = await tx.auditEvent.findMany({ where: { action: 'account.admin_promoted' } });
  if (promotions.length !== admins.length - 1) throw new InvalidStateError('UNATTESTED_ADMIN_STATE');
  for (const admin of admins.filter(candidate => candidate.id !== firstAdmin.id)) {
    const proof = promotions.filter(candidate => candidate.subjectId === admin.id);
    const metadata = proof[0]?.metadata as Record<string, unknown> | null;
    if (admin.password !== null || proof.length !== 1 || proof[0].subjectType !== 'User'
      || !admins.some(candidate => candidate.id === proof[0].actorUserId)
      || metadata?.targetId !== admin.id || metadata.actorId !== proof[0].actorUserId
      || !isAdminPromotionRoleProof(metadata.role, metadata.fromRole)
      || metadata.commandId !== proof[0].correlationId || metadata.bootstrapFingerprint !== attestation.fingerprint
      || metadata.databaseIdentity !== identity.instanceId || metadata.operation !== 'CORE_ADMIN_PROMOTION'
      || typeof metadata.releaseSha !== 'string' || !/^[a-f0-9]{40}$/.test(metadata.releaseSha)
      || typeof metadata.authorizationTxid !== 'string' || !/^[0-9]+$/.test(metadata.authorizationTxid)
      || !Number.isSafeInteger(metadata.issuerV1Version) || Number(metadata.issuerV1Version) < 0
      || !Number.isSafeInteger(metadata.targetCoreSessionVersion) || Number(metadata.targetCoreSessionVersion) < 0)
      throw new InvalidStateError('UNATTESTED_ADMIN_STATE');
  }
  const migrations = await tx.$queryRaw<Array<{ ready: boolean }>>`
    SELECT EXISTS(SELECT 1 FROM public."_prisma_migrations" WHERE migration_name = ${manifest.migrationHead}
      AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS ready`;
  if (migrations[0]?.ready !== true) throw new InvalidStateError('UNATTESTED_ADMIN_STATE');
  return firstAdmin.id;
}

/** Un identifiant V1 est opaque et immuable : jamais une adresse e-mail. */
const V1_USER_ID = /^[A-Za-z0-9_-]{8,128}$/;

export type V1AdminSnapshot = Readonly<{
  id: string;
  role: string;
  activatedAt: Date | null;
  disabledAt: Date | null;
  mergedIntoUserId: string | null;
}>;

export type BootstrapOutcome = Readonly<{
  /** `ALREADY_PROVISIONED` rend l'opération idempotente. */
  outcome: 'PROVISIONED' | 'ALREADY_PROVISIONED' | 'READY';
  v1UserId: string;
  receiptId: string;
}>;

/**
 * L'identité V1 doit être un ADMIN activé, non désactivé et non fusionné. Toute
 * autre forme est refusée sans rien écrire : amorcer depuis une identité
 * ambiguë reviendrait à fabriquer un administrateur.
 */
export function assertEligibleV1Admin(snapshot: V1AdminSnapshot | null, expectedId: string): V1AdminSnapshot {
  if (!V1_USER_ID.test(expectedId)) {
    throw new ValidationError('The v1 user id is not a well-formed opaque identifier.');
  }
  if (!snapshot) throw new NotFoundError('No v1 account carries this identifier.');
  if (snapshot.id !== expectedId) {
    throw new ValidationError('The resolved v1 account does not carry the expected identifier.');
  }
  // Comparaison deleguee a rbac.ts : aucun fichier Core v2 ne decide d'un role
  // en ligne (CORE_V2_NO_INLINE_RBAC).
  if (!subjectHasRole({ role: snapshot.role as never }, 'ADMIN')) {
    throw new InvalidStateError('The v1 account is not an administrator.', { code: 'V1_NOT_ADMIN' });
  }
  if (snapshot.activatedAt === null) {
    throw new InvalidStateError('The v1 administrator is not activated.', { code: 'V1_NOT_ACTIVATED' });
  }
  if (snapshot.disabledAt !== null) {
    throw new InvalidStateError('The v1 administrator is disabled.', { code: 'V1_DISABLED' });
  }
  if (snapshot.mergedIntoUserId !== null) {
    throw new InvalidStateError('The v1 administrator was merged into another account.', { code: 'V1_MERGED' });
  }
  return snapshot;
}

/**
 * Rattache l'ADMIN V1 vérifié comme premier acteur Core ADMIN.
 *
 * Transactionnel, idempotent et protégé contre deux exécutions concurrentes par
 * un verrou d'avis. Refuse toute nouvelle utilisation dès qu'un acteur ADMIN
 * existe : l'amorçage est à usage unique, les ADMIN suivants sont promus par un
 * ADMIN Core existant.
 */
export async function bootstrapV1Admin(
  client: PrismaClient,
  snapshot: V1AdminSnapshot | null,
  options: { readonly nonce: string; readonly expectedV1UserId: string; readonly manifest: unknown;
    readonly expectedReleaseSha: string | null; readonly now?: () => Date; readonly dryRun?: boolean;
    readonly expectedMigrationHead?: string;
    readonly readAuthoritativeV1?: () => Promise<V1AdminSnapshot | null>;
    readonly verifyAuthoritativeV1?: () => Promise<void> },
): Promise<BootstrapOutcome> {
  // L'identifiant ATTENDU vient du manifeste, jamais de l'instantané lu : le
  // comparer à lui-même rendrait la vérification tautologique, et le mode
  // `--apply` n'aurait alors pas la même liaison que `--dry-run`.
  const manifest = parseBootstrapManifest(options.manifest);
  if (manifest.v1UserId !== options.expectedV1UserId || (snapshot && snapshot.id !== manifest.v1UserId)) {
    throw new InvalidStateError('MANIFEST_V1_IDENTITY_MISMATCH');
  }
  if (manifest.nonce !== options.nonce) throw new InvalidStateError('MANIFEST_INVALID');
  const at = (options.now ?? (() => new Date()))();
  if (!Number.isFinite(at.getTime()) || new Date(manifest.expiresAt) <= at) throw new InvalidStateError('MANIFEST_EXPIRED');
  if (manifest.finalSha !== options.expectedReleaseSha) throw new InvalidStateError('MANIFEST_RELEASE_MISMATCH');
  if (options.expectedMigrationHead !== undefined && manifest.migrationHead !== options.expectedMigrationHead)
    throw new InvalidStateError('MANIFEST_MIGRATION_HEAD_MISMATCH');

  return inTransaction(client, async (tx) => {
    await lockV1AdminBootstrap(tx);
    const dirty = await tx.$queryRaw<Array<{ dirty: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS dirty`;
    if (dirty[0]?.dirty !== false) throw new InvalidStateError('BOOTSTRAP_MIGRATIONS_INCOMPLETE');
    await assertBootstrapSchema(tx);
    const authoritative = options.readAuthoritativeV1 ? await options.readAuthoritativeV1() : snapshot;
    const eligible = assertEligibleV1Admin(authoritative, manifest.v1UserId);
    if (new Date(manifest.expiresAt) <= (options.now ?? (() => new Date()))()) throw new InvalidStateError('MANIFEST_EXPIRED');
    const identity = await tx.coreV2DatabaseIdentity.findUnique({ where: { id: 1 } });
    if (manifest.databaseIdentity !== identity?.instanceId) throw new InvalidStateError('MANIFEST_DATABASE_MISMATCH');
    const [head] = await tx.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1`;
    if (manifest.migrationHead !== head?.migration_name) throw new InvalidStateError('MANIFEST_MIGRATION_HEAD_MISMATCH');
    const attestation = await tx.coreAdminBootstrap.findUnique({ where: { id: 1 } });
    const [adminCount, receiptCount, existing] = await Promise.all([
      tx.user.count({ where: { role: 'ADMIN' } }),
      tx.auditEvent.count({ where: { action: 'account.bootstrap_v1_admin' } }),
      tx.user.findUnique({ where: { id: eligible.id } }),
    ]);
    if (attestation) {
      await assertBootstrapAttested(tx);
      if (attestation.v1UserId !== eligible.id || attestation.fingerprint !== manifest.fingerprint) {
        throw new InvalidStateError(attestation.nonce === manifest.nonce ? 'BOOTSTRAP_MANIFEST_REPLAY' : 'BOOTSTRAP_CLOSED');
      }
      return { outcome: 'ALREADY_PROVISIONED', v1UserId: eligible.id, receiptId: attestation.receiptId };
    }
    if (adminCount !== 0 || receiptCount !== 0 || existing) throw new InvalidStateError('UNATTESTED_ADMIN_STATE');
    if (options.dryRun) return { outcome: 'READY', v1UserId: eligible.id, receiptId: '' };
    await options.verifyAuthoritativeV1?.();
    if (new Date(manifest.expiresAt) <= (options.now ?? (() => new Date()))()) throw new InvalidStateError('MANIFEST_EXPIRED');

    // L'acteur porte l'identifiant V1 : c'est le rattachement. Aucun mot de
    // passe, aucun hash, aucun jeton — Core v1 reste la seule autorité.
    const actor: User = await tx.user.create({
      data: { id: eligible.id, role: 'ADMIN', accountStatus: 'ACTIVE', activatedAt: at },
    });

    const receipt = await tx.auditEvent.create({
      data: {
        actorUserId: actor.id,
        action: 'account.bootstrap_v1_admin',
        subjectType: 'User',
        subjectId: actor.id,
        correlationId: manifest.nonce,
        metadata: manifest,
      },
    });
    await tx.coreAdminBootstrap.create({ data: { id: 1, v1UserId: actor.id, receiptId: receipt.id,
      nonce: manifest.nonce, fingerprint: manifest.fingerprint, manifest } });
    // A lost V1 connection/lock after its initial read must abort Core too.
    // This live heartbeat is inside the Core transaction, after its writes.
    await options.verifyAuthoritativeV1?.();

    if (new Date(manifest.expiresAt) <= (options.now ?? (() => new Date()))()) throw new InvalidStateError('MANIFEST_EXPIRED');

    return { outcome: 'PROVISIONED', v1UserId: actor.id, receiptId: receipt.id };
  });
}

/** Vérification sans écriture : l'acteur attendu existe-t-il, et lui seul ? */
export async function verifyBootstrap(
  client: PrismaClient,
  v1UserId: string,
): Promise<Readonly<{ ok: boolean; admins: number; actorActive: boolean; receipts: number }>> {
  return inTransaction(client, async tx => {
    await lockV1AdminBootstrap(tx);
    const attestedId = await assertBootstrapAttested(tx);
    if (attestedId !== v1UserId) throw new InvalidStateError('UNATTESTED_ADMIN_STATE');
    const [admins, promotions] = await Promise.all([
      tx.user.findMany({ where: { role: 'ADMIN' }, select: { accountStatus: true } }),
      tx.auditEvent.count({ where: { action: 'account.admin_promoted' } }),
    ]);
    if (admins.length !== 1 || admins[0].accountStatus !== 'ACTIVE' || promotions !== 0) {
      throw new InvalidStateError('INITIAL_ADMIN_GATE_NOT_READY');
    }
    return { ok: true, admins: 1, actorActive: true, receipts: 1 };
  });
}
