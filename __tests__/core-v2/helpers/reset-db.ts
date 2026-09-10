import type { PrismaClient } from '@/core-v2/generated/client';

/**
 * Wipes every Core v2 table via a single CASCADE truncate, restarting
 * identities. Order-independent (CASCADE resolves FK order), safe to call
 * before every test for full isolation. Never touches Core v1 tables — the
 * table list below is exhaustive against core-v2/prisma/schema.prisma's
 * @@map names, not a wildcard "all tables in the database" statement.
 */
export async function resetCoreV2Database(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe(`
    TRUNCATE TABLE
      "session_bookings_v2",
      "planning_series_v2",
      "coach_student_course_assignments",
      "coach_course_capabilities",
      "coach_profiles_v2",
      "student_course_enrollments",
      "student_academic_year_enrollments",
      "students_v2",
      "household_parents",
      "households",
      "academic_years",
      "users"
    RESTART IDENTITY CASCADE;
  `);
}
