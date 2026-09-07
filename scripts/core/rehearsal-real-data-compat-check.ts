/**
 * Rehearsal-only fixture (Task 18, exact-baseline production-clone lane,
 * `scripts/core/rehearse-exact-baseline-migration.sh`). NOT imported by the
 * application.
 *
 * Confirms — against the freshly-migrated REAL-DATA clone, using this
 * branch's CURRENT (post-migration) application Prisma client, exactly as
 * the running application would — that:
 *   1. The new columns this migration adds
 *      (`coach_student_assignments.academicCourseKeys`/`courseScopeState`,
 *      `SessionBooking.studentProfileId`/`coachProfileId`, etc.) are
 *      genuinely additive/nullable: pre-existing rows remain fully readable
 *      without error.
 *   2. A couple of representative pre-existing real rows — referenced only
 *      by their opaque technical id (cuid), NEVER by name/email/phone — are
 *      readable end-to-end through the application client.
 *
 * No row content that could be personally identifying (name, email, phone)
 * is ever selected or printed. Only ids, enums, booleans, counts and dates
 * already treated as non-sensitive elsewhere in this rehearsal chain.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/core/rehearsal-real-data-compat-check.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/nexus_exact_baseline_rehearsal/.test(url)) {
    throw new Error('REHEARSAL_REAL_DATA_COMPAT_CHECK_REFUSED: DATABASE_URL does not target the exact-baseline rehearsal database');
  }

  // Two representative pre-existing assignments, oldest by id (real production
  // rows, never selected by name/email — id only).
  const assignments = await prisma.coachStudentAssignment.findMany({
    take: 2,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      status: true,
      courseScopeState: true,
      academicCourseKeys: true,
    },
  });
  if (assignments.length < 1) {
    throw new Error('REHEARSAL_REAL_DATA_COMPAT_CHECK_FAILED: no coach_student_assignments rows found');
  }
  for (const assignment of assignments) {
    if (assignment.courseScopeState === null || assignment.academicCourseKeys === null) {
      throw new Error(`REHEARSAL_REAL_DATA_COMPAT_CHECK_FAILED: new columns unexpectedly null on assignment id=${assignment.id}`);
    }
  }

  // Two representative pre-existing bookings, oldest by id.
  const bookings = await prisma.sessionBooking.findMany({
    take: 2,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      status: true,
      studentProfileId: true,
      coachProfileId: true,
      academicCourseKey: true,
      planningSeriesId: true,
    },
  });
  if (bookings.length < 1) {
    throw new Error('REHEARSAL_REAL_DATA_COMPAT_CHECK_FAILED: no SessionBooking rows found');
  }

  // Nullability contract check via information_schema — additive columns
  // must be nullable (no NOT NULL introduced on a column that can start
  // empty for existing rows), independent of the sampled rows above.
  const nullableCheck = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string }[]>(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'SessionBooking'
       AND column_name IN ('studentProfileId','coachProfileId','assignmentId','academicCourseKey','planningSeriesId','occurrenceKey','overridesBookingId')
     ORDER BY column_name;`,
  );
  const notNullable = nullableCheck.filter((row) => row.is_nullable !== 'YES');
  if (notNullable.length > 0) {
    throw new Error(`REHEARSAL_REAL_DATA_COMPAT_CHECK_FAILED: expected-nullable SessionBooking columns are NOT NULL: ${notNullable.map((r) => r.column_name).join(',')}`);
  }

  console.log(JSON.stringify({
    event: 'REHEARSAL_REAL_DATA_COMPAT_CHECK_PASS',
    assignmentsReadSample: assignments.length,
    bookingsReadSample: bookings.length,
    sessionBookingNewColumnsNullable: nullableCheck.length,
    sessionBookingNewColumnsNotNullableCount: notNullable.length,
  }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: 'REHEARSAL_REAL_DATA_COMPAT_CHECK_FAILED', message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
