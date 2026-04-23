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
import { AssessmentStatus } from '@prisma/client';
import { scoringResultSchema, analysisJsonSchema, safeParse } from '@/lib/assessments/core/schemas';
import { computePercentile } from '@/lib/core/statistics/normalize';
import { computeCohortStats } from '@/lib/core/statistics/cohort';
import { isCompletedAssessmentStatus, COMPLETED_STATUSES } from '@/lib/core/assessment-status';
import { getCanonicalDomains } from '@/lib/assessments/core/config';

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
        errorCode: true,
        createdAt: true,
        ssn: true,
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

    // F18 — Fetch SSN via Prisma (already loaded in assessment, but ensure fresh value)
    const ssn = assessment.ssn ?? null;

    // F18 — Fetch domain scores via Prisma client typé
    const domainScores = await prisma.domainScore.findMany({
      where: { assessmentId: id },
      orderBy: { score: 'desc' },
      select: { domain: true, score: true },
    });

    // Backfill canonical domains: ensure all expected domains are present (0 if absent)
    const canonical = getCanonicalDomains(assessment.subject);
    const domainMap = new Map(domainScores.map((d) => [d.domain, d.score]));
    const completeDomainScores = canonical.map((domain) => ({
      domain,
      score: domainMap.get(domain) ?? 0,
    }));

    // F18 — Fetch skill scores via Prisma client typé
    const skillScores = await prisma.skillScore.findMany({
      where: { assessmentId: id },
      orderBy: { score: 'asc' },
      select: { skillTag: true, score: true },
    });

    // ─── Cohort stats (strict: COMPLETED only, same subject) ────────────────

    const cohortStats = await computeCohortStats({ type: assessment.subject });

    // F18 — Compute cohort percentile if SSN is available via Prisma
    let percentile: number | null = null;
    if (ssn !== null) {
      const cohortAssessments = await prisma.assessment.findMany({
        where: {
          subject: assessment.subject,
          status: { in: COMPLETED_STATUSES as unknown as AssessmentStatus[] },
          ssn: { not: null },
        },
        select: { ssn: true },
      });
      const distribution = cohortAssessments.map((a) => a.ssn!);
      percentile = computePercentile(ssn, distribution);
    }

    // Determine LLM generation status for UI fallback
    const llmFailed = assessment.errorCode === 'LLM_GENERATION_FAILED';
    const hasBilans = !!(assessment.studentMarkdown || assessment.parentsMarkdown);
    const generationStatus = hasBilans ? 'COMPLETE' : (llmFailed ? 'FAILED' : 'PENDING');

    return NextResponse.json({
      ...assessment,
      scoringResult: scoringResult ?? assessment.scoringResult,
      analysisJson: analysisJson ?? assessment.analysisJson,
      // Learning Graph v2 fields
      ssn,
      domainScores: completeDomainScores,
      skillScores,
      percentile,
      // Cohort context (for SimulationPanel)
      cohortMean: Math.round(cohortStats.mean * 10) / 10,
      cohortStd: Math.round(cohortStats.std * 10) / 10,
      cohortN: cohortStats.n,
      isLowSample: cohortStats.isLowSample,
      // LLM generation status (P0: LLM failure must not block results)
      generationStatus,
      ...(llmFailed && !hasBilans ? { llmUnavailableMessage: 'L\'analyse IA personnalisée est temporairement indisponible. Vos scores et résultats sont disponibles.' } : {}),
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
