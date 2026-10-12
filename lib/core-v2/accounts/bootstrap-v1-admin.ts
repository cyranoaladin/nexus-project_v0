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
import { inTransaction } from '../services/context';

/** Verrou d'avis distinct de celui du bootstrap historique. */
const BOOTSTRAP_V1_ADMIN_LOCK = [4_242, 1_026] as const;

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
  outcome: 'PROVISIONED' | 'ALREADY_PROVISIONED';
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
  if (snapshot.role !== 'ADMIN') {
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
  snapshot: V1AdminSnapshot,
  options: { readonly nonce: string; readonly now?: () => Date },
): Promise<BootstrapOutcome> {
  const eligible = assertEligibleV1Admin(snapshot, snapshot.id);
  const at = (options.now ?? (() => new Date()))();

  return inTransaction(client, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_V1_ADMIN_LOCK[0]}::int, ${BOOTSTRAP_V1_ADMIN_LOCK[1]}::int)`;

    const already = await tx.user.findUnique({ where: { id: eligible.id } });
    if (already) {
      if (already.role !== 'ADMIN' || already.accountStatus !== 'ACTIVE') {
        throw new InvalidStateError('A Core row already exists for this identity in another state.', {
          code: 'CORE_ROW_CONFLICT', accountStatus: already.accountStatus, role: already.role,
        });
      }
      const receipt = await tx.auditEvent.findFirst({
        where: { action: 'account.bootstrap_v1_admin', subjectId: eligible.id },
        orderBy: { createdAt: 'asc' },
      });
      return { outcome: 'ALREADY_PROVISIONED', v1UserId: eligible.id, receiptId: receipt?.id ?? '' };
    }

    const admins = await tx.user.count({ where: { role: 'ADMIN' } });
    if (admins > 0) {
      throw new InvalidStateError(
        `The administrator bootstrap is closed: ${admins} Core ADMIN actor(s) already exist. ` +
          'Promote further administrators from an existing Core ADMIN, never through a bootstrap.',
        { code: 'BOOTSTRAP_CLOSED', existingAdminCount: admins },
      );
    }

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
        correlationId: options.nonce,
        // Aucune donnée secrète : un identifiant, un état attendu, un nonce.
        metadata: {
          v1UserId: eligible.id,
          v1Activated: eligible.activatedAt !== null,
          capability: 'ADMIN',
          nonce: options.nonce,
        },
      },
    });

    return { outcome: 'PROVISIONED', v1UserId: actor.id, receiptId: receipt.id };
  });
}

/** Vérification sans écriture : l'acteur attendu existe-t-il, et lui seul ? */
export async function verifyBootstrap(
  client: PrismaClient,
  v1UserId: string,
): Promise<Readonly<{ ok: boolean; admins: number; actorActive: boolean; receipts: number }>> {
  const [admins, actor, receipts] = await Promise.all([
    client.user.count({ where: { role: 'ADMIN' } }),
    client.user.findUnique({ where: { id: v1UserId } }),
    client.auditEvent.count({ where: { action: 'account.bootstrap_v1_admin', subjectId: v1UserId } }),
  ]);
  const actorActive = actor?.role === 'ADMIN' && actor.accountStatus === 'ACTIVE' && actor.password === null;
  return { ok: admins === 1 && actorActive && receipts >= 1, admins, actorActive, receipts };
}
