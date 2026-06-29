import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PREMIERE_EDS_SIMULATIONS } from "@/data/automatismes/premiere-eds/simulations";
import { serializeError } from '@/lib/utils/serialize-error';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ELEVE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const series = PREMIERE_EDS_SIMULATIONS.find(s => s.id === id);

    if (!series) {
      return NextResponse.json(
        { error: "Series not found" },
        { status: 404 }
      );
    }

    // Version "safe" sans les réponses ni les feedbacks
    const safeSeries = {
      ...series,
      questions: series.questions.map(q => {
        const { 
          correctChoiceId, 
          feedbackCorrect, 
          feedbackWrong, 
          method, 
          trap, 
          remediation,
          sourceReference,
          sourceComment,
          ...safeQuestion 
        } = q;
        return safeQuestion;
      })
    };

    return NextResponse.json(safeSeries);
  } catch (error) {
    console.error("Error fetching automatisme series detail:", serializeError(error));
    return NextResponse.json(
      { error: "Failed to fetch series details" },
      { status: 500 }
    );
  }
}
