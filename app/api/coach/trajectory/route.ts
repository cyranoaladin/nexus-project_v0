import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { serializeError } from '@/lib/utils/serialize-error';
import { isCoachRattachedToStudent } from '@/lib/rbac/coach-student-access';
import { z } from 'zod';

const createTrajectorySchema = z.object({
  studentId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().trim().min(1).max(160),
  targetScore: z.coerce.number().finite().min(0).max(20).optional(),
  horizon: z.enum(['3_MONTHS', '6_MONTHS', '12_MONTHS']),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const session: any = await auth();
    if (!session?.user || (session.user.role !== "COACH" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = createTrajectorySchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid trajectory payload" }, { status: 400 });
    }
    const { studentId, title, targetScore, horizon } = parsedBody.data;

    if (session.user.role === "COACH") {
      const assigned = await isCoachRattachedToStudent(session.user.id, studentId);
      if (!assigned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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
    console.error("Error creating trajectory:", serializeError(error));
    return NextResponse.json(
      { error: "Failed to create trajectory" },
      { status: 500 }
    );
  }
}
