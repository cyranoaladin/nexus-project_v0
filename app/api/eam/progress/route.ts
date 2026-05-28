import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeProgress, type EAMProgressData } from "@/hooks/eamProgressCore";

export const dynamic = "force-dynamic";

type EamProgressRow = {
  checks: Prisma.JsonValue;
  quiz: Prisma.JsonValue;
  updated_at: Date;
};

const EAMProgressBodySchema = z.object({
  checks: z.record(z.string(), z.boolean()).optional().default({}),
  quiz: z
    .record(
      z.string(),
      z.object({
        score: z.number().int().min(0).max(100),
        total: z.number().int().min(1).max(100),
        done: z.boolean(),
        completedAt: z.string().datetime().optional(),
      }),
    )
    .optional()
    .default({}),
  lastUpdated: z.string().datetime().optional(),
});

async function getSessionUserId() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "ELEVE") return null;
  return user.id;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const rows = await prisma.$queryRaw<EamProgressRow[]>`
      SELECT checks, quiz, updated_at
      FROM eam_progress
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return NextResponse.json({ data: null }, { status: 200 });

    return NextResponse.json({
      data: normalizeProgress({
        checks: row.checks,
        quiz: row.quiz,
        lastUpdated: row.updated_at.toISOString(),
      }),
    });
  } catch (error) {
    console.error("[EAM progress GET] failed", error);
    return NextResponse.json({ error: "Failed to load EAM progress" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = EAMProgressBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid EAM progress payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = normalizeProgress({
    ...parsed.data,
    lastUpdated: parsed.data.lastUpdated ?? new Date().toISOString(),
  } satisfies EAMProgressData);
  const updatedAt = new Date(data.lastUpdated);
  const checksJson = JSON.stringify(data.checks);
  const quizJson = JSON.stringify(data.quiz);

  try {
    await prisma.$executeRaw`
      INSERT INTO eam_progress (id, user_id, checks, quiz, updated_at)
      VALUES (
        ${`eam_${randomUUID()}`},
        ${userId},
        ${checksJson}::jsonb,
        ${quizJson}::jsonb,
        ${updatedAt}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        checks = EXCLUDED.checks,
        quiz = EXCLUDED.quiz,
        updated_at = EXCLUDED.updated_at
    `;

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error("[EAM progress POST] failed", error);
    return NextResponse.json({ error: "Failed to save EAM progress" }, { status: 500 });
  }
}
