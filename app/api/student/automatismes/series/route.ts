import { NextResponse } from "next/server";
import { PREMIERE_EDS_SIMULATIONS } from "@/data/automatismes/premiere-eds/simulations";

export async function GET() {
  try {
    // We return only metadata for the list
    const seriesList = PREMIERE_EDS_SIMULATIONS.map(series => ({
      id: series.id,
      title: series.title,
      subtitle: series.subtitle,
      description: series.description,
      grade: series.grade,
      subject: series.subject,
      examType: series.examType,
      format: series.format,
      recommendedDurationMinutes: series.recommendedDurationMinutes,
      questionCount: series.questions.length,
    }));

    return NextResponse.json(seriesList);
  } catch (error) {
    console.error("Error fetching automatismes series:", error);
    return NextResponse.json(
      { error: "Failed to fetch series" },
      { status: 500 }
    );
  }
}
