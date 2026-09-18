/**
 * IANA time-zone arithmetic for the planning engine, with no dependency
 * beyond `Intl`. Local wall-clock times on a PlanningSeries are interpreted
 * in the series' own timezone (captured from organization configuration
 * when the series is created — never a hardcoded zone), and every booking
 * is stored as an absolute instant. DST is therefore handled by the zone
 * database, not by arithmetic: the same 18:00 local slot maps to a different
 * UTC offset before and after a transition.
 */

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface LocalDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number; // 1-31
}

export function parseLocalDate(value: string): LocalDate {
  const m = LOCAL_DATE.exec(value);
  if (!m) throw new RangeError(`Invalid local date: ${value}`);
  const date = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (check.getUTCFullYear() !== date.year || check.getUTCMonth() !== date.month - 1 || check.getUTCDate() !== date.day) {
    throw new RangeError(`Invalid local date: ${value}`);
  }
  return date;
}

export function formatLocalDate(date: LocalDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

/** Calendar arithmetic on local dates (proleptic Gregorian, timezone-free). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday, as a calendar property of the local date. */
export function weekdayOf(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** A DATE column value (midnight UTC) → local date, with no zone interpretation. */
export function localDateFromDateColumn(value: Date): LocalDate {
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function dateColumnFromLocalDate(date: LocalDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

export function parseLocalTime(value: string): { hour: number; minute: number } {
  const m = LOCAL_TIME.exec(value);
  if (!m) throw new RangeError(`Invalid local time: ${value}`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock components of an instant in a zone. */
export function zonedParts(instant: Date, timeZone: string): LocalDate & { hour: number; minute: number; second: number } {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 'NaN');
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

/** Offset (ms) of `timeZone` from UTC at `instant`: local wall time − UTC. */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which a wall-clock time occurs in a zone.
 * Transitions are resolved deterministically: a time inside a spring-forward
 * gap is shifted forward by the gap (18:30 in a 02:00→03:00 gap does not
 * exist; 02:30 becomes 03:30), a time repeated in an autumn fall-back is
 * taken at its FIRST occurrence (the earlier instant). Lessons are never
 * scheduled at 2 a.m., so in practice this only matters for correctness of
 * the function itself — which is tested on both kinds of transition.
 */
export function zonedLocalToUtc(date: LocalDate, time: { hour: number; minute: number }, timeZone: string): Date {
  const wall = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0);
  const guess = wall - zoneOffsetMs(new Date(wall), timeZone);
  // Every offset in force around the guess (a transition is at most one per
  // few hours); each yields one candidate instant, kept if it really reads
  // back as the requested wall time.
  const THREE_HOURS = 3 * 3_600_000;
  const offsets = [-THREE_HOURS, 0, THREE_HOURS].map((delta) => zoneOffsetMs(new Date(guess + delta), timeZone));
  const matches = [...new Set(offsets)]
    .map((offset) => new Date(wall - offset))
    .filter((instant) => {
      const p = zonedParts(instant, timeZone);
      return p.year === date.year && p.month === date.month && p.day === date.day && p.hour === time.hour && p.minute === time.minute;
    })
    .sort((a, b) => a.getTime() - b.getTime());
  if (matches.length > 0) return matches[0]!; // fall-back overlap → first occurrence
  // Spring-forward gap: no instant reads as that wall time; shift forward by the gap
  // (= interpret with the offset in force just before the transition).
  return new Date(wall - offsets[0]!);
}

/** `YYYY-MM-DD` of an instant in a zone — the occurrence key of a booking. */
export function localDateKeyOf(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return formatLocalDate(p);
}

export function isValidTimeZone(value: string): boolean {
  try {
    formatterFor(value);
    return true;
  } catch {
    return false;
  }
}
