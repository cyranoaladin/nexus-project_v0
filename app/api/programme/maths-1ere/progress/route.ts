import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';

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

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase server configuration missing' }, { status: 503 });
  }

  let body: unknown = null;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const payload = parsePayload(body);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid progress payload' }, { status: 400 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase
      .from('maths_lab_progress')
      .upsert(
        {
          ...payload,
          user_id: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to persist progress' }, { status: 500 });
  }
}
