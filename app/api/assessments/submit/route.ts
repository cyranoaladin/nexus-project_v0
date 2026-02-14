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
import { QuestionBank } from '@/lib/assessments/questions';
import { ScoringFactory } from '@/lib/assessments/scoring';
import { BilanGenerator } from '@/lib/assessments/generators';
import { Subject, Grade } from '@/lib/assessments/core/types';
import type { StudentAnswer } from '@/lib/assessments/core/types';
import { submitAssessmentSchema, type SubmitAssessmentResponse } from './types';
import { headers } from 'next/headers';

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
    const headersList = headers();
    const userAgent = headersList.get('user-agent') || undefined;
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;

    console.log(`[Assessment Submit] ${subject} ${grade} - ${studentData.email}`);

    // ─── Step 1: Load Questions ──────────────────────────────────────────────

    const questions = await QuestionBank.loadAll(subject as Subject, grade as Grade);

    if (questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No questions available for this combination',
        },
        { status: 404 }
      );
    }

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

    // ─── Step 4: Persist to Database ─────────────────────────────────────────

    const assessment = await prisma.assessment.create({
      data: {
        subject: subject as string,
        grade: grade as string,
        studentEmail: studentData.email,
        studentName: studentData.name,
        studentPhone: studentData.phone,
        studentMetadata: studentData.schoolYear ? { schoolYear: studentData.schoolYear } : undefined,
        answers: answers as any,
        duration,
        startedAt: metadata?.startedAt ? new Date(metadata.startedAt) : undefined,
        completedAt: metadata?.completedAt ? new Date(metadata.completedAt) : new Date(),
        scoringResult: scoringResult as any,
        globalScore: scoringResult.globalScore,
        confidenceIndex: scoringResult.confidenceIndex,
        status: 'SCORING',
        progress: 50, // Scoring complete, generation pending
        userAgent,
        ipAddress,
      },
    });

    console.log(`[Assessment Submit] Created assessment ${assessment.id}`);

    // ─── Step 5: Trigger Async Bilan Generation ─────────────────────────────

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

