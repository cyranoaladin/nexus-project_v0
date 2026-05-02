import { prisma } from '@/lib/prisma';
import { EAF_STAGE_SOURCE_VERSION, type StageGeneratedReportKind } from './maybeCreateGeneratedReportJob';

export type StageReportContext = {
  meta: {
    reportKind: StageGeneratedReportKind;
    stageSlug: string;
    subject: string;
    generatedAt: string;
    promptVersion: string;
    templateVersion: string;
  };
  student: {
    id: string;
    fullName: string;
    gradeLevel: string;
    academicTrack: string;
    specialties: string[];
    school?: string;
  };
  studentBilan: {
    id: string;
    submittedAt: string;
    answers: Record<string, any>;
  };
  coachReport: {
    id: string;
    validatedAt: string;
    data: Record<string, any>;
  };
};

export async function buildReportContext(
  studentId: string,
  subject: string,
  stageSlug: string,
  kind: StageGeneratedReportKind,
  promptVersion: string,
  templateVersion: string
): Promise<StageReportContext> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });

  if (!student) {
    throw new Error(`Student not found with ID ${studentId}`);
  }

  // Find the canonical Bilan for student auto-bilan
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

  if (!studentBilan) {
    throw new Error(`Student Bilan not found for ${studentId} and ${subject}`);
  }

  let coachReportData: any = {};
  let coachReportId = '';
  let coachReportValidatedAt = '';

  if (kind === 'EAF_STAGE_POST') {
    const r = await prisma.eafPreparationReport.findFirst({
      where: { studentId, status: 'VALIDATED' },
      orderBy: { updatedAt: 'desc' },
    });
    if (r) {
      coachReportId = r.id;
      coachReportValidatedAt = r.validatedAt ? r.validatedAt.toISOString() : r.updatedAt.toISOString();
      coachReportData = {
        linearReading: r.linearReading,
        workPresentation: r.workPresentation,
        interview: r.interview,
        oralExpression: r.oralExpression,
        writingMethod: r.writingMethod,
        languageMastery: r.languageMastery,
        literaryCulture: r.literaryCulture,
        strengths: r.strengths,
        areasToImprove: r.areasToImprove,
        nextSessionGoals: r.nextSessionGoals,
        coachFreeComment: r.coachFreeComment,
      };
    }
  } else if (kind === 'MATHS_PREMIERE_STAGE_POST') {
    // We look up either the Coach Bilan canonical entry or Bilan with continuous type if there is any,
    // or just the latest Bilan filled by the coach. Wait! Let's check the route we created in step 10:
    // `/api/coach/maths-premiere-stage-printemps/students/[studentId]/report`.
    // It stored the coachBilan as a StageBilan or Bilan (canonical) with type=STAGE_POST and stored data.
    // Let's use `findFirst` on `Bilan` with subject='MATHEMATIQUES' and type='STAGE_POST' and sourceData.action='complete' or similar.
    // Let's look up all Bilans.
    const r = await prisma.bilan.findFirst({
      where: {
        studentId,
        subject: 'MATHEMATIQUES',
        type: 'STAGE_POST',
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (r) {
      coachReportId = r.id;
      coachReportValidatedAt = r.updatedAt.toISOString();
      coachReportData = r.sourceData || {};
    }
  }

  const sData = studentBilan.sourceData as any;

  return {
    meta: {
      reportKind: kind,
      stageSlug,
      subject,
      generatedAt: new Date().toISOString(),
      promptVersion,
      templateVersion,
    },
    student: {
      id: student.id,
      fullName: `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim(),
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      specialties: student.specialties,
      school: student.school || '',
    },
    studentBilan: {
      id: studentBilan.id,
      submittedAt: studentBilan.updatedAt.toISOString(),
      answers: sData?.answers || sData || {},
    },
    coachReport: {
      id: coachReportId,
      validatedAt: coachReportValidatedAt,
      data: coachReportData,
    },
  };
}
