import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
  try {
    const session: any = await auth();
    if (!session?.user || (session.user.role !== "COACH" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studentId, title, targetScore, horizon } = await request.json();

    if (!studentId || !title || !horizon) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Calculate endDate based on horizon
    const months = horizon === "3_MONTHS" ? 3 : horizon === "6_MONTHS" ? 6 : 12;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    // Deactivate previous active trajectories
    await prisma.trajectory.updateMany({
      where: { studentId, status: "ACTIVE" },
      data: { status: "COMPLETED" },
    });

    const trajectory = await prisma.trajectory.create({
      data: {
        studentId,
        title,
        targetScore,
        horizon,
        endDate,
        createdBy: session.user.id,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(trajectory);
  } catch (error) {
    console.error("Error creating trajectory:", error);
    return NextResponse.json(
      { error: "Failed to create trajectory" },
      { status: 500 }
    );
  }
}
