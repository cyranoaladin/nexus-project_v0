import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string; }; }
) {
  const session = await getServerSession(authOptions);
  const studentId = params.studentId;

  if (!session || (session.user.role !== 'ELEVE' && session.user.role !== 'PARENT')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Pour l'instant, nous retournons une liste vide.
    // La logique de récupération des badges sera implémentée plus tard.
    const badges = await prisma.studentBadge.findMany({
      where: {
        studentId: studentId,
      },
      include: {
        badge: true,
      },
    });

    return NextResponse.json(badges);
  } catch (error) {
    console.error(`Error fetching badges for student ${studentId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
