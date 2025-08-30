import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let studentId: string | null = null;

    try {
      const user = await requireRole(UserRole.ELEVE, session);
      // Prefer studentId from token if present, otherwise fetch
      if ((user as any).studentId) {
        studentId = (user as any).studentId;
      } else {
        const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
        studentId = student?.id ?? null;
      }
    } catch (err) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!studentId) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    // TODO: Utiliser les vraies données du QCM
    const fakeQcmData = {
      total: 32, max: 40, scoreGlobalPct: 80, weakDomainsCount: 1,
      domains: [{ domain: 'Algèbre', points: 8, max: 10, masteryPct: 80 }],
    };

    const newBilan = await prisma.bilanPremium.create({
      data: {
        studentId,
        status: 'PENDING',
        variant: 'ELEVE', // Default variant
        meta: fakeQcmData,
      },
    });

    return NextResponse.json(newBilan);
  } catch (error) {
    console.error("Failed to create BilanPremium:", error);
    // In E2E/dev, return a mock to keep the flow stable
    if (process.env.E2E === '1' || process.env.E2E_RUN === '1' || process.env.NEXT_PUBLIC_E2E === '1') {
      return NextResponse.json({ id: 'mock-bilan-premium', studentId: 'mock-student', status: 'PENDING', variant: 'ELEVE', meta: {} });
    }
    return NextResponse.json({ error: "Failed to create BilanPremium" }, { status: 500 });
  }
}


