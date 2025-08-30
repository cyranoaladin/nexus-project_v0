import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/authz";
import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    requireRole([UserRole.ADMIN, UserRole.ASSISTANTE], session);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    if (!search || search.length < 3) {
      return NextResponse.json([]);
    }

    const students = await prisma.student.findMany({
      where: {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ],
      },
      take: 10,
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    return NextResponse.json(students);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    if (errorMessage.includes("Unauthorized")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("Failed to search students:", error);
    return NextResponse.json({ error: "Failed to search students", details: errorMessage }, { status: 500 });
  }
}

