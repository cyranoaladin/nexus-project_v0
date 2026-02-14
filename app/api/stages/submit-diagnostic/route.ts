/**
 * POST /api/stages/submit-diagnostic
 *
 * Receives student answers, runs the V3 scoring engine, and persists
 * the result to the StageReservation record.
 *
 * Payload: { email: string, reservationId?: string, answers: SubmittedAnswer[] }
 * Response: { success: true, globalScore, confidenceIndex, precisionIndex, redirectUrl }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { computeStageScore } from '@/lib/scoring-engine';
import type { StudentAnswer, AnswerStatus } from '@/lib/scoring-engine';
import { ALL_STAGE_QUESTIONS } from '@/lib/data/stage-qcm-structure';

// ─── Validation Schema ───────────────────────────────────────────────────────

const submittedAnswerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionId: z.string().nullable(),
  isNSP: z.boolean(),
});

const submitDiagnosticSchema = z.object({
  email: z.string().email('Email invalide'),
  reservationId: z.string().optional(),
  answers: z
    .array(submittedAnswerSchema)
    .min(1, 'Au moins une réponse requise')
    .max(100, 'Trop de réponses'),
});

type SubmittedAnswer = z.infer<typeof submittedAnswerSchema>;

// ─── Helper: Convert submitted answers to scoring engine format ──────────────

function toStudentAnswers(submitted: SubmittedAnswer[]): StudentAnswer[] {
  const questionMap = new Map(ALL_STAGE_QUESTIONS.map((q) => [q.id, q]));

  return submitted.map((ans) => {
    const question = questionMap.get(ans.questionId);

    let status: AnswerStatus;
    if (ans.isNSP || ans.selectedOptionId === null) {
      status = 'nsp';
    } else if (question) {
      const correctOption = question.options.find((o) => o.isCorrect);
      status = correctOption && correctOption.id === ans.selectedOptionId ? 'correct' : 'incorrect';
    } else {
      status = 'incorrect';
    }

    return {
      questionId: ans.questionId,
      status,
    };
  });
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Parse & validate
    const body = await request.json();
    const parsed = submitDiagnosticSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json(
        { success: false, error: 'Données invalides', fieldErrors },
        { status: 400 }
      );
    }

    const { email, reservationId, answers } = parsed.data;

    // 2. Find the reservation
    let reservation;
    if (reservationId) {
      reservation = await prisma.stageReservation.findUnique({
        where: { id: reservationId },
      });
    }

    if (!reservation) {
      // Fallback: find by email (most recent reservation)
      reservation = await prisma.stageReservation.findFirst({
        where: { email: email.toLowerCase() },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!reservation) {
      return NextResponse.json(
        {
          success: false,
          error: 'Aucune réservation trouvée pour cet email. Inscris-toi d\'abord au stage.',
        },
        { status: 404 }
      );
    }

    // 3. Check if already scored
    if (reservation.scoringResult !== null) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tu as déjà passé le diagnostic. Un seul passage est autorisé.',
        },
        { status: 409 }
      );
    }

    // 4. Convert answers and run scoring engine
    const studentAnswers = toStudentAnswers(answers);
    const questionMetadata = ALL_STAGE_QUESTIONS.map((q) => ({
      id: q.id,
      subject: q.subject,
      category: q.category,
      competence: q.competence,
      weight: q.weight,
      nsiErrorType: q.nsiErrorType,
      label: q.label,
    }));

    const scoringResult = computeStageScore(studentAnswers, questionMetadata);

    // 5. Persist to DB
    await prisma.stageReservation.update({
      where: { id: reservation.id },
      data: {
        scoringResult: JSON.parse(JSON.stringify(scoringResult)),
      },
    });

    // 6. Log (PII-safe)
    console.log('[submit-diagnostic] Scored', {
      reservationId: reservation.id,
      academyId: reservation.academyId,
      globalScore: Math.round(scoringResult.globalScore),
      confidenceIndex: Math.round(scoringResult.confidenceIndex),
      totalQuestions: scoringResult.totalQuestions,
      totalAttempted: scoringResult.totalAttempted,
    });

    // 7. Return result
    return NextResponse.json(
      {
        success: true,
        globalScore: scoringResult.globalScore,
        confidenceIndex: scoringResult.confidenceIndex,
        precisionIndex: scoringResult.precisionIndex,
        strengths: scoringResult.strengths,
        weaknesses: scoringResult.weaknesses,
        redirectUrl: '/stages/fevrier-2026',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[submit-diagnostic] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      { success: false, error: 'Erreur serveur. Réessaie dans quelques instants.' },
      { status: 500 }
    );
  }
}
