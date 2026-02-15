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

export type LoadProgressStatus =
  | { status: 'disabled'; data: null }
  | { status: 'ok'; data: MathsLabRow | null }
  | { status: 'error'; data: null; error: string };

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
  const result = await loadProgressWithStatus(userId);
  if (result.status !== 'ok') return null;
  return result.data;
}

/**
 * Load user progress from Supabase with explicit status.
 * This is used to guarantee hydration safety before enabling writes.
 */
export async function loadProgressWithStatus(userId: string): Promise<LoadProgressStatus> {
  const supabase = getSupabase();
  if (!supabase) return { status: 'disabled', data: null };

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // "No rows" is a valid state for a new learner.
      if (error.code === 'PGRST116') {
        return { status: 'ok', data: null };
      }
      return { status: 'error', data: null, error: error.message };
    }
    if (!data) return { status: 'ok', data: null };
    return { status: 'ok', data: data as MathsLabRow };
  } catch {
    return { status: 'error', data: null, error: 'Network error while loading progress' };
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
// -- ═══════════════════════════════════════════════════════════════════════════
// -- CdC §5 — Relational Schema (Programme Structure)
// -- ═══════════════════════════════════════════════════════════════════════════
//
// CREATE TABLE themes (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   slug TEXT UNIQUE NOT NULL,       -- 'algebre', 'analyse', 'geometrie', 'probabilites', 'algorithmique'
//   title TEXT NOT NULL,
//   icon TEXT,
//   color_hex TEXT,
//   order_index INT DEFAULT 0,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE chapters (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   theme_id UUID REFERENCES themes ON DELETE CASCADE,
//   slug TEXT UNIQUE NOT NULL,       -- 'second-degre', 'derivation', etc.
//   title TEXT NOT NULL,
//   niveau VARCHAR DEFAULT 'essentiel',  -- 'essentiel' | 'maitrise' | 'approfondissement'
//   difficulty INT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
//   xp_reward INT DEFAULT 10,
//   competences TEXT[] DEFAULT '{}', -- B.O. competences: chercher, modeliser, representer, raisonner, calculer, communiquer
//   prerequisites TEXT[] DEFAULT '{}', -- slugs of prerequisite chapters
//   order_index INT DEFAULT 0,
//   is_published BOOLEAN DEFAULT true,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE learning_nodes (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   chapter_id UUID REFERENCES chapters ON DELETE CASCADE,
//   type VARCHAR NOT NULL,           -- 'LESSON', 'QUIZ', 'LAB_GRAPH', 'LAB_CODE', 'LAB_SLIDER', 'LAB_SIMULATION'
//   title TEXT NOT NULL,
//   content_payload JSONB NOT NULL,  -- Contains the config for the React component
//   difficulty INT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
//   xp_reward INT DEFAULT 10,
//   order_index INT DEFAULT 0,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- ═══════════════════════════════════════════════════════════════════════════
// -- User Progress (flat table for Zustand sync)
// -- ═══════════════════════════════════════════════════════════════════════════
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
// -- Granular per-node progress (CdC §5)
// CREATE TABLE user_node_progress (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id TEXT NOT NULL,
//   node_id UUID REFERENCES learning_nodes ON DELETE CASCADE,
//   status VARCHAR DEFAULT 'LOCKED', -- 'LOCKED', 'OPEN', 'COMPLETED', 'MASTERED'
//   score INT DEFAULT 0,
//   attempts INT DEFAULT 0,
//   mistakes_log JSONB DEFAULT '[]', -- For error analysis
//   hint_level_used INT DEFAULT 0,   -- 0-3
//   completed_at TIMESTAMPTZ,
//   UNIQUE(user_id, node_id)
// );
//
// -- ═══════════════════════════════════════════════════════════════════════════
// -- RLS Policies
// -- ═══════════════════════════════════════════════════════════════════════════
//
// ALTER TABLE maths_lab_progress ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can manage own progress"
//   ON maths_lab_progress FOR ALL
//   USING (auth.uid()::text = user_id)
//   WITH CHECK (auth.uid()::text = user_id);
//
// ALTER TABLE user_node_progress ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can manage own node progress"
//   ON user_node_progress FOR ALL
//   USING (auth.uid()::text = user_id)
//   WITH CHECK (auth.uid()::text = user_id);
//
// -- Themes and chapters are public read
// ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Public read themes" ON themes FOR SELECT USING (true);
//
// ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Public read chapters" ON chapters FOR SELECT USING (true);
//
// ALTER TABLE learning_nodes ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Public read nodes" ON learning_nodes FOR SELECT USING (true);
//
// -- ═══════════════════════════════════════════════════════════════════════════
// -- Indexes
// -- ═══════════════════════════════════════════════════════════════════════════
//
// CREATE INDEX idx_maths_lab_user ON maths_lab_progress(user_id);
// CREATE INDEX idx_user_node_user ON user_node_progress(user_id);
// CREATE INDEX idx_chapters_theme ON chapters(theme_id);
// CREATE INDEX idx_nodes_chapter ON learning_nodes(chapter_id);
