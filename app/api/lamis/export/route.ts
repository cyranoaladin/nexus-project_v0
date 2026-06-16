import { NextResponse } from "next/server";
import { lamisExercises } from "@/src/data/lamisExercises";
import { exportAttemptsCsv } from "@/lib/lamis/progress";
import type { LamisAttempt } from "@/lib/lamis/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const attempts = Array.isArray(body.attempts) ? (body.attempts as LamisAttempt[]) : [];
  return new NextResponse(exportAttemptsCsv(lamisExercises, attempts), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=lamis-attempts.csv",
    },
  });
}

export function GET() {
  return NextResponse.json({ exercises: lamisExercises });
}
