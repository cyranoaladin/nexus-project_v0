/**
 * Assessment Status API
 * 
 * GET /api/assessments/[id]/status
 * 
 * Returns the current status of an assessment for polling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assessmentStatusSchema, type AssessmentStatus } from '../../submit/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Fetch assessment from database
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        progress: true,
        globalScore: true,
        confidenceIndex: true,
        errorCode: true,
        errorDetails: true,
      },
    });

    if (!assessment) {
      return NextResponse.json(
        {
          error: 'Assessment not found',
        },
        { status: 404 }
      );
    }

    // Build response
    const response: AssessmentStatus = {
      id: assessment.id,
      status: assessment.status as any,
      progress: assessment.progress,
      message: getStatusMessage(assessment.status as any),
      result:
        assessment.status === 'COMPLETED' && assessment.globalScore !== null
          ? {
              globalScore: assessment.globalScore,
              confidenceIndex: assessment.confidenceIndex || 0,
              recommendations: [], // TODO: Extract from analysisJson
            }
          : undefined,
    };

    // Validate response
    const validatedResponse = assessmentStatusSchema.parse(response);

    return NextResponse.json(validatedResponse);
  } catch (error) {
    console.error('[Assessment Status] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get user-friendly status message
 */
function getStatusMessage(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Votre évaluation est en attente de traitement...';
    case 'SCORING':
      return 'Calcul de vos résultats en cours...';
    case 'GENERATING':
      return 'Génération de votre bilan personnalisé...';
    case 'COMPLETED':
      return 'Votre bilan est prêt !';
    case 'FAILED':
      return 'Une erreur est survenue lors du traitement.';
    default:
      return 'Traitement en cours...';
  }
}
