import { NextResponse } from "next/server";
import { lamisExercises } from "@/src/data/lamisExercises";
import { computeProgressSummary } from "@/lib/lamis/progress";
import type { LamisAttempt } from "@/lib/lamis/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const attempts = Array.isArray(body.attempts) ? (body.attempts as LamisAttempt[]) : [];
  return NextResponse.json(computeProgressSummary(lamisExercises, attempts));
}

export function GET() {
  return NextResponse.json(computeProgressSummary(lamisExercises, []));
}
