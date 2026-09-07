/**
 * Rehearsal-only fixture (Task 18, `scripts/core/rehearse-core-migration.sh`).
 * NOT imported by the application. Seeds a minimal, entirely synthetic,
 * pre-migration-shaped dataset into the isolated "synthetic" rehearsal
 * Postgres instance, using whichever Prisma client is active in the process
 * that runs it (the orchestration script copies this file into a temporary
 * checkout of the prior commit and runs it with that commit's OLD client,
 * so the insert shapes match the pre-migration schema exactly).
 *
 * Deliberately covers all three `AssignmentCourseScopeState` backfill
 * outcomes so `report-core-migration-state.ts` / `backfill-assignment-
 * course-keys.ts` have real, non-trivial rows to classify:
 *   - one assignment that resolves cleanly (BACKFILL_AUTO — NSI/Première
 *     has exactly one catalogue course for that subject/grade);
 *   - one assignment that is genuinely ambiguous (BACKFILL_AMBIGUOUS —
 *     MATHEMATIQUES/Première resolves to both a mandatory tronc-commun
 *     course and the chosen specialty);
 *   - one assignment with no matching course at all (BACKFILL_UNRESOLVED).
 * No real user data. Every identifier is a synthetic fixture value.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/core/rehearsal-seed-synthetic.ts
 */
import { PrismaClient, GradeLevel, AcademicTrack, Subject, AssignmentStatus, SessionStatus, SessionModality, SessionType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { setStudentChosenCourses } from '../../lib/curriculum/enrollment';

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/nexus_rehearsal_synthetic/.test(url)) {
    throw new Error('REHEARSAL_SEED_REFUSED: DATABASE_URL does not target the synthetic rehearsal database');
  }

  const pw = await bcrypt.hash('change_rehearsal-synthetic-fixture-not-a-real-credential', 4);

  const coachAUser = await prisma.user.create({
    data: { email: 'rehearsal-coach-a@example.invalid', password: pw, role: 'COACH', firstName: 'RehearsalCoach', lastName: 'A', activatedAt: new Date() },
  });
  const coachAProfile = await prisma.coachProfile.create({
    data: { userId: coachAUser.id, pseudonym: 'RehearsalCoachA', subjects: [Subject.MATHEMATIQUES], title: 'Rehearsal', description: 'Rehearsal fixture' },
  });

  // Coach C: teaches NSI (clean BACKFILL_AUTO happy path — NSI/Première has
  // exactly one catalogue course, unlike MATHEMATIQUES which also carries a
  // mandatory tronc-commun course for the same grade).
  const coachCUser = await prisma.user.create({
    data: { email: 'rehearsal-coach-c@example.invalid', password: pw, role: 'COACH', firstName: 'RehearsalCoach', lastName: 'C', activatedAt: new Date() },
  });
  const coachCProfile = await prisma.coachProfile.create({
    data: { userId: coachCUser.id, pseudonym: 'RehearsalCoachC', subjects: [Subject.NSI], title: 'Rehearsal', description: 'Rehearsal fixture' },
  });

  const parentAUser = await prisma.user.create({
    data: { email: 'rehearsal-parent-a@example.invalid', password: pw, role: 'PARENT', firstName: 'RehearsalParent', lastName: 'A', activatedAt: new Date() },
  });
  const parentAProfile = await prisma.parentProfile.create({ data: { userId: parentAUser.id } });
  const studentAUser = await prisma.user.create({
    data: { email: 'rehearsal-student-a@example.invalid', password: pw, role: 'ELEVE', firstName: 'RehearsalStudent', lastName: 'A', activatedAt: new Date() },
  });
  const studentA = await prisma.student.create({
    data: { userId: studentAUser.id, parentId: parentAProfile.id, gradeLevel: GradeLevel.PREMIERE, academicTrack: AcademicTrack.EDS_GENERALE, credits: 5 },
  });
  await setStudentChosenCourses(
    studentA.id,
    { gradeLevel: GradeLevel.PREMIERE, academicTrack: AcademicTrack.EDS_GENERALE, stmgPathway: null },
    ['eds-maths-premiere', 'eds-nsi-premiere'],
    { source: 'SEED' },
    prisma,
  );

  // Ambiguous on purpose.
  const assignmentAmbiguous = await prisma.coachStudentAssignment.create({
    data: { coachId: coachAProfile.id, studentId: studentA.id, subjects: [Subject.MATHEMATIQUES], status: AssignmentStatus.ACTIVE },
  });

  // Clean happy path.
  const assignmentAuto = await prisma.coachStudentAssignment.create({
    data: { coachId: coachCProfile.id, studentId: studentA.id, subjects: [Subject.NSI], status: AssignmentStatus.ACTIVE },
  });

  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 14);
  await prisma.sessionBooking.create({
    data: {
      studentId: studentAUser.id, coachId: coachAUser.id, subject: Subject.MATHEMATIQUES,
      title: 'Rehearsal fixture session (future)', scheduledDate: future, startTime: '14:00', endTime: '15:00',
      duration: 60, status: SessionStatus.SCHEDULED, type: SessionType.INDIVIDUAL, modality: SessionModality.ONLINE,
    },
  });

  const past = new Date('2026-01-15T09:00:00.000Z');
  await prisma.sessionBooking.create({
    data: {
      studentId: studentAUser.id, coachId: coachAUser.id, subject: Subject.MATHEMATIQUES,
      title: 'Rehearsal fixture session (historical)', scheduledDate: past, startTime: '09:00', endTime: '10:00',
      duration: 60, status: SessionStatus.COMPLETED, type: SessionType.INDIVIDUAL, modality: SessionModality.ONLINE,
    },
  });

  // Deliberately UNRESOLVED: no enrollment matches this assignment's subject.
  const parentBUser = await prisma.user.create({
    data: { email: 'rehearsal-parent-b@example.invalid', password: pw, role: 'PARENT', firstName: 'RehearsalParent', lastName: 'B', activatedAt: new Date() },
  });
  const parentBProfile = await prisma.parentProfile.create({ data: { userId: parentBUser.id } });
  const studentBUser = await prisma.user.create({
    data: { email: 'rehearsal-student-b@example.invalid', password: pw, role: 'ELEVE', firstName: 'RehearsalStudent', lastName: 'B', activatedAt: new Date() },
  });
  const studentB = await prisma.student.create({
    data: { userId: studentBUser.id, parentId: parentBProfile.id, gradeLevel: GradeLevel.TERMINALE, academicTrack: AcademicTrack.EDS_GENERALE, credits: 5 },
  });
  await prisma.coachStudentAssignment.create({
    data: { coachId: coachAProfile.id, studentId: studentB.id, subjects: [Subject.PHYSIQUE_CHIMIE], status: AssignmentStatus.ACTIVE },
  });

  console.log(JSON.stringify({
    event: 'REHEARSAL_SYNTHETIC_SEED_COMPLETE',
    usersCreated: 6,
    studentsCreated: 2,
    coachesCreated: 2,
    assignmentsCreated: 3,
    sessionBookingsCreated: 2,
    autoAssignmentId: assignmentAuto.id,
    ambiguousAssignmentId: assignmentAmbiguous.id,
  }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: 'REHEARSAL_SYNTHETIC_SEED_FAILED', message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
