import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MathsLevel } from '@prisma/client';

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
  error_tags?: Record<string, number>;
  hint_penalty_xp?: number;
  bac_checklist_completions?: number;
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
  if (input.error_tags && typeof input.error_tags !== 'object') return null;
  if (input.hint_penalty_xp !== undefined && typeof input.hint_penalty_xp !== 'number') return null;
  if (input.bac_checklist_completions !== undefined && typeof input.bac_checklist_completions !== 'number') return null;
  return input as ProgressPayload;
}

/**
 * POST /api/programme/maths-terminale/progress
 * Save Terminale progress to Prisma (F16/F17 — source of truth migration)
 */
export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
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
        userId_level: {
          userId: user.id,
          level: MathsLevel.TERMINALE,
        },
      },
      create: {
        userId: user.id,
        level: MathsLevel.TERMINALE,
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
        errorTags: payload.error_tags as unknown as import('@prisma/client').Prisma.InputJsonValue ?? null,
        hintPenaltyXp: payload.hint_penalty_xp ?? null,
        bacChecklistCompletions: payload.bac_checklist_completions ?? null,
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
        errorTags: payload.error_tags as unknown as import('@prisma/client').Prisma.InputJsonValue ?? null,
        hintPenaltyXp: payload.hint_penalty_xp ?? null,
        bacChecklistCompletions: payload.bac_checklist_completions ?? null,
      },
    });

    return NextResponse.json({ ok: true, persisted: true }, { status: 200 });
  } catch (error) {
    console.error('[API] Failed to persist Terminale progress:', error);
    return NextResponse.json({ error: 'Failed to persist progress' }, { status: 500 });
  }
}

/**
 * GET /api/programme/maths-terminale/progress
 * Retrieve Terminale progress from Prisma (F16/F17 — source of truth migration)
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
        userId_level: {
          userId: user.id,
          level: MathsLevel.TERMINALE,
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
        error_tags: progress.errorTags,
        hint_penalty_xp: progress.hintPenaltyXp,
        bac_checklist_completions: progress.bacChecklistCompletions,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API] Failed to load Terminale progress:', error);
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 });
  }
}
