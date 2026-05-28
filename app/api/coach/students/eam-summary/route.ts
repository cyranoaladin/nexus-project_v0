export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MODULES } from "@/components/EAMPrep/data";
import { calculateProgressPercent, normalizeProgress } from "@/hooks/eamProgressCore";

type EamProgressRow = {
  user_id: string;
  checks: Prisma.JsonValue;
  quiz: Prisma.JsonValue;
  updated_at: Date;
};

const TOTAL_CHECKLIST = MODULES.reduce((sum, module) => sum + module.checklist.length, 0);
const MODULE_IDS = new Set(MODULES.map((module) => module.id));
const MOCK_EXAM_KEY = "mock_exam_1";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!coach) {
      return NextResponse.json({ error: "Coach profile not found" }, { status: 404 });
    }

    const [assignments, bookings] = await Promise.all([
      prisma.coachStudentAssignment.findMany({
        where: {
          coachId: coach.id,
          status: "ACTIVE",
          startsAt: { lte: new Date() },
          OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
        },
        select: {
          student: { select: { userId: true } },
        },
      }),
      prisma.sessionBooking.findMany({
        where: { coachId: session.user.id },
        distinct: ["studentId"],
        select: { studentId: true },
      }),
    ]);

    const studentUserIds = Array.from(
      new Set([
        ...assignments.map((assignment) => assignment.student.userId),
        ...bookings.map((booking) => booking.studentId),
      ]),
    ).filter(Boolean);

    if (studentUserIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const rows = await prisma.$queryRaw<EamProgressRow[]>`
      SELECT user_id, checks, quiz, updated_at
      FROM eam_progress
      WHERE user_id IN (${Prisma.join(studentUserIds)})
    `;

    const data = rows.map((row) => {
      const progress = normalizeProgress({
        checks: row.checks,
        quiz: row.quiz,
        lastUpdated: row.updated_at.toISOString(),
      });
      const totalChecked = Object.values(progress.checks).filter(Boolean).length;
      const quizDone = Object.entries(progress.quiz).filter(
        ([key, value]) => MODULE_IDS.has(key) && value.done,
      ).length;
      const mockExam = progress.quiz[MOCK_EXAM_KEY];

      return {
        userId: row.user_id,
        pct: calculateProgressPercent(totalChecked, TOTAL_CHECKLIST),
        totalChecked,
        quizDone,
        mockExamDone: Boolean(mockExam?.done),
        mockExamScore: mockExam?.done ? mockExam.score : null,
        mockExamTotal: mockExam?.done ? mockExam.total : null,
        lastUpdated: progress.lastUpdated,
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[Coach EAM summary GET] failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
