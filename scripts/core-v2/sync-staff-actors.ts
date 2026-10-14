/**
 * Unidirectional, idempotent V1 -> Core v2 STAFF-actor sync (Core v2 §3 data
 * authorities). V1 remains the SOLE identity authority — email, password and
 * sessions never move. ADMIN is exclusively provisioned by bootstrap-v1-admin. This mirrors only staff IDENTITY ROWS into Core v2 so
 * that lib/core-v2/http/actor.ts `resolveActor()` can resolve a signed-in V1
 * staff session (matched BY ID) to a Core v2 actor. Without these rows every
 * v2 staff panel returns 403 ACTOR_NOT_IN_CORE_V2 in CORE_V2_AUTH_MODE=V1_ONLY.
 *
 * Why a dedicated tool (neither bootstrap-admin nor the roster migrator fits):
 *   - bootstrap-admin asserts the Core v2 account-email handoff, which THROWS
 *     in V1_ONLY, and it mints a fresh id that no V1 session would ever match;
 *   - the roster migrator (migrate-to-core-v2) requires >=1 approved student
 *     and only derives users from approved students' parents and assignment
 *     coaches — it never creates standalone ADMIN/ASSISTANTE actors.
 *
 * Scope: ASSISTANTE and COACH after an attested exclusive ADMIN bootstrap. For COACH it also upserts the Core v2
 * `coach_profiles_v2` subject row so the "Habilitations coachs" panel has
 * subjects. Capabilities are NOT stored per user — they are role-derived
 * (lib/core-v2/rbac.ts). Never touches PARENT/ELEVE, never writes a password,
 * never mutates V1, never deletes.
 *
 * Dry run by default; --execute to write. Idempotent (converges by V1 id).
 * Production-safe by construction: requireCoreV2Client() enforces the Core v2
 * identity marker and the CORE_V2_DATABASE_URL vs DATABASE_URL collision guard
 * before any write, and (unlike bootstrap-admin) it does not require Core v2
 * auth to be enabled — so this runs under V1_ONLY.
 *
 *   DATABASE_URL=<core v1, read only> CORE_V2_DATABASE_URL=<core v2 target> \
 *     npx tsx scripts/core-v2/sync-staff-actors.ts [--execute]
 *
 * Exit codes: 0 done (or dry run), 1 refused before writing anything.
 */
import { prisma as coreV1 } from '@/lib/prisma';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { normalizeEmail } from '@/lib/core-v2/contact';
import type { PrismaClient } from '@/core-v2/generated/client';
import { assertBootstrapAttested, lockV1AdminBootstrap } from '@/lib/core-v2/accounts/bootstrap-v1-admin';
import { inTransaction } from '@/lib/core-v2/services/context';

// Autorite unique : lib/core-v2/rbac.ts. On IMPORTE (pour l'usage local) puis on
// reexporte (pour les consommateurs). Un simple `export ... from` exposerait le
// binding sans l'amener dans la portee du module : isStaffRole leverait alors
// ReferenceError.
import { STAFF_ROLES, SYNC_STAFF_ROLES, isSyncStaffRole, subjectHasRole, type StaffRole } from '@/lib/core-v2/rbac';
export { STAFF_ROLES, type StaffRole };

export interface SourceStaffUser {
  readonly id: string;
  readonly email: string | null;
  readonly role: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phone: string | null;
  /** Legacy fixture compatibility only; never selected or inspected by the sync. */
  readonly password?: string | null;
  readonly activatedAt: Date | null;
  readonly disabledAt?: Date | null;
  readonly mergedIntoUserId?: string | null;
  /** V1 coach_profiles.id for a COACH, else null. */
  readonly coachProfileId: string | null;
}

