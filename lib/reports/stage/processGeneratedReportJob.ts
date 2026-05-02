import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { MistralConfigurationError, MistralGenerationError } from '@/lib/llm/mistral';
import { buildReportContext } from './buildReportContext';
import { generateStructuredReportWithMistral } from './generateStructuredReportWithMistral';
import { validatePedagogicalReportJson } from './schema';
import { renderLatexPremiumReport } from './renderLatexPremiumReport';
import { compileLatexToPdf } from './compileLatexToPdf';
import fs from 'fs/promises';
import path from 'path';
import { ZodError } from 'zod';
import type { Prisma } from '@prisma/client';

export async function processGeneratedReportJob({
  studentId,
  reportId,
}: {
  studentId: string;
  reportId: string;
}) {
  const report = await prisma.generatedPedagogicalReport.findUnique({
    where: { id: reportId },
  });

  if (!report || report.studentId !== studentId) {
    return { ok: false as const, status: 404, body: { error: 'Not Found', message: 'Report not found' } };
  }

  try {
    await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: {
        status: 'BUILDING_CONTEXT',
        errorCode: null,
        errorMessage: null,
        retryCount: { increment: report.status === 'FAILED' || report.status === 'NEEDS_REVIEW' ? 1 : 0 },
      },
    });

    const context = await buildReportContext(
      studentId,
      report.subject,
      report.stageSlug,
      report.kind,
      report.promptVersion,
      report.templateVersion,
    );

    await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: { status: 'LLM_GENERATING', contextJson: context as unknown as Prisma.InputJsonValue },
    });

    const { json: llmJson, modelUsed } = await generateStructuredReportWithMistral(context);

    const validatedJson = validatePedagogicalReportJson(llmJson);

    await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: {
        status: 'LLM_VALIDATED',
        llmJson: llmJson as Prisma.InputJsonValue,
        validatedJson: validatedJson as unknown as Prisma.InputJsonValue,
        modelUsed,
        validatedAt: new Date(),
      },
    });

    const latexSource = renderLatexPremiumReport(validatedJson);

    await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: { status: 'LATEX_RENDERING', latexSource },
    });

    const pdfBuffer = await compileLatexToPdf(latexSource);
    const pdfDir = path.join(process.cwd(), 'scratch', 'pdfs');
    await fs.mkdir(pdfDir, { recursive: true });
    await fs.writeFile(path.join(pdfDir, `${reportId}.pdf`), pdfBuffer);

    const finalReport = await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: {
        status: 'PDF_READY',
        generatedAt: new Date(),
        pdfUrl: `/api/coach/students/${studentId}/generated-reports/${reportId}/download`,
      },
    });

    return { ok: true as const, report: finalReport };
  } catch (error) {
    const { status, errorCode, errorMessage } = classifyGenerationError(error);

    logger.error(
      { reportId, errorCode, err: error instanceof Error ? { name: error.name, message: error.message } : undefined },
      '[Reports] generated pedagogical report processing failed',
    );

    await prisma.generatedPedagogicalReport.update({
      where: { id: reportId },
      data: {
        status,
        errorCode,
        errorMessage,
      },
    });

    return {
      ok: false as const,
      status: status === 'NEEDS_REVIEW' ? 422 : 500,
      body: { error: errorCode, message: errorMessage },
    };
  }
}

function classifyGenerationError(error: unknown): {
  status: 'FAILED' | 'NEEDS_REVIEW';
  errorCode: string;
  errorMessage: string;
} {
  if (error instanceof MistralConfigurationError) {
    return {
      status: 'FAILED',
      errorCode: error.code,
      errorMessage: 'La génération LLM est désactivée: MISTRAL_API_KEY est absent.',
    };
  }

  if (error instanceof MistralGenerationError) {
    return {
      status: 'FAILED',
      errorCode: error.code,
      errorMessage: 'La génération LLM a échoué.',
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 'NEEDS_REVIEW',
      errorCode: 'LLM_JSON_SCHEMA_INVALID',
      errorMessage: 'Le JSON généré ne respecte pas le schéma attendu.',
    };
  }

  if (error instanceof Error && error.message.includes('La compilation du document LaTeX')) {
    return {
      status: 'FAILED',
      errorCode: 'PDF_COMPILATION_FAILED',
      errorMessage: error.message,
    };
  }

  return {
    status: 'FAILED',
    errorCode: 'PROCESS_ERROR',
    errorMessage: 'La génération du bilan a échoué.',
  };
}
