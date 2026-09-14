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
 * The organization's timezone NAME is itself configuration, not a source
 * constant either — see `getOrganizationTimezone()` below, which mirrors
 * `lib/jitsi.ts`'s `getJitsiServerUrl()` fail-closed pattern: production
 * requires `NEXUS_ORGANIZATION_TIMEZONE` explicitly set and validated
 * (`lib/env-validation.ts`, REQUIRED/prodOnly); dev/test keep an explicit
 * fixture default.
 *
 * `lib/planning/invariants.ts` (v1 planning), `lib/planning/series.ts`
 * (video join instant, via `tunisNowAsPretendUtc`) and
 * `lib/aria/application/workshop/queue-due-workshop-reminders.ts` (ARIA
 * workshop scheduling, transitively via the same two functions) all
 * converge on this one authority.
 */

const DEV_TEST_ORGANIZATION_TIMEZONE_FIXTURE = 'Africa/Tunis';

/**
 * Sole authority for the organization's timezone name — never reimplement
 * `process.env.NEXUS_ORGANIZATION_TIMEZONE || 'Africa/Tunis'` locally.
 *
 * In production, an unconfigured value fails CLOSED (throw) rather than
 * silently assuming Africa/Tunis — this variable is also validated at
 * startup (`lib/env-validation.ts`, REQUIRED/prodOnly, including an
 * explicit IANA-validity check), this throw is a second line of defense
 * for any code path that runs before that validation (e.g. a script that
 * imports this module directly without going through the app's
 * instrumentation hook).
 */
export function getOrganizationTimezone(): string {
  const configured = process.env.NEXUS_ORGANIZATION_TIMEZONE;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXUS_ORGANIZATION_TIMEZONE is not configured. Production must never silently assume a timezone — configure the organization\'s real IANA timezone name.',
    );
  }
  return DEV_TEST_ORGANIZATION_TIMEZONE_FIXTURE;
}

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
 * (`getOrganizationTimezone()`) at `at` (defaults to now).
 */
export function getOrganizationUtcOffsetHours(at: Date = new Date()): number {
  return getUtcOffsetHours(getOrganizationTimezone(), at);
}

/** Outcome of resolving a wall-clock local time to a real UTC instant. */
export type ZonedConversionOutcome = 'UNAMBIGUOUS' | 'AMBIGUOUS' | 'NONEXISTENT';

export interface ZonedConversionResult {
  instant: Date;
  outcome: ZonedConversionOutcome;
}

/**
 * Converts a wall-clock date/time in `timeZone` — encoded as `pseudoUtc`,
 * whose UTC-accessor fields (`getUTCFullYear()`, `getUTCHours()`, etc.) hold
 * the LOCAL wall-clock values, e.g. `combineDateAndTime` in
 * `lib/planning/invariants.ts` — to the real UTC instant it represents.
 *
 * A single offset evaluation (the previous implementation: compute the
 * offset AT the pseudo-UTC instant, then subtract) is only correct away
 * from a DST transition. Near one, that same wall-clock date/time can be
 * either AMBIGUOUS (the fall-back transition makes it occur twice) or
 * NONEXISTENT (the spring-forward transition skips over it entirely) — an
 * unverified single-offset subtraction would silently produce a real but
 * WRONG instant in either case. This function instead computes a
 * candidate, verifies it actually round-trips back to the requested
 * wall-clock values through the real IANA data, and only falls back to
 * probing both sides of a transition when it doesn't — so both edge cases
 * are a deliberate, documented policy rather than silent undefined
 * behavior:
 *
 * - AMBIGUOUS_LOCAL_TIME (fall-back, the wall-clock time occurs twice):
 *   resolves to the EARLIER of the two valid UTC instants.
 * - NONEXISTENT_LOCAL_TIME (spring-forward, the wall-clock time is
 *   skipped): resolves to the first REAL instant at or after the
 *   requested wall-clock moment (i.e. the offset that applies just AFTER
 *   the transition).
 *
 * Africa/Tunis (this organization's only zone in practice) has not
 * observed DST since 2009 (see audit.md), so in production these two
 * branches are not expected to ever actually fire today — but a future
 * zone, or a future DST policy change, is handled correctly rather than
 * producing a silently wrong booking/reminder instant.
 */
export function zonedWallClockToUtcInstant(timeZone: string, pseudoUtc: Date): ZonedConversionResult {
  const roundTrips = (candidate: Date): boolean => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts: Partial<Record<string, string>> = {};
    for (const part of formatter.formatToParts(candidate)) parts[part.type] = part.value;
    return (
      Number(parts.year) === pseudoUtc.getUTCFullYear() &&
      Number(parts.month) === pseudoUtc.getUTCMonth() + 1 &&
      Number(parts.day) === pseudoUtc.getUTCDate() &&
      Number(parts.hour) === pseudoUtc.getUTCHours() &&
      Number(parts.minute) === pseudoUtc.getUTCMinutes()
    );
  };

  // A single offset evaluation "at pseudoUtc treated as a literal instant"
  // is not a safe way to decide whether this wall-clock moment is
  // ambiguous: near a transition, that naive guess can land on ONE valid
  // instant and round-trip successfully while silently missing that
  // ANOTHER, equally valid, earlier instant also exists for the exact same
  // wall-clock time (the fall-back overlap). So always probe the offset
  // well before and well after a rough guess (25h safely spans any single
  // transition, which never exceeds a couple of hours) and check BOTH
  // resulting candidates — never accept the first one found without
  // knowing whether a second, earlier one is also valid.
  const roughGuessOffset = getUtcOffsetHours(timeZone, pseudoUtc);
  const roughGuessInstant = new Date(pseudoUtc.getTime() - roughGuessOffset * 60 * 60 * 1000);
  const probeWindowMs = 25 * 60 * 60 * 1000;
  const offsetBefore = getUtcOffsetHours(timeZone, new Date(roughGuessInstant.getTime() - probeWindowMs));
  const offsetAfter = getUtcOffsetHours(timeZone, new Date(roughGuessInstant.getTime() + probeWindowMs));

  const candidateBefore = new Date(pseudoUtc.getTime() - offsetBefore * 60 * 60 * 1000);
  const candidateAfter = new Date(pseudoUtc.getTime() - offsetAfter * 60 * 60 * 1000);

  const beforeValid = roundTrips(candidateBefore);
  const afterValid = roundTrips(candidateAfter);
  const sameInstant = candidateBefore.getTime() === candidateAfter.getTime();

  if (beforeValid && afterValid && !sameInstant) {
    // AMBIGUOUS: the pre- and post-transition offsets produce two DIFFERENT
    // real, valid instants for this exact wall-clock time (a fall-back
    // overlap) — policy: resolve to the earlier occurrence.
    const instant = candidateBefore.getTime() <= candidateAfter.getTime() ? candidateBefore : candidateAfter;
    return { instant, outcome: 'AMBIGUOUS' };
  }
  if (beforeValid) return { instant: candidateBefore, outcome: 'UNAMBIGUOUS' };
  if (afterValid) return { instant: candidateAfter, outcome: 'UNAMBIGUOUS' };

  // NONEXISTENT: neither candidate round-trips — a spring-forward
  // transition skipped straight over this wall-clock moment. Policy: shift
  // forward past the gap — the post-transition offset gives the first real
  // instant at or after the requested wall-clock moment.
  return { instant: candidateAfter, outcome: 'NONEXISTENT' };
}
