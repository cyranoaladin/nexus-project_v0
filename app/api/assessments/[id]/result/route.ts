/**
 * Assessment Result API
 * 
 * GET /api/assessments/[id]/result
 * 
 * Returns the complete assessment results for display,
 * including SSN, domain scores, skill scores, and cohort percentile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scoringResultSchema, analysisJsonSchema, safeParse } from '@/lib/assessments/core/schemas';
import { computePercentile } from '@/lib/core/statistics/normalize';
import { computeCohortStats } from '@/lib/core/statistics/cohort';
import { isCompletedAssessmentStatus, COMPLETED_STATUSES } from '@/lib/core/assessment-status';

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
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check if assessment is completed (uses centralized status helper)
    if (!isCompletedAssessmentStatus(assessment.status)) {
      return NextResponse.json(
        { error: 'Assessment not yet completed', status: assessment.status },
        { status: 400 }
      );
    }

    // Validate JSON fields with Zod schemas (type-safe at runtime)
    const scoringResult = safeParse(scoringResultSchema, assessment.scoringResult);
    const analysisJson = safeParse(analysisJsonSchema, assessment.analysisJson);

    // ─── Learning Graph v2: SSN, domain scores, skill scores ────────────────

    // Fetch SSN via raw query (column may not be in generated client yet)
    const ssnRows = await prisma.$queryRawUnsafe<{ ssn: number | null }[]>(
      `SELECT "ssn" FROM "assessments" WHERE "id" = $1`,
      id
    );
    const ssn = ssnRows[0]?.ssn ?? null;

    // Fetch domain scores
    let domainScores: { domain: string; score: number }[] = [];
    try {
      domainScores = await prisma.$queryRawUnsafe<{ domain: string; score: number }[]>(
        `SELECT "domain", "score" FROM "domain_scores" WHERE "assessmentId" = $1 ORDER BY "score" DESC`,
        id
      );
    } catch {
      // Table may not exist yet in dev — graceful fallback
    }

    // Fetch skill scores
    let skillScores: { skillTag: string; score: number }[] = [];
    try {
      skillScores = await prisma.$queryRawUnsafe<{ skillTag: string; score: number }[]>(
        `SELECT "skillTag", "score" FROM "skill_scores" WHERE "assessmentId" = $1 ORDER BY "score" ASC`,
        id
      );
    } catch {
      // Table may not exist yet in dev — graceful fallback
    }

    // ─── Cohort stats (strict: COMPLETED only, same subject) ────────────────

    const cohortStats = await computeCohortStats({ type: assessment.subject });

    // Compute cohort percentile if SSN is available
    let percentile: number | null = null;
    if (ssn !== null) {
      try {
        const cohortSSNs = await prisma.$queryRawUnsafe<{ ssn: number }[]>(
          `SELECT "ssn" FROM "assessments" WHERE "subject" = $1 AND "status" = ANY($2) AND "ssn" IS NOT NULL`,
          assessment.subject,
          COMPLETED_STATUSES as unknown as string[]
        );
        const distribution = cohortSSNs.map((r) => r.ssn);
        percentile = computePercentile(ssn, distribution);
      } catch {
        // Graceful fallback
      }
    }

    return NextResponse.json({
      ...assessment,
      scoringResult: scoringResult ?? assessment.scoringResult,
      analysisJson: analysisJson ?? assessment.analysisJson,
      // Learning Graph v2 fields
      ssn,
      domainScores,
      skillScores,
      percentile,
      // Cohort context (for SimulationPanel)
      cohortMean: Math.round(cohortStats.mean * 10) / 10,
      cohortStd: Math.round(cohortStats.std * 10) / 10,
      cohortN: cohortStats.n,
      isLowSample: cohortStats.isLowSample,
    });
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
