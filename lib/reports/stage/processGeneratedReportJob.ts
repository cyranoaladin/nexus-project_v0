import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  MistralConfigurationError,
  MistralGenerationError,
  MISTRAL_ERROR_CODES,
} from '@/lib/llm/mistral';
import { buildReportContext } from './buildReportContext';
import { generateStructuredReportWithMistral } from './generateStructuredReportWithMistral';
import { validatePedagogicalReportJson } from './schema';
import { renderLatexPremiumReport } from './renderLatexPremiumReport';
import { compileLatexToPdf, LatexCompilationError, LATEX_ERROR_CODES } from './compileLatexToPdf';
import { writeGeneratedReportPdf } from './reportStorage';
import { ZodError } from 'zod';
import type { Prisma } from '@prisma/client';
import type { StageGeneratedReportKind } from './maybeCreateGeneratedReportJob';

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
      report.stageSlug ?? '',
      report.kind as StageGeneratedReportKind,
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
    // Write to durable storage (configurable via GENERATED_REPORTS_DIR)
    await writeGeneratedReportPdf({
      reportId,
      studentId,
      pdfBuffer,
    });

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
    // Map specific Mistral error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      [MISTRAL_ERROR_CODES.MISTRAL_TIMEOUT]: 'Le service de génération LLM a dépassé le temps imparti.',
      [MISTRAL_ERROR_CODES.MISTRAL_HTTP_ERROR]: 'Le service de génération LLM a rencontré une erreur HTTP.',
      [MISTRAL_ERROR_CODES.MISTRAL_INVALID_JSON]: 'Le service de génération LLM a retourné un JSON invalide.',
      [MISTRAL_ERROR_CODES.MISTRAL_EMPTY_RESPONSE]: 'Le service de génération LLM a retourné une réponse vide.',
    };

    return {
      status: 'FAILED',
      errorCode: error.code,
      errorMessage: errorMessages[error.code] || 'La génération LLM a échoué.',
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 'NEEDS_REVIEW',
      errorCode: 'LLM_JSON_SCHEMA_INVALID',
      errorMessage: 'Le JSON généré ne respecte pas le schéma attendu.',
    };
  }

  if (error instanceof LatexCompilationError) {
    return {
      status: 'FAILED',
      errorCode: error.code,
      errorMessage: error.message,
    };
  }

  if (error instanceof Error && error.message.includes('La compilation du document LaTeX')) {
    return {
      status: 'FAILED',
      errorCode: LATEX_ERROR_CODES.PDF_COMPILATION_FAILED,
      errorMessage: error.message,
    };
  }

  return {
    status: 'FAILED',
    errorCode: 'PROCESS_ERROR',
    errorMessage: 'La génération du bilan a échoué.',
  };
}
