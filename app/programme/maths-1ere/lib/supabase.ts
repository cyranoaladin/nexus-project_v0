'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client for Maths Lab V2.
 * Falls back gracefully to localStorage-only when env vars are not set.
 *
 * Required env vars (optional — app works without them):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

// ─── Database Types ──────────────────────────────────────────────────────────

export interface MathsLabRow {
  id: string;
  user_id: string;
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
  updated_at: string;
}

// ─── Client Singleton ────────────────────────────────────────────────────────

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get the Supabase client instance.
 * Returns null if env vars are not configured.
 */
export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  supabaseInstance = createClient(url, key);
  return supabaseInstance;
}

/**
 * Check if Supabase is available and configured.
 */
export function isSupabaseEnabled(): boolean {
  return getSupabase() !== null;
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

const TABLE = 'maths_lab_progress';

/**
 * Load user progress from Supabase.
 * Returns null if not found or Supabase is not configured.
 */
export async function loadProgress(userId: string): Promise<MathsLabRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return data as MathsLabRow;
  } catch {
    return null;
  }
}

/**
 * Save user progress to Supabase.
 * Uses upsert to create or update.
 */
export async function saveProgress(
  userId: string,
  progress: Omit<MathsLabRow, 'id' | 'user_id' | 'updated_at'>
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          ...progress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    return !error;
  } catch {
    return false;
  }
}

/**
 * Delete user progress from Supabase.
 */
export async function deleteProgress(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('user_id', userId);

    return !error;
  } catch {
    return false;
  }
}

// ─── SQL Migration (for reference) ──────────────────────────────────────────
//
// CREATE TABLE maths_lab_progress (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id TEXT UNIQUE NOT NULL,
//   completed_chapters TEXT[] DEFAULT '{}',
//   mastered_chapters TEXT[] DEFAULT '{}',
//   total_xp INTEGER DEFAULT 0,
//   quiz_score INTEGER DEFAULT 0,
//   combo_count INTEGER DEFAULT 0,
//   best_combo INTEGER DEFAULT 0,
//   streak INTEGER DEFAULT 0,
//   streak_freezes INTEGER DEFAULT 0,
//   last_activity_date DATE,
//   daily_challenge JSONB DEFAULT '{}',
//   exercise_results JSONB DEFAULT '{}',
//   hint_usage JSONB DEFAULT '{}',
//   badges TEXT[] DEFAULT '{}',
//   srs_queue JSONB DEFAULT '{}',
//   updated_at TIMESTAMPTZ DEFAULT NOW(),
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- RLS Policy
// ALTER TABLE maths_lab_progress ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can manage own progress"
//   ON maths_lab_progress
//   FOR ALL
//   USING (auth.uid()::text = user_id)
//   WITH CHECK (auth.uid()::text = user_id);
//
// -- Index
// CREATE INDEX idx_maths_lab_user ON maths_lab_progress(user_id);