export interface StaffActorRecord {
  readonly id: string;
  readonly email: string | null;
  readonly role: StaffRole;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly accountStatus: 'ACTIVE' | 'PENDING_ACTIVATION';
  readonly coachProfileId: string | null;
}

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/**
 * Pure mapping V1 staff user -> Core v2 actor record. V1 is authority: staff
 * that are activated in V1 become initially ACTIVE Core v2 actors;
 * otherwise they stay PENDING_ACTIVATION and resolveActor refuses them until
 * they can actually sign in. A password is never copied. coachProfileId is kept
 * only for COACH (the only role with a Core v2 coach-profile subject row).
 */
export function buildStaffActorRecord(user: SourceStaffUser): StaffActorRecord {
  if (!isSyncStaffRole(user.role)) throw new Error('NOT_SYNC_STAFF_ROLE');
  if (user.disabledAt || user.mergedIntoUserId) throw new Error('V1_STAFF_IDENTITY_INELIGIBLE');
  return {
    id: user.id,
    email: user.email ? normalizeEmail(user.email) : null,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    accountStatus: user.activatedAt ? 'ACTIVE' : 'PENDING_ACTIVATION',
    coachProfileId: user.role === 'COACH' ? user.coachProfileId : null,
  };
}

export interface SyncReport {
  readonly mode: 'DRY_RUN' | 'EXECUTE';
  readonly total: number;
  readonly byRole: Record<StaffRole, number>;
  readonly users: { created: number; updated: number; unchanged: number };
  readonly coachProfiles: { created: number; unchanged: number };
  readonly adminCreates: 0;
  readonly adminPromotions: 0;
}

/**
 * Idempotently converges the given staff actor records into Core v2. Compares
 * the existing row to the desired state field-by-field so a re-run with no V1
 * change is a pure no-op (unchanged), and only genuine drift becomes an update.
 * Never deletes or writes credentials; preserves existing Core membership state.
 */
export async function upsertStaffActors(
  coreV2: PrismaClient,
  records: readonly StaffActorRecord[],
  options: { execute: boolean },
): Promise<SyncReport> {
  // Validate the entire batch before opening a mutation path. ADMIN, including
  // case variants, is never a synchronization input.
  for (const r of records) if (!isSyncStaffRole(r.role)) throw new Error('NOT_SYNC_STAFF_ROLE');
  return inTransaction(coreV2, async (tx) => {
  await lockV1AdminBootstrap(tx);
  const bootstrapAdminId = await assertBootstrapAttested(tx);
  const users = { created: 0, updated: 0, unchanged: 0 };
  const coachProfiles = { created: 0, unchanged: 0 };
  const byRole: Record<StaffRole, number> = { ADMIN: 0, ASSISTANTE: 0, COACH: 0 };

  for (const r of records) {
    byRole[r.role] += 1;
    const desiredIdentity = {
      email: r.email,
      role: r.role,
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone,
    } as const;

    const existing = await tx.user.findUnique({
      where: { id: r.id },
      select: { email: true, role: true, firstName: true, lastName: true, phone: true, accountStatus: true },
    });
    // Provenance was validated for ALL administrators under the shared lock.
    // A legitimate Core promotion takes precedence over the old V1 staff role.
    if (existing && subjectHasRole(existing, 'ADMIN')) { users.unchanged += 1; continue; }
    if (existing && existing.role !== r.role) throw new Error('SYNC_ROLE_CONFLICT');
    // Core membership is authoritative. A V1 snapshot never reactivates a
    // suspended/disabled Core actor, or undoes a pending Core decision.
    const desired = { ...desiredIdentity, accountStatus: existing?.accountStatus ?? r.accountStatus };

    if (!existing) {
      users.created += 1;
      if (options.execute) {
        await tx.user.create({ data: { id: r.id, password: null, ...desired } });
        await tx.auditEvent.create({ data: { actorUserId: bootstrapAdminId, action: 'staff.sync_user_created',
          subjectType: 'User', subjectId: r.id, correlationId: `staff-sync:${r.id}`,
          metadata: { bootstrapAdminId, role: r.role } } });
      }
    } else {
      const matches =
        existing.email === desired.email &&
        existing.role === desired.role &&
        existing.firstName === desired.firstName &&
        existing.lastName === desired.lastName &&
        existing.phone === desired.phone &&
        existing.accountStatus === desired.accountStatus;
      if (matches) {
        users.unchanged += 1;
      } else {
        users.updated += 1;
        if (options.execute) {
          // Drift in a staff actor's identity/role/status is session-sensitive
          // (mirror of lib/core-v2/services/household.ts / student.ts): bump
          // sessionVersion so a changed login identifier, role, or a transition
          // out of ACTIVE revokes any Core v2 session. This fires only on real
          // drift (guarded by `matches` above), so idempotency is preserved —
          // a re-run with no V1 change performs no update and no version bump.
          const { role: _role, accountStatus: _status, ...identityUpdate } = desired;
          const updated = await tx.user.updateMany({
            where: { id: r.id, role: r.role },
            data: { ...identityUpdate, sessionVersion: { increment: 1 } },
          });
          if (updated.count !== 1) throw new Error('SYNC_ROLE_CONFLICT');
        }
      }
    }

    if (r.role === 'COACH' && r.coachProfileId) {
      const cp = await tx.coachProfile.findUnique({ where: { id: r.coachProfileId }, select: { id: true, userId: true } });
      if (cp && cp.userId !== r.id) throw new Error('SYNC_COACH_PROFILE_IDENTITY_CONFLICT');
      if (!cp) {
        coachProfiles.created += 1;
        // The user row exists by now (created/updated above) so the FK holds.
        if (options.execute) {
          await tx.coachProfile.create({ data: { id: r.coachProfileId, userId: r.id } });
        }
      } else {
        coachProfiles.unchanged += 1;
      }
    }
  }

  return { mode: options.execute ? 'EXECUTE' : 'DRY_RUN', total: records.length, byRole, users, coachProfiles,
    adminCreates: 0, adminPromotions: 0 };
  });
}

