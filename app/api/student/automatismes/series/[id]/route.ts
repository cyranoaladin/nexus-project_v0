import { NextRequest, NextResponse } from "next/server";
import { PREMIERE_EDS_SIMULATIONS } from "@/data/automatismes/premiere-eds/simulations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    console.error("Error fetching automatisme series detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch series details" },
      { status: 500 }
    );
  }
}
