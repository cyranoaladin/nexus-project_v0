import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PREMIERE_EDS_SIMULATIONS } from "@/data/automatismes/premiere-eds/simulations";
import { serializeError } from '@/lib/utils/serialize-error';
import { z } from 'zod';

const checkAnswerSchema = z.object({
  seriesId: z.string().trim().min(1).max(80),
  questionId: z.string().trim().min(1).max(80),
  selectedChoiceId: z.string().trim().min(1).max(80),
}).strict();

/**
 * POST /api/student/automatismes/check-answer
 *
 * Mode entraînement : valide une réponse individuelle et retourne
 * le feedback pédagogique sans exposer toute la série.
 *
 * Sécurité : vérifie auth ELEVE + la série existe.
 * Ne retourne jamais la réponse correcte avant que l'élève ait soumis.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "ELEVE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const parsedBody = checkAnswerSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid answer payload" },
        { status: 400 }
      );
    }
    const { seriesId, questionId, selectedChoiceId } = parsedBody.data;

    const series = PREMIERE_EDS_SIMULATIONS.find((s) => s.id === seriesId);
    if (!series) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    const question = series.questions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const isCorrect = selectedChoiceId === question.correctChoiceId;

    return NextResponse.json({
      isCorrect,
      correctChoiceId: question.correctChoiceId,
      feedback: isCorrect ? question.feedbackCorrect : question.feedbackWrong,
      method: question.method,
      trap: question.trap,
      remediation: question.remediation,
      sourceReference: question.sourceReference,
      sourceComment: question.sourceComment,
    });
  } catch (error) {
    console.error("Error checking automatisme answer:", serializeError(error));
    return NextResponse.json(
      { error: "Failed to check answer" },
      { status: 500 }
    );
  }
}
