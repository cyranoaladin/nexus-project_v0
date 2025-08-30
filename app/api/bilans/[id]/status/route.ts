import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bilanId = params.id;

    if (!bilanId) {
      return NextResponse.json({ error: "Bilan ID is required" }, { status: 400 });
    }

    const bilan = await prisma.bilanPremium.findUnique({
      where: { id: bilanId },
      include: { student: true },
    });

    if (!bilan) {
      return NextResponse.json({ error: "Bilan not found" }, { status: 404 });
    }

    // ACL Checks
    const { user } = session;
    if (user.role === UserRole.ELEVE && bilan.studentId !== user.studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role === UserRole.PARENT) {
       const parent = await prisma.parentProfile.findUnique({
        where: { userId: user.id },
        include: { children: { select: { id: true } } },
      });
      if (!parent || !parent.children.some(child => child.id === bilan.studentId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ status: bilan.status, pdfUrl: bilan.pdfUrl });
  } catch (error) {
    console.error("Failed to fetch bilan status:", error);
    return NextResponse.json({ error: "Failed to fetch bilan status" }, { status: 500 });
  }
}
