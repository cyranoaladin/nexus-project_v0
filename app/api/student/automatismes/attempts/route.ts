import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PREMIERE_EDS_SIMULATIONS } from "@/data/automatismes/premiere-eds/simulations";
import { calculateAutomatismeScore } from "@/lib/automatismes/scoring";

export async function POST(request: NextRequest) {
  try {
    const session: any = await auth();

    if (!session?.user || session.user.role !== "ELEVE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { seriesId, answers, durationSeconds } = body;

    if (!seriesId || !answers) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const series = PREMIERE_EDS_SIMULATIONS.find(s => s.id === seriesId);
    if (!series) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Calculate score
    const result = calculateAutomatismeScore(answers, series, durationSeconds);

    // Save to Assessment table
    const assessment = await prisma.assessment.create({
      data: {
        studentId: student.id,
        studentEmail: session.user.email || "",
        studentName: `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim(),
        subject: "MATHS",
        grade: "PREMIERE",
        answers: answers,
        duration: durationSeconds * 1000, // stored in ms
        completedAt: new Date(),
        status: "COMPLETED",
        globalScore: result.percentage,
        scoringResult: result as any,
        assessmentVersion: `automatismes_premiere_eds_v1_${seriesId}`,
        engineVersion: "automatisme_scorer_v1",
      },
    });

    return NextResponse.json({
      id: assessment.id,
      result,
      series // Include the full series with corrections for the result view
    });
  } catch (error) {
    console.error("Error saving automatisme attempt:", error);
    return NextResponse.json(
      { error: "Failed to save attempt" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session: any = await auth();

    if (!session?.user || session.user.role !== "ELEVE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Fetch previous attempts
    const attempts = await prisma.assessment.findMany({
      where: {
        studentId: student.id,
        assessmentVersion: {
          startsWith: "automatismes_premiere_eds_v1",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(attempts);
  } catch (error) {
    console.error("Error fetching automatisme attempts:", error);
    return NextResponse.json(
      { error: "Failed to fetch attempts" },
      { status: 500 }
    );
  }
}
