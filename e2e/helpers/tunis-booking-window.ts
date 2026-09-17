/**
 * The Tunis wall-clock window a `SessionBooking` can actually store.
 *
 * `SessionBooking` has one `scheduledDate` column plus `startTime`/`endTime`
 * strings, so a booking lives inside a single Africa/Tunis calendar day. A
 * caller that derives its instant from `Date.now()` cannot know where that
 * lands: at 22:59 UTC a 60-minute session starts at 23:59 Tunis and has
 * nowhere to end.
 *
 * `createSessionAtRealInstant` already clamped a midnight-crossing end to
 * 23:59. It left the degenerate minute open: a start *at* 23:59 clamps to an
 * end of 23:59, which is not after it, and the helper threw. That is one
 * minute per day per offset — `e2e/auth/session-video-join.spec.ts` uses seven
 * offsets, so roughly seven minutes a day in which `main` goes red for a
 * reason that has nothing to do with the code under test. It fired on
 * `main` at 2026-09-17T16:59:04Z (`now + 6h` = 22:59 UTC).
 *
 * Resolution: when the start has no room left in its own Tunis day, roll the
 * booking to the very start of the next Tunis day. The shift is at most a
 * minute of wall clock, so a caller's "three hours from now" stays three
 * hours from now, and a caller's "two hours ago" stays in the past — the
 * ordering every caller actually depends on is preserved, while the stored
 * window becomes representable.
 */

export interface TunisBookingWindow {
  /** UTC midnight of the Tunis calendar day the booking is stored under. */
  readonly scheduledDate: Date;
  readonly startTime: string;
  readonly endTime: string;
  /** True when the start had no room left in its own Tunis day. */
  readonly rolledToNextTunisDay: boolean;
}

const pad = (value: number) => String(value).padStart(2, '0');
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const dayNumber = (wallClock: Date) =>
  Date.UTC(wallClock.getUTCFullYear(), wallClock.getUTCMonth(), wallClock.getUTCDate());

export function resolveTunisBookingWindow(
  startInstant: Date,
  durationMinutes: number,
  organizationUtcOffsetHours: (instant: Date) => number,
): TunisBookingWindow {
  const toTunisWallClock = (instant: Date) =>
    new Date(instant.getTime() + organizationUtcOffsetHours(instant) * HOUR);

  const build = (start: Date, rolled: boolean): TunisBookingWindow | null => {
    const startWallClock = toTunisWallClock(start);
    const endWallClock = toTunisWallClock(new Date(start.getTime() + durationMinutes * MINUTE));
    const crossesMidnight = dayNumber(endWallClock) > dayNumber(startWallClock);
    const startTime = `${pad(startWallClock.getUTCHours())}:${pad(startWallClock.getUTCMinutes())}`;
    // Nothing in the route or its tests reads `endTime` for logic — only
    // `scheduledDate` + `startTime` — and `duration` stays the authoritative,
    // unclamped value. So a crossing end is clamped to the last minute of the
    // day rather than rejected.
    const endTime = crossesMidnight
      ? '23:59'
      : `${pad(endWallClock.getUTCHours())}:${pad(endWallClock.getUTCMinutes())}`;
    if (endTime <= startTime) return null;
    return {
      scheduledDate: new Date(dayNumber(startWallClock)),
      startTime,
      endTime,
      rolledToNextTunisDay: rolled,
    };
  };

  const asGiven = build(startInstant, false);
  if (asGiven !== null) return asGiven;

  // No room left in this Tunis day: move to the first minute of the next one.
  const startWallClock = toTunisWallClock(startInstant);
  const nextTunisMidnight = dayNumber(startWallClock) + 24 * HOUR;
  const rolledInstant = new Date(
    startInstant.getTime() + (nextTunisMidnight - startWallClock.getTime()),
  );
  const rolled = build(rolledInstant, true);
  if (rolled === null) {
    throw new Error(
      `resolveTunisBookingWindow: a ${durationMinutes}-minute session does not fit in a Tunis day`,
    );
  }
  return rolled;
}
