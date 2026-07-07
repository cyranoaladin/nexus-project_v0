import { NextResponse } from "next/server";
import { lamisExercises } from "@/src/data/lamisExercises";
import { buildPedagogicalReport, isAnswerCorrect, isTooFast } from "@/lib/lamis/progress";
import type { LamisAttempt, LamisExercise } from "@/lib/lamis/types";
import { isErrorResponse, requireAnyRole } from "@/lib/guards";
import { guardRateLimitAsync } from "@/lib/rate-limit";
import { UserRole } from "@prisma/client";
import { z } from "zod";

const exercisesById = new Map<string, LamisExercise>(
  lamisExercises.map((ex) => [ex.id, ex])
);

const lamisAttemptSchema = z.object({
  exerciseId: z.string().min(1).max(120),
  answer: z.string().max(1000),
  isCorrect: z.boolean(),
  attemptNumber: z.number().int().min(1).max(20),
  timeSpentSeconds: z.number().int().min(0).max(3600),
  usedHint1: z.boolean(),
  usedHint2: z.boolean(),
  viewedCorrection: z.boolean(),
  tooFast: z.boolean(),
  timestamp: z.string().min(1).max(80),
}).strict();

const teacherReportBodySchema = z.object({
  attempts: z.array(lamisAttemptSchema).max(300).default([]),
}).strict();

export async function POST(request: Request) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.COACH]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const rateLimited = await guardRateLimitAsync(request, {
    preset: "api",
    keySuffix: "lamis-teacher-report",
    userId: sessionOrError.user.id,
  });
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => null);
  const parsed = teacherReportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  // Reject unknown exerciseIds
  const unknownIds = parsed.data.attempts
    .filter((a) => !exercisesById.has(a.exerciseId))
    .map((a) => a.exerciseId);
  if (unknownIds.length > 0) {
    return NextResponse.json(
      { error: "exerciseId inconnu", unknownIds },
      { status: 400 }
    );
  }

  // Recompute isCorrect and tooFast server-side — never trust client
  const attempts: LamisAttempt[] = parsed.data.attempts.map((a) => {
    const exercise = exercisesById.get(a.exerciseId)!;
    return {
      ...a,
      isCorrect: isAnswerCorrect(exercise, a.answer),
      tooFast: isTooFast(exercise, a.timeSpentSeconds),
    };
  });

  return NextResponse.json({ report: buildPedagogicalReport(lamisExercises, attempts) });
}

export async function GET(request: Request) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.COACH]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const rateLimited = await guardRateLimitAsync(request, {
    preset: "api",
    keySuffix: "lamis-teacher-report",
    userId: sessionOrError.user.id,
  });
  if (rateLimited) return rateLimited;

  return NextResponse.json({ report: buildPedagogicalReport(lamisExercises, []) });
}