/** Reads V1 non-ADMIN staff (ASSISTANTE/COACH) and maps them to actor records. Read-only. */
export async function collectV1StaffActors(client: typeof coreV1 = coreV1): Promise<StaffActorRecord[]> {
  const users = await client.user.findMany({
    where: { role: { in: [...SYNC_STAFF_ROLES] }, disabledAt: null, mergedIntoUserId: null },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true,
      activatedAt: true, disabledAt: true, mergedIntoUserId: true },
  });
  const profiles = await client.coachProfile.findMany({ select: { id: true, userId: true } });
  const coachProfileByUser = new Map(profiles.map((p) => [p.userId, p.id]));
  return users.map((u) =>
    buildStaffActorRecord({ ...u, coachProfileId: coachProfileByUser.get(u.id) ?? null }),
  );
}

async function main(): Promise<number> {
  const execute = process.argv.includes('--execute');
  const records = await collectV1StaffActors();
  const coreV2 = (await requireCoreV2Client()) as unknown as PrismaClient;
  const report = await upsertStaffActors(coreV2, records, { execute });
  console.log(
    `[sync-staff-actors] ${report.mode} total=${report.total} ` +
      `ADMIN=${report.byRole.ADMIN} ASSISTANTE=${report.byRole.ASSISTANTE} COACH=${report.byRole.COACH} ` +
      `users(created=${report.users.created},updated=${report.users.updated},unchanged=${report.users.unchanged}) ` +
      `coachProfiles(created=${report.coachProfiles.created},unchanged=${report.coachProfiles.unchanged})`,
      `adminCreates=${report.adminCreates} adminPromotions=${report.adminPromotions}`,
  );
  return 0;
}

// Run only as a script, not when imported by tests.
if (require.main === module) {
  main()
    .then(async (code) => {
      await disconnectCoreV2Client().catch(() => undefined);
      await coreV1.$disconnect().catch(() => undefined);
      process.exit(code);
    })
    .catch(async (error) => {
      console.error('[sync-staff-actors] REFUSED', error instanceof Error ? error.message : error);
      await disconnectCoreV2Client().catch(() => undefined);
      await coreV1.$disconnect().catch(() => undefined);
      process.exit(1);
    });
}
