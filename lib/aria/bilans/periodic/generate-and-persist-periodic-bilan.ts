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
import { prisma } from '@/lib/prisma';
import { getCourse, isKnownCourseKey } from '@/lib/curriculum/catalog';
import { requireUserEmail } from '@/lib/contact/user-email';
import { getSkillGraph } from '../../curriculum/skill-graph';
import { AriaError } from '../../kernel/errors';
import { prismaLearningEvidenceRepository } from '../../infrastructure/prisma/learning-evidence-repository';
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
  readonly studentId: string;
  readonly courseKey: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

export interface PersistedAriaPeriodicBilan {
  readonly bilanId: string;
  readonly report: AriaPeriodicBilanReport;
}

function isPracticeOutcome(value: unknown): value is PeriodicEvidencePoint['outcome'] {
  return value === 'CORRECT' || value === 'PARTIALLY_CORRECT' || value === 'INCORRECT';
}

export async function generateAndPersistAriaPeriodicBilan(
  input: GenerateAndPersistAriaPeriodicBilanInput,
): Promise<PersistedAriaPeriodicBilan> {
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

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: {
      id: true,
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  });
  if (!student) {
    throw new AriaError('BAD_REQUEST', 400, 'Élève introuvable.');
  }

  const evidenceRows = await prismaLearningEvidenceRepository.listForStudent(input.studentId, {
    courseKey: input.courseKey,
    source: 'PRACTICE_ATTEMPT',
    until: input.periodEnd,
    limit: PERIODIC_BILAN_EVIDENCE_LIMIT,
  });

  const evidence: PeriodicEvidencePoint[] = evidenceRows
    .filter((row): row is typeof row & { skillId: string } => row.skillId !== null)
    .map((row) => {
      const outcome = (row.outcome as { outcome: unknown }).outcome;
      if (!isPracticeOutcome(outcome)) {
        throw new AriaError('INTERNAL_ERROR', 500, 'Preuve ARIA invalide.', { evidenceId: row.id });
      }
      return { skillId: row.skillId, outcome, observedAt: row.observedAt };
    });

  const report = generateAriaPeriodicBilanReport({
    courseLabel: course.label,
    skillGraph,
    studentFirstName: student.user.firstName ?? 'l’élève',
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    evidenceUpToPeriodEnd: evidence,
  });

  if (report.totalAttemptsInPeriod === 0) {
    throw new AriaError('BAD_REQUEST', 400, 'Aucune activité ARIA pour cet élève sur cette période.');
  }

  const studentEmail = requireUserEmail(student.user.email);
  const studentName = [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || studentEmail;

  const bilan = await prisma.bilan.create({
    data: {
      type: 'ARIA_PERIODIC',
      subject: course.legacySubject,
      studentId: student.id,
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

  return { bilanId: bilan.id, report };
}
