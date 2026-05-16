import type { NsiProgress, SubjectProgress, PatternProgress, FlashcardProgress } from '@/data/nsi-pratique-2026/types';

/**
 * Check if progress object contains meaningful user data (not just defaults).
 */
export function hasMeaningfulProgress(progress: NsiProgress | null): boolean {
  if (!progress) return false;
  return (
    Object.keys(progress.subjects).length > 0 ||
    Object.keys(progress.patterns).length > 0 ||
    Object.keys(progress.flashcards).length > 0 ||
    Object.keys(progress.fiveDayPlan).length > 0 ||
    Object.keys(progress.selfAssessment).length > 0 ||
    progress.mockExams.length > 0 ||
    Object.keys(progress.oralPhrases).length > 0
  );
}

/**
 * Check if server response indicates no progress exists.
 */
export function isServerProgressEmpty(data: unknown): boolean {
  return data === null || data === undefined;
}

/**
 * Sanitize progress payload: remove any keys that should never be sent to server.
 * Strips userId, email, password, token, role, and any unknown top-level keys.
 */
export function sanitizeNsiProgressPayload(data: unknown): NsiProgress | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const ALLOWED_KEYS = ['subjects', 'patterns', 'flashcards', 'fiveDayPlan', 'selfAssessment', 'mockExams', 'oralPhrases'];
  const FORBIDDEN_KEYS = ['userId', 'email', 'password', 'token', 'role', 'secret', 'apiKey'];

  const input = data as Record<string, unknown>;

  // Reject if forbidden keys present
  for (const key of FORBIDDEN_KEYS) {
    if (key in input) return null;
  }

  // Build sanitized output with only allowed keys
  const sanitized: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in input) {
      sanitized[key] = input[key];
    }
  }

  return {
    subjects: (sanitized.subjects as Record<number, SubjectProgress>) ?? {},
    patterns: (sanitized.patterns as Record<number, PatternProgress>) ?? {},
    flashcards: (sanitized.flashcards as Record<string, FlashcardProgress>) ?? {},
    fiveDayPlan: (sanitized.fiveDayPlan as NsiProgress['fiveDayPlan']) ?? {},
    selfAssessment: (sanitized.selfAssessment as NsiProgress['selfAssessment']) ?? {},
    mockExams: (Array.isArray(sanitized.mockExams) ? sanitized.mockExams : []) as NsiProgress['mockExams'],
    oralPhrases: (sanitized.oralPhrases as NsiProgress['oralPhrases']) ?? {},
  };
}

/**
 * Merge local and server progress.
 *
 * Strategy:
 * - For subjects/patterns/flashcards: merge by key, preferring the entry
 *   with the most recent timestamp (lastWorkedAt/lastPracticedAt/lastReviewedAt).
 * - For fiveDayPlan/selfAssessment: prefer the entry that is "completed" or more advanced.
 * - For mockExams: union (deduplicate by date+subjectId).
 * - For oralPhrases: prefer the entry with more content.
 *
 * This ensures no progression is silently lost.
 */
export function mergeNsiProgress(local: NsiProgress, server: NsiProgress): NsiProgress {
  return {
    subjects: mergeByTimestamp(local.subjects as unknown as StringRecord, server.subjects as unknown as StringRecord, 'lastWorkedAt') as unknown as Record<number, SubjectProgress>,
    patterns: mergeByTimestamp(local.patterns as unknown as StringRecord, server.patterns as unknown as StringRecord, 'lastPracticedAt') as unknown as Record<number, PatternProgress>,
    flashcards: mergeByTimestamp(local.flashcards as unknown as StringRecord, server.flashcards as unknown as StringRecord, 'lastReviewedAt') as unknown as Record<string, FlashcardProgress>,
    fiveDayPlan: mergeByCompletion(local.fiveDayPlan, server.fiveDayPlan),
    selfAssessment: mergeByAdvancement(local.selfAssessment, server.selfAssessment),
    mockExams: mergeMockExams(local.mockExams, server.mockExams),
    oralPhrases: mergeByContent(local.oralPhrases as unknown as StringRecord, server.oralPhrases as unknown as StringRecord) as unknown as NsiProgress['oralPhrases'],
  };
}

type StringRecord = Record<string, Record<string, unknown>>;

/** Merge maps by comparing a timestamp field — most recent wins. */
function mergeByTimestamp(
  local: Record<string, Record<string, unknown>>,
  server: Record<string, Record<string, unknown>>,
  timestampField: string
): Record<string, Record<string, unknown>> {
  const merged = { ...server };
  for (const [key, localEntry] of Object.entries(local)) {
    const serverEntry = merged[key];
    if (!serverEntry) {
      merged[key] = localEntry;
    } else {
      const localTime = localEntry[timestampField] as string | undefined;
      const serverTime = serverEntry[timestampField] as string | undefined;
      if (localTime && (!serverTime || localTime > serverTime)) {
        merged[key] = localEntry;
      }
    }
  }
  return merged;
}

/** Merge fiveDayPlan: prefer completed over not-completed. */
function mergeByCompletion(
  local: NsiProgress['fiveDayPlan'],
  server: NsiProgress['fiveDayPlan']
): NsiProgress['fiveDayPlan'] {
  const merged = { ...server };
  for (const [key, localEntry] of Object.entries(local)) {
    const serverEntry = merged[key];
    if (!serverEntry) {
      merged[key] = localEntry;
    } else if (localEntry.completed && !serverEntry.completed) {
      merged[key] = localEntry;
    }
  }
  return merged;
}

/** Merge selfAssessment: prefer more advanced status. */
function mergeByAdvancement(
  local: NsiProgress['selfAssessment'],
  server: NsiProgress['selfAssessment']
): NsiProgress['selfAssessment'] {
  const STATUS_ORDER: Record<string, number> = { not_assessed: 0, needs_review: 1, ok: 2 };
  const merged = { ...server };
  for (const [key, localEntry] of Object.entries(local)) {
    const serverEntry = merged[key];
    if (!serverEntry) {
      merged[key] = localEntry;
    } else {
      const localRank = STATUS_ORDER[localEntry.status] ?? 0;
      const serverRank = STATUS_ORDER[serverEntry.status] ?? 0;
      if (localRank > serverRank) {
        merged[key] = localEntry;
      }
    }
  }
  return merged;
}

/** Merge mock exams: union, deduplicate by date+subjectId. */
function mergeMockExams(
  local: NsiProgress['mockExams'],
  server: NsiProgress['mockExams']
): NsiProgress['mockExams'] {
  const seen = new Set<string>();
  const merged = [...server];
  for (const exam of server) {
    seen.add(`${exam.date}_${exam.subjectId}`);
  }
  for (const exam of local) {
    const key = `${exam.date}_${exam.subjectId}`;
    if (!seen.has(key)) {
      merged.push(exam);
      seen.add(key);
    }
  }
  return merged;
}

/** Merge oralPhrases: prefer the entry with more non-empty fields. */
function mergeByContent(
  local: Record<string, Record<string, unknown>>,
  server: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  const merged = { ...server };
  for (const [key, localEntry] of Object.entries(local)) {
    const serverEntry = merged[key];
    if (!serverEntry) {
      merged[key] = localEntry;
    } else {
      const localFilled = countFilledFields(localEntry);
      const serverFilled = countFilledFields(serverEntry);
      if (localFilled > serverFilled) {
        merged[key] = localEntry;
      }
    }
  }
  return merged;
}

function countFilledFields(obj: Record<string, unknown>): number {
  return Object.values(obj).filter(
    (v) => v !== '' && v !== null && v !== undefined && v !== false
  ).length;
}
