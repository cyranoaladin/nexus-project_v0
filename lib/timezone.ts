/**
 * Single shared, IANA-aware timezone primitive.
 *
 * Before this module, the organization's Africa/Tunis wall-clock offset was
 * hardcoded as a fixed `+1` in three independent places (`lib/planning/
 * invariants.ts`, `lib/planning/series.ts`, and transitively the ARIA
 * workshop reminder scheduler). That was safe only because Tunisia has kept
 * a fixed UTC+1 offset since abolishing DST in 2009 — a fact about policy,
 * not something the code should assume forever. This module computes the
 * real offset from the platform's IANA tzdata via `Intl` instead, so a
 * future DST policy change (for Tunisia, or any other zone) is picked up
 * automatically rather than requiring a repo-wide constant edit.
 *
 * `lib/planning/invariants.ts` (v1 planning), `lib/planning/series.ts`
 * (video join instant, via `tunisNowAsPretendUtc`) and
 * `lib/aria/application/workshop/queue-due-workshop-reminders.ts` (ARIA
 * workshop scheduling, transitively via the same two functions) all
 * converge on this one authority.
 */

/** The organization's configured timezone — the one place this is named. */
export const ORGANIZATION_TIMEZONE = 'Africa/Tunis';

/**
 * Real UTC offset, in hours, of `timeZone` at `at` — derived from the
 * platform's IANA tzdata via `Intl.DateTimeFormat`, never a hardcoded
 * number. Positive for zones ahead of UTC. Correctly reflects DST for any
 * zone that observes it (e.g. `Europe/Paris` returns 1 in January and 2 in
 * July), not just the currently-fixed `Africa/Tunis`.
 */
export function getUtcOffsetHours(timeZone: string, at: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  });
  const offsetPart = formatter.formatToParts(at).find((part) => part.type === 'timeZoneName')?.value;
  if (offsetPart === 'GMT') return 0;
  const match = offsetPart?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error(
      `Unable to resolve a UTC offset for timeZone "${timeZone}": got "${offsetPart ?? 'undefined'}"`,
    );
  }
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours + minutes / 60);
}

/**
 * Current UTC offset, in hours, of the organization's configured timezone
 * (`ORGANIZATION_TIMEZONE`) at `at` (defaults to now).
 */
export function getOrganizationUtcOffsetHours(at: Date = new Date()): number {
  return getUtcOffsetHours(ORGANIZATION_TIMEZONE, at);
}
