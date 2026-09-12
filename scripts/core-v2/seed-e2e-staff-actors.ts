/**
 * Disposable-stack only: mirrors the seeded Core v1 STAFF and COACH accounts
 * into the Core v2 database with the SAME ids, so the session→actor mapping
 * (lib/core-v2/http/actor.ts) resolves them and the staff API / UI can be
 * exercised end to end. This is the explicit "migrated-actor authority
 * mapping" of §S/§V for the test stack — not the production migrator
 * (scripts/core-v2/extract-to-core-v2.ts stays fail-closed).
 *
 * Refuses to run outside a disposable stack, refuses a Core v2 target that
 * collides with DATABASE_URL (client guard), and never touches PARENT/ELEVE
 * rows: those are created through the Core v2 services by the scenarios.
 */
import { prisma as coreV1 } from '@/lib/prisma';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';

const MIRRORED_ROLES = ['ADMIN', 'ASSISTANTE', 'COACH'] as const;

async function main(): Promise<void> {
  if (process.env.E2E_DISPOSABLE_STACK !== '1' && process.env.NEXUS_DISPOSABLE_POSTGRES !== '1') {
    throw new Error('SEED_E2E_STAFF_ACTORS_REFUSED: only for a disposable E2E stack (E2E_DISPOSABLE_STACK=1).');
  }
  const coreV2 = await requireCoreV2Client();
  const staff = await coreV1.user.findMany({
    where: { role: { in: [...MIRRORED_ROLES] } },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true, password: true, sessionVersion: true },
  });

  let mirrored = 0;
  for (const user of staff) {
    if (!user.email) continue;
    await coreV2.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email.trim().toLowerCase(),
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        password: user.password,
        sessionVersion: user.sessionVersion,
        accountStatus: 'ACTIVE',
        activatedAt: new Date(),
      },
      update: {
        email: user.email.trim().toLowerCase(),
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        password: user.password,
        // Re-seeding rewrites credentials: revoke any Core v2 session like every other credential write.
        sessionVersion: { increment: 1 },
        accountStatus: 'ACTIVE',
      },
    });
    if (user.role === 'COACH') {
      await coreV2.coachProfile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    }
    mirrored += 1;
  }
  console.log(`[seed-e2e-staff-actors] mirrored ${mirrored} staff/coach account(s) into Core v2 (same ids).`);
  await disconnectCoreV2Client();
  await coreV1.$disconnect();
}

main().catch(async (error) => {
  console.error('[seed-e2e-staff-actors] FAILED', error instanceof Error ? error.message : error);
  await disconnectCoreV2Client().catch(() => undefined);
  await coreV1.$disconnect().catch(() => undefined);
  process.exit(1);
});
