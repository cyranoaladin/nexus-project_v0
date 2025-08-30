import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest, { params }: { params: { bilanId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bilanId } = params;
    if (!bilanId) {
      return NextResponse.json({ error: "Bilan ID is required" }, { status: 400 });
    }

    const bilan = await prisma.bilanPremium.findUnique({
      where: { id: bilanId },
      select: { studentId: true }
    });

    if (!bilan) {
      return NextResponse.json({ error: "Bilan Premium not found" }, { status: 404 });
    }

    // ACL Check: Only the student themselves can submit their Volet 2
    if (session.user.role !== UserRole.ELEVE || session.user.studentId !== bilan.studentId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const volet2Summary = await req.json();

    await prisma.bilanPremium.update({
      where: { id: bilanId },
      data: {
        volet2Summary: volet2Summary as any,
      },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Failed to save Volet 2 data:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to save data", details: errorMessage }, { status: 500 });
  }
}
