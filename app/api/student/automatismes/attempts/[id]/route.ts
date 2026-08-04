import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serializeError } from '@/lib/utils/serialize-error';
import { NextRequest,NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: import('next-auth').Session | null = await auth();
    const { id } = await params;

    if (!session?.user || session.user.role !== "ELEVE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attempt = await prisma.assessment.findUnique({
      where: { id },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    // Verify ownership
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    });

    if (attempt.studentId !== student?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(attempt);
  } catch (error) {
    console.error("Error fetching automatisme attempt detail:", serializeError(error));
    return NextResponse.json(
      { error: "Failed to fetch attempt" },
      { status: 500 }
    );
  }
}
