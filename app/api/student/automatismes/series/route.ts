import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PREMIERE_EDS_SIMULATIONS } from "@/data/automatismes/premiere-eds/simulations";
import { serializeError } from '@/lib/utils/serialize-error';

export async function GET() {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!session?.user || session.user.role !== "ELEVE" || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (userId) {
      const student = await prisma.student.findUnique({
        where: { userId },
        select: { academicTrack: true },
      });
      if (
        student?.academicTrack === "STMG" ||
        student?.academicTrack === "STMG_NON_LYCEEN"
      ) {
        return NextResponse.json({
          series: [],
          message:
            "Les automatismes EDS ne font pas partie du parcours STMG. Accédez à vos modules depuis votre tableau de bord.",
        });
      }
    }

    const seriesList = PREMIERE_EDS_SIMULATIONS.map((series) => ({
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
    console.error("Error fetching automatismes series:", serializeError(error));
    return NextResponse.json(
      { error: "Failed to fetch series" },
      { status: 500 }
    );
  }
}
