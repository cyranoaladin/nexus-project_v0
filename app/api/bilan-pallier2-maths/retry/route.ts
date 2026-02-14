export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { bilanDiagnosticMathsSchema } from '@/lib/validations';
import { computeScoring } from '@/lib/bilan-scoring';
import { generateBilans } from '@/lib/bilan-generator';
import { buildQualityFlags } from '@/lib/diagnostics/llm-contract';
import { computeScoringV2 } from '@/lib/diagnostics/score-diagnostic';
import { getDefinition } from '@/lib/diagnostics/definitions';
import { DiagnosticStatus } from '@/lib/diagnostics/types';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/bilan-pallier2-maths/retry
 *
 * Retry LLM generation for a failed diagnostic.
 * Staff-only (ADMIN, ASSISTANTE, COACH).
 * Body: { diagnosticId: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: staff only
    const authResult = await requireAnyRole(
      ['ADMIN', 'ASSISTANTE', 'COACH'] as unknown as Parameters<typeof requireAnyRole>[0]
    );
    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const body = await request.json();
    const { diagnosticId } = body;

    if (!diagnosticId || typeof diagnosticId !== 'string') {
      return NextResponse.json(
        { error: 'diagnosticId requis' },
        { status: 400 }
      );
    }

    // Fetch the diagnostic
    const diagnostic = await prisma.diagnostic.findUnique({
      where: { id: diagnosticId },
    });

    if (!diagnostic) {
      return NextResponse.json(
        { error: 'Diagnostic non trouvé' },
        { status: 404 }
      );
    }

    // Only allow retry on FAILED or SCORED status
    if (
      diagnostic.status !== DiagnosticStatus.FAILED &&
      diagnostic.status !== DiagnosticStatus.SCORED &&
      diagnostic.status !== 'SCORE_ONLY'
    ) {
      return NextResponse.json(
        {
          error: `Retry non autorisé pour le statut "${diagnostic.status}". Seuls les statuts FAILED, SCORED, SCORE_ONLY sont éligibles.`,
        },
        { status: 409 }
      );
    }

    // Parse the stored data to re-run generation
    const rawData = diagnostic.data as Record<string, unknown> | null;
    if (!rawData) {
      return NextResponse.json(
        { error: 'Données du diagnostic manquantes — impossible de relancer la génération' },
        { status: 422 }
      );
    }

    // Re-validate the data
    const validatedData = bilanDiagnosticMathsSchema.parse(rawData);
    const scoringV1 = computeScoring(validatedData);

    // Update status to GENERATING
    await prisma.diagnostic.update({
      where: { id: diagnosticId },
      data: {
        status: DiagnosticStatus.GENERATING,
        retryCount: { increment: 1 },
        errorCode: null,
        errorDetails: null,
      },
    });

    // Run generation
    try {
      const bilans = await generateBilans(validatedData, scoringV1);

      // Compute V2 scoring for quality flags
      const defKey = diagnostic.definitionKey || 'maths-premiere-p2';
      let scoringV2;
      try {
        const definition = getDefinition(defKey);
        scoringV2 = computeScoringV2(validatedData, definition.scoringPolicy);
      } catch {
        scoringV2 = computeScoringV2(validatedData);
      }

      const qualityFlags = buildQualityFlags({
        ragAvailable: false,
        ragHitCount: 0,
        llmSuccessCount: [bilans.eleve, bilans.parents, bilans.nexus].filter(Boolean).length,
        dataQuality: scoringV2.dataQuality.quality,
        coverageIndex: scoringV2.coverageIndex,
      });

      await prisma.diagnostic.update({
        where: { id: diagnosticId },
        data: {
          status: DiagnosticStatus.ANALYZED,
          analysisResult: JSON.stringify({
            eleve: bilans.eleve,
            parents: bilans.parents,
            nexus: bilans.nexus,
            generatedAt: new Date().toISOString(),
            retried: true,
          }),
          studentMarkdown: bilans.eleve,
          parentsMarkdown: bilans.parents,
          nexusMarkdown: bilans.nexus,
          analysisJson: {
            forces: scoringV2.domainScores
              .filter((d) => d.priority === 'low' || d.priority === 'medium')
              .map((d) => ({
                domain: d.domain,
                label: d.domain,
                detail: `Score: ${d.score}%`,
                evidence: `${d.evaluatedCount}/${d.totalCount} évalués`,
              })),
            faiblesses: scoringV2.domainScores
              .filter((d) => d.priority === 'critical' || d.priority === 'high')
              .map((d) => ({
                domain: d.domain,
                label: d.domain,
                detail: `Score: ${d.score}%`,
                evidence: d.gaps.join(', ') || 'aucun gap identifié',
              })),
            plan: [],
            ressources: [],
            qualityFlags,
            citations: [],
          },
          actionPlan: bilans.nexus,
          errorCode: null,
          errorDetails: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Bilan régénéré avec succès.',
        diagnosticId,
        status: DiagnosticStatus.ANALYZED,
      });
    } catch (bilanError) {
      const errorMessage = bilanError instanceof Error ? bilanError.message : 'Unknown error';
      const errorCode = errorMessage.includes('timeout')
        ? 'OLLAMA_TIMEOUT'
        : errorMessage.includes('Empty')
          ? 'OLLAMA_EMPTY_RESPONSE'
          : 'UNKNOWN_ERROR';

      console.error(`Retry failed for ${diagnosticId}:`, bilanError);

      await prisma.diagnostic.update({
        where: { id: diagnosticId },
        data: {
          status: DiagnosticStatus.FAILED,
          errorCode,
          errorDetails: errorMessage.substring(0, 500),
        },
      });

      return NextResponse.json(
        {
          error: 'La régénération a échoué',
          errorCode,
          diagnosticId,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Erreur retry diagnostic:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Données du diagnostic corrompues — validation échouée', details: error.message },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
