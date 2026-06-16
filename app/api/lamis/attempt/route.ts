import { NextResponse } from "next/server";
import { lamisExercises } from "@/src/data/lamisExercises";
import { recordAttempt } from "@/lib/lamis/progress";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const exercise = lamisExercises.find((item) => item.id === body.exerciseId);
  if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

  const attempt = recordAttempt(
    exercise,
    String(body.answer ?? ""),
    Number(body.attemptNumber ?? 1),
    Number(body.timeSpentSeconds ?? 0),
    Boolean(body.usedHint1),
    Boolean(body.usedHint2),
    Boolean(body.viewedCorrection),
  );

  return NextResponse.json({ attempt });
}
