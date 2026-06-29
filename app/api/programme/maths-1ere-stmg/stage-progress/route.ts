import { NextResponse } from 'next/server';
import { AcademicTrack, MathsLevel } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { serializeError } from '@/lib/utils/serialize-error';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function parseStageState(raw: unknown): JsonRecord | null {
  const input = asRecord(raw);
  if (typeof input.updatedAt !== 'string') return null;
  if (!asRecord(input.diagnosticAnswers)) return null;
  if (!asRecord(input.profile)) return null;
  if (!asRecord(input.validatedNotions)) return null;
  if (!Array.isArray(input.automatismHistory)) return null;
  if (!asRecord(input.settings)) return null;
  return input;
}

const whereStmgPremiere = (userId: string) => ({
  userId_level_track: {
    userId,
    level: MathsLevel.PREMIERE,
    track: AcademicTrack.STMG,
  },
});

export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = user.id;

  try {
    const progress = await prisma.mathsProgress.findUnique({
      where: whereStmgPremiere(userId),
    });

    const stageState = asRecord(progress?.diagnosticResults).stage_eam_stmg ?? null;
    return NextResponse.json({ ok: true, data: stageState }, { status: 200 });
  } catch (error) {
    console.error('[API] Failed to load Première STMG stage progress:', serializeError(error));
    return NextResponse.json({ error: 'Failed to load stage progress' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = user.id;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const stageState = parseStageState(body);
  if (!stageState) {
    return NextResponse.json({ error: 'Invalid stage progress payload' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.mathsProgress.findUnique({
        where: whereStmgPremiere(userId),
      });

      const diagnosticResults = {
        ...asRecord(existing?.diagnosticResults),
        stage_eam_stmg: stageState,
      };

      if (!existing) {
        await tx.mathsProgress.create({
          data: {
            userId,
            level: MathsLevel.PREMIERE,
            track: AcademicTrack.STMG,
            completedChapters: [],
            masteredChapters: [],
            totalXp: 0,
            quizScore: 0,
            comboCount: 0,
            bestCombo: 0,
            streak: 0,
            streakFreezes: 0,
            lastActivityDate: null,
            dailyChallenge: {},
            exerciseResults: {},
            hintUsage: {},
            badges: [],
            srsQueue: {},
            diagnosticResults: diagnosticResults as Prisma.InputJsonValue,
            timePerChapter: {},
            formulaireViewed: false,
            grandOralSeen: 0,
            labArchimedeOpened: false,
            eulerMaxSteps: 0,
            newtonBestIterations: null,
            printedFiche: false,
          },
        });
        return;
      }

      await tx.mathsProgress.update({
        where: whereStmgPremiere(userId),
        data: { diagnosticResults: diagnosticResults as Prisma.InputJsonValue },
      });
    });

    return NextResponse.json({ ok: true, persisted: true }, { status: 200 });
  } catch (error) {
    console.error('[API] Failed to persist Première STMG stage progress:', serializeError(error));
    return NextResponse.json({ error: 'Failed to persist stage progress' }, { status: 500 });
  }
}
