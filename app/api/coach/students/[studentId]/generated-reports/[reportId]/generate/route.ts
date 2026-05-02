import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  getCoachProfileForUser,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { buildReportContext } from '@/lib/reports/stage/buildReportContext';
import { generateStructuredReportWithMistral } from '@/lib/llm/mistral';
import { validatePedagogicalReportJson } from '@/lib/reports/stage/validateGeneratedReportJson';
import { renderLatexPremiumReport } from '@/lib/reports/stage/renderLatexPremiumReport';
import { compileLatexToPdf } from '@/lib/reports/stage/compileLatexToPdf';
import fs from 'fs/promises';
import path from 'path';

interface RouteParams {
  params: Promise<{ studentId: string; reportId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { studentId, reportId } = await params;
  try {

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    // Verify coach assignment
    try {
      await assertCoachCanAccessStudent({ coachUserId: authSession.user.id, studentId });
    } catch (error) {
      if (error instanceof CoachNotAssignedError) {
        return NextResponse.json(
          { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
          { status: 403 }
        );
      }
      throw error;
    }

    const report = await prisma.generatedPedagogicalReport.findUnique({
      where: { id: reportId },
    });

    if (!report || report.studentId !== studentId) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Step 1: BUILD CONTEXT
    await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: { status: 'BUILDING_CONTEXT' },
    });

    const context = await buildReportContext(
      studentId,
      report.subject,
      report.stageSlug,
      report.kind,
      report.promptVersion,
      report.templateVersion
    );

    // Step 2: LLM GENERATING
    await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: { status: 'LLM_GENERATING', contextJson: context as any },
    });

    // We can extract a strict text description of schema directly from Zod type
    const schemaDesc = `Un objet JSON contenant exactement ces rubriques :
- cover: title, subtitle, studentName, stageLabel, subjectLabel
- executiveSummary: profileSummary, keyStrengths (array strings), keyRisks (array strings), priorityMessageForParents, priorityMessageForStudent
- competenceReview: array of domains, with domain, level (SOLIDE, SATISFAISANT, EN_PROGRESSION, FRAGILE), evidence (array), analysis, recommendation
- studentPosture: confidence, autonomy, workingMethod, attentionPoints (array)
- actionPlan: next7Days (array), next30Days (array), beforeExam (array)
- parentSection: reassuringSummary, concreteSupportAdvice (array), warningWithoutAlarmism
- coachSection: syntheticReading, nextSessionPriorities (array)
- qualityFlags: missingData (array), uncertainties (array), shouldBeReviewedByCoach (boolean)
`;

    const llmJson = await generateStructuredReportWithMistral(JSON.stringify(context), schemaDesc);

    // Step 3: LLM VALIDATE
    await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: { status: 'LLM_VALIDATED', llmJson: llmJson as any },
    });

    const validatedJson = validatePedagogicalReportJson(llmJson);

    // Step 4: LATEX RENDERING
    await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: { status: 'LATEX_RENDERING', validatedJson: validatedJson as any },
    });

    const latexSource = renderLatexPremiumReport(validatedJson);

    // Step 5: PDF COMPILING
    const pdfBuffer = await compileLatexToPdf(latexSource);

    // Save to scratch/pdfs
    const pdfDir = path.join(process.cwd(), 'scratch', 'pdfs');
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, `${reportId}.pdf`);
    await fs.writeFile(pdfPath, pdfBuffer);

    // Final status
    const finalReport = await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: {
        status: 'PDF_READY',
        latexSource,
        generatedAt: new Date(),
        pdfUrl: `/api/coach/students/${studentId}/generated-reports/${reportId}/download`,
      },
    });

    return NextResponse.json({
      success: true,
      report: finalReport,
    });
  } catch (error: any) {
    console.error('[API] Process report job failed:', error);
    await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: {
        status: 'FAILED',
        errorCode: 'PROCESS_ERROR',
        errorMessage: error.message || String(error),
      },
    });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
