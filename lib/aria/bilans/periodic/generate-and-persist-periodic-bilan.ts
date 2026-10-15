/**
 * ARIA periodic bilan — generation + persistence (P7b-1).
 *
 * Orchestrates the pure generator (`generate-periodic-report.ts`) with real
 * reads (`LearningEvidence`, the student's own catalog course) and a single
 * write into the CANONICAL `Bilan` model (§6 of the mission: reuse an
 * existing structure only when its business identity genuinely matches —
 * `Bilan` already IS "a persisted, versioned, tri-audience, student-linked,
 * parent-readable report"; `ARIA_PERIODIC` is a new `BilanType`, not a new
 * table). Deliberately creates `isPublished: false`: publication is a human
 * review step (P7b-2, reusing the existing `PUT /api/bilans/[id]`) — this
 * function never makes an ARIA bilan visible to the student or parent by
 * itself.
 */
import type { Prisma } from '@prisma/client';
import { getCourse, isKnownCourseKey } from '@/lib/curriculum/catalog';
import { requireUserEmail } from '@/lib/contact/user-email';
import { getSkillGraph } from '../../curriculum/skill-graph';
import { AriaError } from '../../kernel/errors';
import { makePrismaLearningEvidenceRepository } from '../../infrastructure/prisma/learning-evidence-repository';
import { listStudentAcademicCourseKeys } from '../../access';
import { lockV1AriaSubject } from '../../infrastructure/prisma/actor-authority';
import { coachCapableCourseKeys } from '@/lib/assignments/allowed-courses';
import { parseSubjects } from '@/lib/utils/subjects';
import {
  generateAriaPeriodicBilanReport,
  type AriaPeriodicBilanReport,
  type PeriodicEvidencePoint,
} from './generate-periodic-report';

// One batched read of this course's entire practice history up to
// `periodEnd` — generous enough for cumulative mastery across a full
// school-year's worth of activity on any one course (same reasoning as
// `list-course-mastery.ts`'s own `COURSE_MASTERY_EVIDENCE_LIMIT`, scaled up
// since a periodic bilan looks further back than a single cockpit read).
const PERIODIC_BILAN_EVIDENCE_LIMIT = 500;

export interface GenerateAndPersistAriaPeriodicBilanInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly studentId: string;
  readonly courseKey: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

export interface PersistedAriaPeriodicBilan {
  readonly bilanId: string;
  readonly report: AriaPeriodicBilanReport;
  /** Internal final transaction guard; never part of the public projection. */
  readonly assertScopeNow: () => void;
}

