import { prisma } from '@/lib/prisma';
import { computeInputChecksum } from './checksums';
import { isEafCoachReportComplete, isMathsCoachReportComplete, isStudentBilanComplete } from './completeness';

export const STAGE_REPORT_PROMPT_VERSION = 'stage_report_v1';
export const STAGE_REPORT_TEMPLATE_VERSION = 'premium_latex_v1';
export const EAF_STAGE_SOURCE_VERSION = 'eaf_stage_printemps_v1';

export type StageGeneratedReportKind = 'EAF_STAGE_POST' | 'MATHS_PREMIERE_STAGE_POST';
export type StageReportSubject = 'FRANCAIS' | 'MATHEMATIQUES';

export async function maybeCreateGeneratedReportJob({
  studentId,
  subject,
  kind,
  stageSlug,
}: {
  studentId: string;
  subject: StageReportSubject;
  kind: StageGeneratedReportKind;
  stageSlug: string;
}) {
  // Find completed student auto-bilan
  const studentBilan = await prisma.bilan.findFirst({
    where: {
      studentId,
      type: 'STAGE_POST',
      subject,
      status: 'COMPLETED',
      ...(kind === 'EAF_STAGE_POST' ? { sourceVersion: EAF_STAGE_SOURCE_VERSION } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!studentBilan || !isStudentBilanComplete(studentBilan)) {
    return { created: false, reason: 'WAITING_FOR_STUDENT_BILAN' };
  }

  // Find validated coach report
  let coachReportUpdatedAt: Date | null = null;
  let coachReportId: string | null = null;
  let coachId: string | null = null;

  if (kind === 'EAF_STAGE_POST') {
    const cr = await prisma.eafPreparationReport.findFirst({
      where: { studentId, status: 'VALIDATED' },
      orderBy: { updatedAt: 'desc' },
    });
    if (cr && isEafCoachReportComplete(cr)) {
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
        status: 'COMPLETED',
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (cr && isMathsCoachReportComplete(cr)) {
      coachReportId = cr.id;
      coachReportUpdatedAt = cr.updatedAt;
      coachId = cr.coachId;
    }
  }

  if (!coachReportUpdatedAt || !coachReportId) {
    return { created: false, reason: 'WAITING_FOR_COACH_REPORT' };
  }

  const promptVersion = STAGE_REPORT_PROMPT_VERSION;
  const templateVersion = STAGE_REPORT_TEMPLATE_VERSION;

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
