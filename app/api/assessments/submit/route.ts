/**
 * Universal Assessment Submission API
 * 
 * POST /api/assessments/submit
 * 
 * Accepts any subject/grade combination and processes it through:
 * 1. QuestionBank.loadAll() - Get correct answers
 * 2. ScoringFactory.create() - Compute scores
 * 3. Prisma - Persist results
 * 4. Async job - Generate bilan (fire and forget)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { QuestionBank } from '@/lib/assessments/questions';
import { ScoringFactory } from '@/lib/assessments/scoring';
import { BilanGenerator } from '@/lib/assessments/generators';
import { Subject, Grade } from '@/lib/assessments/core/types';
import type { StudentAnswer } from '@/lib/assessments/core/types';
import { scoringResultSchema } from '@/lib/assessments/core/schemas';
import { submitAssessmentSchema, type SubmitAssessmentResponse } from './types';
import { headers } from 'next/headers';
import { incrementRawSqlFailure } from '@/lib/core/raw-sql-monitor';
import { backfillCanonicalDomains } from '@/lib/assessments/core/config';

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request
    const body = await request.json();
    const validationResult = submitAssessmentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { subject, grade, studentData, answers, duration, metadata } = validationResult.data;

    // Get user agent and IP for tracking
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || undefined;
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;

    console.log(`[Assessment Submit] ${subject} ${grade} - ${studentData.email}`);

    // ─── Step 1: Load Questions (version-aware) ─────────────────────────────

    const requestedVersion = (body as Record<string, unknown>)?.assessmentVersion as string | undefined;
    const { questions, resolvedVersion } = await QuestionBank.loadByVersion(
      requestedVersion,
      subject as Subject,
      grade as Grade
    );

    if (questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No questions available for this combination',
        },
        { status: 404 }
      );
    }

    console.log(`[Assessment Submit] Loaded ${questions.length}Q, version=${resolvedVersion}`);

    // ─── Step 2: Convert Answers to StudentAnswer Format ────────────────────

    const studentAnswers: StudentAnswer[] = Object.entries(answers).map(([questionId, optionId]) => {
      const question = questions.find((q) => q.id === questionId);
      
      if (!question) {
        return {
          questionId,
          status: 'nsp' as const,
        };
      }

      // Check if answer is correct
      const selectedOption = question.options.find((opt) => opt.id === optionId);
      const isCorrect = selectedOption?.isCorrect || false;

      return {
        questionId,
        status: isCorrect ? ('correct' as const) : ('incorrect' as const),
      };
    });

    // ─── Step 3: Compute Scoring ─────────────────────────────────────────────

    const scorer = ScoringFactory.create(subject as Subject, grade as Grade);
    const scoringResult = scorer.compute(
      studentAnswers,
      questions.map((q) => ({
        id: q.id,
        subject: q.subject,
        category: q.category,
        weight: q.weight,
        competencies: q.competencies,
        nsiErrorType: q.nsiErrorType,
      }))
    );

    console.log(`[Assessment Submit] Score: ${scoringResult.globalScore}/100, Confidence: ${scoringResult.confidenceIndex}/100`);

    // ─── Step 4: Validate & Persist to Database ──────────────────────────────

    // Validate scoringResult shape before persisting (runtime type safety)
    const validatedScoring = scoringResultSchema.safeParse(scoringResult);
    if (!validatedScoring.success) {
      console.error('[Assessment Submit] Scoring result validation failed:', validatedScoring.error.flatten());
    }

    const assessment = await prisma.assessment.create({
      data: {
        subject: subject as string,
        grade: grade as string,
        studentEmail: studentData.email,
        studentName: studentData.name,
        studentPhone: studentData.phone,
        studentMetadata: studentData.schoolYear ? { schoolYear: studentData.schoolYear } : undefined,
        answers: answers as Prisma.InputJsonValue,
        duration,
        startedAt: metadata?.startedAt ? new Date(metadata.startedAt) : undefined,
        completedAt: metadata?.completedAt ? new Date(metadata.completedAt) : new Date(),
        scoringResult: JSON.parse(JSON.stringify(validatedScoring.success ? validatedScoring.data : scoringResult)) as Prisma.InputJsonValue,
        globalScore: scoringResult.globalScore,
        confidenceIndex: scoringResult.confidenceIndex,
        status: 'SCORING',
        progress: 50, // Scoring complete, generation pending
        userAgent,
        ipAddress,
      },
    });

    console.log(`[Assessment Submit] Created assessment ${assessment.id}`);

    // Persist assessmentVersion + engineVersion (raw SQL — columns may not be in generated client)
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "assessments" SET "assessmentVersion" = $1, "engineVersion" = $2 WHERE "id" = $3`,
        resolvedVersion,
        'scoring_v2',
        assessment.id
      );
    } catch (versionError) {
      // ┌─────────────────────────────────────────────────────────────────────┐
      // │ TODO [TICKET NEX-42]: Remove this try/catch after migrate deploy  │
      // │ on production. Once 20260217_learning_graph_v2 is applied and     │
      // │ `npx prisma generate` regenerates the client, switch to typed     │
      // │ Prisma fields: assessment.update({ assessmentVersion, ... })      │
      // └─────────────────────────────────────────────────────────────────────┘
      const failCount = incrementRawSqlFailure();
      const errMsg = versionError instanceof Error ? versionError.message : 'unknown';
      if (process.env.NODE_ENV === 'production') {
        console.error(`[Assessment Submit] PROD: assessmentVersion persistence FAILED (count=${failCount}):`, errMsg);
        // Sentry capture if available
        try { const Sentry = await import('@sentry/nextjs'); Sentry.captureException(versionError); } catch { /* Sentry not installed */ }
      } else {
        console.warn(`[Assessment Submit] Version persistence skipped (dev):`, errMsg);
      }
    }

    // ─── Step 5: Persist DomainScore rows from categoryScores ───────────────

    try {
      const metrics = scoringResult.metrics as unknown as Record<string, unknown>;
      const categoryScores = (metrics?.categoryScores ?? {}) as Record<string, number | undefined>;

      // Backfill with canonical domains — guarantees all domains are persisted (0 if absent)
      const completeDomains = backfillCanonicalDomains(subject, categoryScores);

      for (const [domain, score] of Object.entries(completeDomains)) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "domain_scores" ("id", "assessmentId", "domain", "score", "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
          assessment.id,
          domain,
          score
        );
      }

      console.log(`[Assessment Submit] DomainScores persisted for ${assessment.id} (${Object.keys(completeDomains).length} canonical domains)`);
    } catch (domainError) {
      // ┌─────────────────────────────────────────────────────────────────────┐
      // │ TODO [TICKET NEX-43]: Remove this try/catch after migrate deploy  │
      // │ on production. Once domain_scores table is guaranteed by          │
      // │ 20260217_learning_graph_v2, use typed Prisma create().            │
      // └─────────────────────────────────────────────────────────────────────┘
      const failCount = incrementRawSqlFailure();
      const errMsg = domainError instanceof Error ? domainError.message : 'unknown';
      if (process.env.NODE_ENV === 'production') {
        console.error(`[Assessment Submit] PROD: DomainScore persistence FAILED for ${assessment.id} (count=${failCount}):`, errMsg);
        // Sentry capture if available
        try { const Sentry = await import('@sentry/nextjs'); Sentry.captureException(domainError); } catch { /* Sentry not installed */ }
      } else {
        console.warn(`[Assessment Submit] DomainScore persistence skipped (dev):`, errMsg);
      }
    }

    // ─── Step 6: Compute SSN (non-blocking) ───────────────────────────────────

    // Fire and forget - SSN computation should not block the response
    import('@/lib/core/ssn/computeSSN').then(({ computeAndPersistSSN }) => {
      computeAndPersistSSN(assessment.id).catch((error) => {
        console.error(`[Assessment Submit] SSN computation failed for ${assessment.id}:`, error);
      });
    });

    // ─── Step 7: Trigger Async Bilan Generation ─────────────────────────────

    // Fire and forget - don't block the response
    BilanGenerator.generate(assessment.id).catch((error) => {
      console.error(`[Assessment Submit] Bilan generation failed for ${assessment.id}:`, error);
    });

    // ─── Step 6: Return Response ─────────────────────────────────────────────

    const response: SubmitAssessmentResponse = {
      success: true,
      assessmentId: assessment.id,
      redirectUrl: `/assessments/${assessment.id}/processing`,
      message: 'Assessment submitted successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[Assessment Submit] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