export async function generateAndPersistAriaPeriodicBilan(
  input: GenerateAndPersistAriaPeriodicBilanInput,
  db: Prisma.TransactionClient,
): Promise<PersistedAriaPeriodicBilan> {
  const refuse = (): never => { throw new AriaError('NOT_ENTITLED', 403, 'Opération indisponible.'); };
  if (!input.actor || !['ADMIN', 'ASSISTANTE', 'COACH'].includes(input.actor.role)) refuse();
  // Identity is already locked by the HTTP session authority. Trusted command
  // callers must still provide the immutable issuer and its actual V1 role.
  const issuer = await db.user.findUnique({ where: { id: input.actor.userId },
    select: { role: true, disabledAt: true, mergedIntoUserId: true } });
  if (!issuer || issuer.role !== input.actor.role || issuer.disabledAt || issuer.mergedIntoUserId) refuse();
  let scope: { startsAt: Date; endsAt: Date | null } | undefined;
  if (input.actor.role === 'COACH') {
    const coaches = await db.$queryRaw<Array<{ id: string; subjects: unknown }>>`
      SELECT id, subjects FROM public.coach_profiles WHERE "userId" = ${input.actor.userId} FOR SHARE`;
    const coach = coaches[0];
    if (!coach || !coachCapableCourseKeys(parseSubjects(coach.subjects)).has(input.courseKey)) refuse();
    const assignments = await db.$queryRaw<Array<{ startsAt: Date; endsAt: Date | null }>>`
      SELECT "startsAt", "endsAt" FROM public.coach_student_assignments
      WHERE "coachId" = ${coach!.id} AND "studentId" = ${input.studentId} AND status::text = 'ACTIVE'
        AND "courseScopeState"::text IN ('STAFF_VERIFIED', 'BACKFILL_AUTO')
        AND ${input.courseKey} = ANY("academicCourseKeys") ORDER BY id FOR SHARE`;
    // Compare wall time after any lock wait; transaction-start time is stale.
    const now = Date.now();
    scope = assignments.find(row => row.startsAt.getTime() <= now && (!row.endsAt || row.endsAt.getTime() > now));
    if (!scope) refuse();
  }
  const assertScopeNow = () => {
    const now = Date.now();
    if (scope && (scope.startsAt.getTime() > now || (scope.endsAt && scope.endsAt.getTime() <= now))) refuse();
  };
  if (!(input.periodStart < input.periodEnd)) {
    throw new AriaError('BAD_REQUEST', 400, 'La période demandée est invalide.');
  }
  if (!isKnownCourseKey(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  const course = getCourse(input.courseKey);
  if (!course || !course.legacySubject) {
    throw new AriaError('BAD_REQUEST', 400, "Ce cours n'a pas de matière associée pour un bilan.");
  }
  const skillGraph = getSkillGraph(input.courseKey);
  if (!skillGraph) {
    throw new AriaError('BAD_REQUEST', 400, 'Ce cours ne dispose pas encore de graphe de compétences.');
  }

  const locator = await db.student.findUnique({ where: { id: input.studentId }, select: { userId: true } });
  if (!locator) refuse();
  await lockV1AriaSubject(db, locator!.userId, false);
  const student = await db.student.findUnique({
    where: { id: input.studentId },
    select: {
      id: true,
      gradeLevel: true, academicTrack: true, stmgPathway: true,
      academicEnrollments: { select: { courseKey: true, kind: true, source: true } },
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  });
  if (!student) {
    refuse();
  }
  if (!listStudentAcademicCourseKeys(student!).includes(input.courseKey)) refuse();

  const evidenceRows = await makePrismaLearningEvidenceRepository(db).listForStudent(input.studentId, {
    courseKey: input.courseKey,
    source: 'PRACTICE_ATTEMPT',
    until: input.periodEnd,
    limit: PERIODIC_BILAN_EVIDENCE_LIMIT,
  });

  // Safe to narrow without a runtime check: `listForStudent` itself
  // validates `outcome` against the source-specific schema on every read
  // (`parseLearningEvidenceOutcome`, in the repository's own `toRecord`) —
  // a corrupted row throws there, before this line ever runs. Same
  // reasoning as `list-course-mastery.ts`'s identical narrowing.
  const evidence: PeriodicEvidencePoint[] = evidenceRows
    .filter((row): row is typeof row & { skillId: string } => row.skillId !== null)
    .map((row) => ({
      skillId: row.skillId,
      outcome: (row.outcome as { outcome: PeriodicEvidencePoint['outcome'] }).outcome,
      observedAt: row.observedAt,
    }));

  const report = generateAriaPeriodicBilanReport({
    courseLabel: course.label,
    skillGraph,
    studentFirstName: student!.user.firstName ?? 'l’élève',
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    evidenceUpToPeriodEnd: evidence,
  });

  if (report.totalAttemptsInPeriod === 0) {
    throw new AriaError('BAD_REQUEST', 400, 'Aucune activité ARIA pour cet élève sur cette période.');
  }

  const studentEmail = requireUserEmail(student!.user.email);
  const studentName = [student!.user.firstName, student!.user.lastName].filter(Boolean).join(' ') || studentEmail;
  assertScopeNow();

  const bilan = await db.bilan.create({
    data: {
      type: 'ARIA_PERIODIC',
      subject: course.legacySubject,
      studentId: student!.id,
      studentEmail,
      studentName,
      status: 'COMPLETED',
      isPublished: false,
      globalScore: report.globalScore,
      domainScores: report.domainScores as unknown as object,
      studentMarkdown: report.studentMarkdown,
      parentsMarkdown: report.parentsMarkdown,
      nexusMarkdown: report.nexusMarkdown,
      sourceVersion: 'aria_periodic_v1',
      engineVersion: 'aria_periodic_pure_v1',
      sourceData: {
        kind: 'ARIA_PERIODIC',
        courseKey: input.courseKey,
        periodStart: input.periodStart.toISOString(),
        periodEnd: input.periodEnd.toISOString(),
      },
    },
    select: { id: true },
  });

  assertScopeNow();

  return { bilanId: bilan.id, report, assertScopeNow };
}
