/**
 * Deterministic expansion of the RRULE subset a PlanningSeries may carry
 * (FREQ=DAILY|WEEKLY, INTERVAL, BYDAY — see services/planning.ts). Pure
 * calendar arithmetic on local dates; the zone conversion happens later,
 * per occurrence, in lib/core-v2/time.ts. Anything outside the subset was
 * already refused by validation, so this module never guesses.
 */
import { addDays, compareLocalDates, weekdayOf, type LocalDate } from './time';

const BYDAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export interface RecurrenceRule {
  readonly freq: 'DAILY' | 'WEEKLY';
  readonly interval: number;
  /** Weekday indexes (0 = Sunday) for WEEKLY rules; empty = the start date's weekday. */
  readonly byDay: readonly number[];
}

export function parseRecurrenceRule(rule: string): RecurrenceRule {
  let freq: RecurrenceRule['freq'] | null = null;
  let interval = 1;
  const byDay: number[] = [];
  for (const part of rule.split(';')) {
    const [key, value] = part.split('=');
    if (key === 'FREQ' && (value === 'DAILY' || value === 'WEEKLY')) freq = value;
    else if (key === 'INTERVAL') interval = Number(value);
    else if (key === 'BYDAY') {
      for (const token of (value ?? '').split(',')) {
        const idx = BYDAY_INDEX[token];
        if (idx === undefined) throw new RangeError(`Unsupported BYDAY token: ${token}`);
        if (!byDay.includes(idx)) byDay.push(idx);
      }
    } else throw new RangeError(`Unsupported RRULE part: ${part}`);
  }
  if (!freq) throw new RangeError('RRULE without FREQ');
  if (!Number.isInteger(interval) || interval < 1 || interval > 99) throw new RangeError(`Unsupported INTERVAL: ${interval}`);
  return { freq, interval, byDay: byDay.sort((a, b) => a - b) };
}

export interface ExpansionBounds {
  /** Stop after this many occurrences (RRULE COUNT semantics). */
  readonly count?: number | null;
  /** Last local date allowed, inclusive (RRULE UNTIL semantics). */
  readonly until?: LocalDate | null;
  /** Hard horizon, inclusive — the academic year end; always applied. */
  readonly horizon: LocalDate;
  /** Safety valve against runaway rules; validation already caps COUNT at 200. */
  readonly maxOccurrences?: number;
}

/**
 * All occurrence dates of `rule` starting at `start` (inclusive, if it
 * matches) within the bounds, in ascending order. For WEEKLY+BYDAY the
 * first week is the week containing `start` (weeks start on Monday), and
 * dates before `start` are skipped — RFC 5545 semantics for a DTSTART that
 * is itself one of the BYDAY instances.
 */
export function expandRecurrence(rule: RecurrenceRule, start: LocalDate, bounds: ExpansionBounds): LocalDate[] {
  const max = Math.min(bounds.maxOccurrences ?? 200, bounds.count ?? Number.POSITIVE_INFINITY);
  const last = bounds.until && compareLocalDates(bounds.until, bounds.horizon) < 0 ? bounds.until : bounds.horizon;
  const out: LocalDate[] = [];
  const within = (d: LocalDate) => compareLocalDates(d, last) <= 0;

  if (rule.freq === 'DAILY') {
    for (let d = start; within(d) && out.length < max; d = addDays(d, rule.interval)) out.push(d);
    return out;
  }

  const days = rule.byDay.length > 0 ? rule.byDay : [weekdayOf(start)];
  // Monday-based start of the week containing `start`.
  const startWeekday = weekdayOf(start);
  const weekStart = addDays(start, -((startWeekday + 6) % 7));
  for (let week = weekStart; within(week) && out.length < max; week = addDays(week, 7 * rule.interval)) {
    for (const weekday of days) {
      const offset = (weekday + 6) % 7; // Monday = 0 … Sunday = 6
      const d = addDays(week, offset);
      if (compareLocalDates(d, start) < 0 || !within(d)) continue;
      out.push(d);
      if (out.length >= max) break;
    }
  }
  return out.sort(compareLocalDates);
}
