/**
 * Assessment Result API
 * 
 * GET /api/assessments/[id]/result
 * 
 * Returns the complete assessment results for display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch assessment from database
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: {
        id: true,
        subject: true,
        grade: true,
        studentName: true,
        studentEmail: true,
        globalScore: true,
        confidenceIndex: true,
        scoringResult: true,
        analysisJson: true,
        studentMarkdown: true,
        parentsMarkdown: true,
        status: true,
        createdAt: true,
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

    // Check if assessment is completed
    if (assessment.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          error: 'Assessment not yet completed',
          status: assessment.status,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(assessment);
  } catch (error) {
    console.error('[Assessment Result] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
