import { prisma } from '@/lib/prisma';
import { computeInputChecksum } from './checksums';
import type { GeneratedReportKind, Subject } from '@prisma/client';

export async function maybeCreateGeneratedReportJob({
  studentId,
  subject,
  kind,
  stageSlug,
}: {
  studentId: string;
  subject: Subject;
  kind: GeneratedReportKind;
  stageSlug: string;
}) {
  // Find completed student auto-bilan
  const studentBilan = await prisma.bilan.findFirst({
    where: {
      studentId,
      type: 'STAGE_POST',
      subject,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!studentBilan) {
    return { created: false, reason: 'WAITING_FOR_STUDENT_BILAN' };
  }

  // Find validated coach report
  let coachReportUpdatedAt: Date | null = null;
  let coachReportId: string | null = null;
  let coachId: string | null = null;

  if (kind === 'EAF_STAGE_POST') {
    const cr = await prisma.eafPreparationReport.findFirst({
      where: { studentId },
      orderBy: { updatedAt: 'desc' },
    });
    if (cr) {
      coachReportId = cr.id;
      coachReportUpdatedAt = cr.updatedAt;
      coachId = cr.coachId;
    }
  } else if (kind === 'MATHS_PREMIERE_STAGE_POST') {
    // Both types of bilans for student and coach are stored in the canonical Bilan table
    // Let's use any entry by the coach
    const cr = await prisma.bilan.findFirst({
      where: {
        studentId,
        type: 'STAGE_POST',
        subject: 'MATHEMATIQUES',
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (cr) {
      coachReportId = cr.id;
      coachReportUpdatedAt = cr.updatedAt;
      coachId = cr.coachId;
    }
  }

  if (!coachReportUpdatedAt || !coachReportId) {
    return { created: false, reason: 'WAITING_FOR_COACH_REPORT' };
  }

  const promptVersion = 'stage_report_v1';
  const templateVersion = 'premium_latex_v1';

  const inputChecksum = computeInputChecksum({
    studentBilanUpdatedAt: studentBilan.updatedAt,
    coachReportUpdatedAt,
    promptVersion,
    templateVersion,
  });

  const existing = await prisma.generatedPedagogicalReport.findUnique({
    where: {
      studentId_stageSlug_subject_kind_inputChecksum: {
        studentId,
        stageSlug,
        subject,
        kind,
        inputChecksum,
      },
    },
  });

  if (existing) {
    return { created: false, reason: 'ALREADY_EXISTS', reportId: existing.id };
  }

  const job = await prisma.generatedPedagogicalReport.create({
    data: {
      studentId,
      coachId,
      stageSlug,
      subject,
      kind,
      studentBilanId: studentBilan.id,
      coachReportId,
      inputChecksum,
      promptVersion,
      templateVersion,
      status: 'PENDING',
    },
  });

  return { created: true, reportId: job.id };
}
