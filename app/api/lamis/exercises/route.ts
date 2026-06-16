import { NextResponse } from "next/server";
import { lamisExercises } from "@/src/data/lamisExercises";

export function GET() {
  return NextResponse.json({ exercises: lamisExercises });
}
