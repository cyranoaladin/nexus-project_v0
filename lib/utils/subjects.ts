/**
 * Parse the subjects Json field safely.
 *
 * Prisma stores the CoachProfile.subjects column as a Json type.
 * Depending on how the seed or admin UI wrote the value, it may be:
 *   - a real JS array  → return as-is
 *   - a JSON-encoded string (e.g. '["MATHEMATIQUES"]') → parse then return
 *   - anything else → return []
 *
 * Strict: every element must be a string; non-strings are filtered out.
 */
export function parseSubjects(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      // not valid JSON — ignore
    }
  }
  return [];
}
