import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PREMIERE_EDS_SIMULATIONS } from "@/data/automatismes/premiere-eds/simulations";

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

    const body = await request.json();
    const { seriesId, questionId, selectedChoiceId } = body;

    if (!seriesId || !questionId || !selectedChoiceId) {
      return NextResponse.json(
        { error: "Missing required fields: seriesId, questionId, selectedChoiceId" },
        { status: 400 }
      );
    }

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
    console.error("Error checking automatisme answer:", error);
    return NextResponse.json(
      { error: "Failed to check answer" },
      { status: 500 }
    );
  }
}
