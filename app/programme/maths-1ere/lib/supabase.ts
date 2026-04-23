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
  diagnostic_results?: Record<string, unknown>;
  time_per_chapter?: Record<string, number>;
  formulaire_viewed?: boolean;
  grand_oral_seen?: number;
  lab_archimede_opened?: boolean;
  euler_max_steps?: number;
  newton_best_iterations?: number | null;
  printed_fiche?: boolean;
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

  // Reject obviously placeholder/example URLs to avoid network errors during E2E/dev
  if (url.includes('example.supabase') || key.startsWith('preflight-') || key === 'your-anon-key') {
    return null;
  }

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

// ─── Note on Supabase ─────────────────────────────────────────────────────
//
// This module previously contained SQL DDL for tables that were never
// implemented (themes, chapters, learning_nodes, user_node_progress).
// Those specifications have been removed as they were pure CdC (Cahier des
// Charges) that never reached production.
//
// The current implementation uses Prisma/PostgreSQL as source of truth
// via the MathsProgress model (F16/F17 migration).
