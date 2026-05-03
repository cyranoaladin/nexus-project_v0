/**
 * POST /api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent
 * Regenerate parent summary using the generic bilan-generation workflow (v2).
 */

import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateBilan, adaptMathsPremiereStagePrintemps } from '@/lib/bilan-generation';
import { MistralConfigurationError, MistralGenerationError } from '@/lib/llm/mistral';

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

const COACH_SOURCE_VERSION = 'coach_maths_premiere_stage_printemps_v1';
const BILAN_TYPE = 'STAGE_POST' as const;
const BILAN_SUBJECT = 'MATHEMATIQUES';

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;

    // Auth
    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    // RBAC
    try {
      await assertCoachCanAccessStudent({ coachUserId: authSession.user.id, studentId });
    } catch {
      return NextResponse.json(
        { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
        { status: 403 },
      );
    }

    // Load bilan
    const bilan = await prisma.bilan.findFirst({
      where: { studentId, type: BILAN_TYPE, subject: BILAN_SUBJECT, sourceVersion: COACH_SOURCE_VERSION },
      orderBy: { createdAt: 'desc' },
    });

    if (!bilan) {
      return NextResponse.json({ error: 'Bilan not found' }, { status: 404 });
    }

    if (!bilan.sourceData) {
      return NextResponse.json({ error: 'Source data not found' }, { status: 400 });
    }

    // Completeness check — need at least one meaningful data section
    const sd = bilan.sourceData as Record<string, unknown>;
    const hasData =
      sd.globalDiagnostic ||
      sd.automatismes ||
      sd.chapterDiagnostics ||
      sd.finalAssessment ||
      sd.parentRecommendations;

    if (!hasData) {
      return NextResponse.json(
        { error: 'Bilan too incomplete for generation', message: 'Le bilan ne contient pas assez de données pour générer une synthèse.' },
        { status: 400 },
      );
    }

    // Normalize via adapter
    const input = adaptMathsPremiereStagePrintemps(
      bilan.id,
      studentId,
      bilan.studentName,
      bilan.sourceData,
    );

    // Run full workflow
    const result = await generateBilan({ input, save: true });

    if (result.qualityStatus === 'FAIL') {
      return NextResponse.json(
        {
          error: 'Quality gate failed',
          message: 'La génération n\'a pas passé le contrôle qualité. Veuillez réessayer.',
          qualityIssues: result.qualityIssues,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      bilanId: bilan.id,
      parentsMarkdown: result.markdown,
      qualityStatus: result.qualityStatus,
      qualityIssues: result.qualityIssues,
      model: result.model,
      workflowVersion: result.workflowVersion,
    });
  } catch (error) {
    if (error instanceof MistralConfigurationError) {
      return NextResponse.json({ error: 'MISTRAL_API_KEY not configured' }, { status: 500 });
    }

    if (error instanceof MistralGenerationError) {
      if (error.message === 'RATE_LIMITED') {
        return NextResponse.json(
          { error: 'Rate limit exceeded', message: 'Limite d\'appels Mistral atteinte. Veuillez patienter quelques secondes avant de réessayer.' },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: 'Mistral generation error', details: error.message }, { status: 502 });
    }

    logger.error({ error: (error as Error).message }, '[regenerate-parent] Unhandled error');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
