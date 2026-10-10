/**
 * Unidirectional, idempotent V1 -> Core v2 STAFF-actor sync (Core v2 §3 data
 * authorities). V1 remains the SOLE identity authority — email, password and
 * sessions never move. This mirrors only staff IDENTITY ROWS into Core v2 so
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
 * Scope: roles ADMIN, ASSISTANTE, COACH. For COACH it also upserts the Core v2
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

export const STAFF_ROLES = ['ADMIN', 'ASSISTANTE', 'COACH'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface SourceStaffUser {
  readonly id: string;
  readonly email: string | null;
  readonly role: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly password: string | null;
  readonly activatedAt: Date | null;
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
 * that can authenticate in V1 (a password is set) are ACTIVE Core v2 actors;
 * otherwise they stay PENDING_ACTIVATION and resolveActor refuses them until
 * they can actually sign in. A password is never copied. coachProfileId is kept
 * only for COACH (the only role with a Core v2 coach-profile subject row).
 */
export function buildStaffActorRecord(user: SourceStaffUser): StaffActorRecord {
  if (!isStaffRole(user.role)) {
    throw new Error(`NOT_A_STAFF_ROLE: ${user.role} — only ${STAFF_ROLES.join('/')} are mirrored as actors`);
  }
  return {
    id: user.id,
    email: user.email ? normalizeEmail(user.email) : null,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    accountStatus: user.password ? 'ACTIVE' : 'PENDING_ACTIVATION',
    coachProfileId: user.role === 'COACH' ? user.coachProfileId : null,
  };
}

export interface SyncReport {
  readonly mode: 'DRY_RUN' | 'EXECUTE';
  readonly total: number;
  readonly byRole: Record<StaffRole, number>;
  readonly users: { created: number; updated: number; unchanged: number };
  readonly coachProfiles: { created: number; unchanged: number };
}

/**
 * Idempotently converges the given staff actor records into Core v2. Compares
 * the existing row to the desired state field-by-field so a re-run with no V1
 * change is a pure no-op (unchanged), and only genuine drift becomes an update.
 * Never deletes; never writes a password; never sets sessionVersion.
 */
export async function upsertStaffActors(
  coreV2: PrismaClient,
  records: readonly StaffActorRecord[],
  options: { execute: boolean },
): Promise<SyncReport> {
  const users = { created: 0, updated: 0, unchanged: 0 };
  const coachProfiles = { created: 0, unchanged: 0 };
  const byRole: Record<StaffRole, number> = { ADMIN: 0, ASSISTANTE: 0, COACH: 0 };

  for (const r of records) {
    byRole[r.role] += 1;
    const desired = {
      email: r.email,
      role: r.role,
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone,
      accountStatus: r.accountStatus,
    } as const;

    const existing = await coreV2.user.findUnique({
      where: { id: r.id },
      select: { email: true, role: true, firstName: true, lastName: true, phone: true, accountStatus: true },
    });

    if (!existing) {
      users.created += 1;
      if (options.execute) {
        await coreV2.user.create({ data: { id: r.id, password: null, ...desired } });
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
          await coreV2.user.update({ where: { id: r.id }, data: desired });
        }
      }
    }

    if (r.role === 'COACH' && r.coachProfileId) {
      const cp = await coreV2.coachProfile.findUnique({ where: { id: r.coachProfileId }, select: { id: true } });
      if (!cp) {
        coachProfiles.created += 1;
        // The user row exists by now (created/updated above) so the FK holds.
        if (options.execute) {
          await coreV2.coachProfile.create({ data: { id: r.coachProfileId, userId: r.id } });
        }
      } else {
        coachProfiles.unchanged += 1;
      }
    }
  }

  return { mode: options.execute ? 'EXECUTE' : 'DRY_RUN', total: records.length, byRole, users, coachProfiles };
}

/** Reads V1 staff (ADMIN/ASSISTANTE/COACH) and maps them to actor records. Read-only. */
export async function collectV1StaffActors(client: typeof coreV1 = coreV1): Promise<StaffActorRecord[]> {
  const users = await client.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true, password: true, activatedAt: true },
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
