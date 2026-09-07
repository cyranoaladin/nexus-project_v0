/**
 * Rehearsal-only fixture (Task 18, `scripts/core/rehearse-core-migration.sh`).
 * NOT imported by the application. Proves empirically that the PRIOR
 * (pre-branch) Prisma client can still read pre-expansion records and can
 * read+write a new record against the NEW (post-migration) expanded schema,
 * without ever referencing any column introduced by this branch's
 * migrations. This is the backward-compatibility / rollback-safety check —
 * the additive-only ("PAS DE CONTRACT DESTRUCTIF") design principle,
 * verified rather than assumed.
 *
 * The orchestration script runs this file from a temporary checkout of the
 * commit the branch diverged from, using that commit's OWN generated Prisma
 * client, against the (already-migrated-by-the-new-branch) synthetic
 * rehearsal database.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/core/rehearsal-rollback-compat-check.ts
 */
import { PrismaClient, Subject, SessionStatus, SessionType, SessionModality } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/nexus_rehearsal_synthetic/.test(url)) {
    throw new Error('REHEARSAL_COMPAT_CHECK_REFUSED: DATABASE_URL does not target the synthetic rehearsal database');
  }

  const userCount = await prisma.user.count({ where: { email: { contains: 'rehearsal-' } } });
  const studentCount = await prisma.student.count();
  const bookingCount = await prisma.sessionBooking.count();
  const assignmentCount = await prisma.coachStudentAssignment.count();

  if (userCount < 1 || studentCount < 1 || bookingCount < 1 || assignmentCount < 1) {
    throw new Error('REHEARSAL_COMPAT_CHECK_FAILED: pre-expansion fixture rows not found through OLD client');
  }

  const student = await prisma.student.findFirst({ select: { id: true, userId: true } });
  const coachAssignment = await prisma.coachStudentAssignment.findFirst({ select: { coachId: true } });
  if (student === null || coachAssignment === null) {
    throw new Error('REHEARSAL_COMPAT_CHECK_FAILED: no fixture student/coach available for write probe');
  }
  const coach = await prisma.coachProfile.findUniqueOrThrow({ where: { id: coachAssignment.coachId }, select: { userId: true } });

  const scheduledDate = new Date();
  scheduledDate.setUTCDate(scheduledDate.getUTCDate() + 21);
  const written = await prisma.sessionBooking.create({
    data: {
      studentId: student.userId,
      coachId: coach.userId,
      subject: Subject.MATHEMATIQUES,
      title: 'Rehearsal rollback-compat write probe',
      scheduledDate,
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      status: SessionStatus.SCHEDULED,
      type: SessionType.INDIVIDUAL,
      modality: SessionModality.ONLINE,
    },
  });

  const readBack = await prisma.sessionBooking.findUniqueOrThrow({ where: { id: written.id } });
  if (readBack.status !== SessionStatus.SCHEDULED) {
    throw new Error('REHEARSAL_COMPAT_CHECK_FAILED: read-back mismatch');
  }

  console.log(JSON.stringify({
    event: 'REHEARSAL_ROLLBACK_COMPAT_CHECK_PASS',
    preExpansionUsersReadable: userCount,
    preExpansionStudentsReadable: studentCount,
    preExpansionBookingsReadable: bookingCount,
    preExpansionAssignmentsReadable: assignmentCount,
    newRecordWrittenAndReadBack: true,
  }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: 'REHEARSAL_ROLLBACK_COMPAT_CHECK_FAILED', message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
