import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { AcademicTrack, MathsLevel } from '@prisma/client';

interface ProgressPayload {
  completed_chapters: string[];
  mastered_chapters: string[];
  total_xp: number;
  quiz_score: number;
  combo_count: number;
  best_combo: number;
  streak: number;
  streak_freezes: number;
  last_activity_date: string | null;
  daily_challenge: Record<string, unknown>;
  exercise_results: Record<string, number[]>;
  hint_usage: Record<string, number>;
  badges: string[];
  srs_queue: Record<string, unknown>;
  diagnostic_results?: Record<string, unknown>;
  time_per_chapter?: Record<string, number>;
  formulaire_viewed?: boolean;
  grand_oral_seen?: number;
  lab_archimede_opened?: boolean;
  euler_max_steps?: number;
  newton_best_iterations?: number | null;
  printed_fiche?: boolean;
}

function parsePayload(raw: unknown): ProgressPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Partial<ProgressPayload>;
  if (!Array.isArray(input.completed_chapters)) return null;
  if (!Array.isArray(input.mastered_chapters)) return null;
  if (typeof input.total_xp !== 'number') return null;
  if (typeof input.quiz_score !== 'number') return null;
  if (typeof input.combo_count !== 'number') return null;
  if (typeof input.best_combo !== 'number') return null;
  if (typeof input.streak !== 'number') return null;
  if (typeof input.streak_freezes !== 'number') return null;
  if (!(input.last_activity_date === null || typeof input.last_activity_date === 'string')) return null;
  if (!input.daily_challenge || typeof input.daily_challenge !== 'object') return null;
  if (!input.exercise_results || typeof input.exercise_results !== 'object') return null;
  if (!input.hint_usage || typeof input.hint_usage !== 'object') return null;
  if (!Array.isArray(input.badges)) return null;
  if (!input.srs_queue || typeof input.srs_queue !== 'object') return null;
  return input as ProgressPayload;
}

/**
 * POST /api/programme/maths-1ere/progress
 * Save Première progress to Prisma (F16/F17 — source of truth migration)
 */
export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const payload = parsePayload(body);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid progress payload' }, { status: 400 });
  }

  try {
    await prisma.mathsProgress.upsert({
      where: {
        userId_level_track: {
          userId: user.id,
          level: MathsLevel.PREMIERE,
          track: AcademicTrack.EDS_GENERALE,
        },
      },
      create: {
        userId: user.id,
        level: MathsLevel.PREMIERE,
        track: AcademicTrack.EDS_GENERALE,
        completedChapters: payload.completed_chapters,
        masteredChapters: payload.mastered_chapters,
        totalXp: payload.total_xp,
        quizScore: payload.quiz_score,
        comboCount: payload.combo_count,
        bestCombo: payload.best_combo,
        streak: payload.streak,
        streakFreezes: payload.streak_freezes,
        lastActivityDate: payload.last_activity_date,
        dailyChallenge: payload.daily_challenge as unknown as import('@prisma/client').Prisma.InputJsonValue,
        exerciseResults: payload.exercise_results as unknown as import('@prisma/client').Prisma.InputJsonValue,
        hintUsage: payload.hint_usage as unknown as import('@prisma/client').Prisma.InputJsonValue,
        badges: payload.badges,
        srsQueue: payload.srs_queue as unknown as import('@prisma/client').Prisma.InputJsonValue,
        diagnosticResults: payload.diagnostic_results as unknown as import('@prisma/client').Prisma.InputJsonValue ?? null,
        timePerChapter: payload.time_per_chapter as unknown as import('@prisma/client').Prisma.InputJsonValue ?? null,
        formulaireViewed: payload.formulaire_viewed ?? false,
        grandOralSeen: payload.grand_oral_seen ?? 0,
        labArchimedeOpened: payload.lab_archimede_opened ?? false,
        eulerMaxSteps: payload.euler_max_steps ?? 0,
        newtonBestIterations: payload.newton_best_iterations ?? null,
        printedFiche: payload.printed_fiche ?? false,
      },
      update: {
        completedChapters: payload.completed_chapters,
        masteredChapters: payload.mastered_chapters,
        totalXp: payload.total_xp,
        quizScore: payload.quiz_score,
        comboCount: payload.combo_count,
        bestCombo: payload.best_combo,
        streak: payload.streak,
        streakFreezes: payload.streak_freezes,
        lastActivityDate: payload.last_activity_date,
        dailyChallenge: payload.daily_challenge as unknown as import('@prisma/client').Prisma.InputJsonValue,
        exerciseResults: payload.exercise_results as unknown as import('@prisma/client').Prisma.InputJsonValue,
        hintUsage: payload.hint_usage as unknown as import('@prisma/client').Prisma.InputJsonValue,
        badges: payload.badges,
        srsQueue: payload.srs_queue as unknown as import('@prisma/client').Prisma.InputJsonValue,
        diagnosticResults: payload.diagnostic_results as unknown as import('@prisma/client').Prisma.InputJsonValue ?? null,
        timePerChapter: payload.time_per_chapter as unknown as import('@prisma/client').Prisma.InputJsonValue ?? null,
        formulaireViewed: payload.formulaire_viewed ?? false,
        grandOralSeen: payload.grand_oral_seen ?? 0,
        labArchimedeOpened: payload.lab_archimede_opened ?? false,
        eulerMaxSteps: payload.euler_max_steps ?? 0,
        newtonBestIterations: payload.newton_best_iterations ?? null,
        printedFiche: payload.printed_fiche ?? false,
      },
    });

    return NextResponse.json({ ok: true, persisted: true }, { status: 200 });
  } catch (error) {
    console.error('[API] Failed to persist Première progress:', error);
    return NextResponse.json({ error: 'Failed to persist progress' }, { status: 500 });
  }
}

/**
 * GET /api/programme/maths-1ere/progress
 * Retrieve Première progress from Prisma (F16/F17 — source of truth migration)
 */
export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const progress = await prisma.mathsProgress.findUnique({
      where: {
        userId_level_track: {
          userId: user.id,
          level: MathsLevel.PREMIERE,
          track: AcademicTrack.EDS_GENERALE,
        },
      },
    });

    if (!progress) {
      return NextResponse.json({ ok: true, data: null }, { status: 200 });
    }

    // Transform Prisma record to API response format
    const response = {
      ok: true,
      data: {
        completed_chapters: progress.completedChapters,
        mastered_chapters: progress.masteredChapters,
        total_xp: progress.totalXp,
        quiz_score: progress.quizScore,
        combo_count: progress.comboCount,
        best_combo: progress.bestCombo,
        streak: progress.streak,
        streak_freezes: progress.streakFreezes,
        last_activity_date: progress.lastActivityDate,
        daily_challenge: progress.dailyChallenge,
        exercise_results: progress.exerciseResults,
        hint_usage: progress.hintUsage,
        badges: progress.badges,
        srs_queue: progress.srsQueue,
        diagnostic_results: progress.diagnosticResults,
        time_per_chapter: progress.timePerChapter,
        formulaire_viewed: progress.formulaireViewed,
        grand_oral_seen: progress.grandOralSeen,
        lab_archimede_opened: progress.labArchimedeOpened,
        euler_max_steps: progress.eulerMaxSteps,
        newton_best_iterations: progress.newtonBestIterations,
        printed_fiche: progress.printedFiche,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API] Failed to load Première progress:', error);
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 });
  }
}
