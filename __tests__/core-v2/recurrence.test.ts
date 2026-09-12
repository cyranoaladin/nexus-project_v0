import { expandRecurrence, parseRecurrenceRule } from '@/lib/core-v2/recurrence';
import { formatLocalDate, parseLocalDate } from '@/lib/core-v2/time';

const d = parseLocalDate;
const dates = (rule: string, start: string, bounds: { count?: number | null; until?: string | null; horizon: string }) =>
  expandRecurrence(parseRecurrenceRule(rule), d(start), {
    count: bounds.count,
    until: bounds.until ? d(bounds.until) : null,
    horizon: d(bounds.horizon),
  }).map(formatLocalDate);

describe('parseRecurrenceRule', () => {
  test('accepts the supported subset and rejects the rest', () => {
    expect(parseRecurrenceRule('FREQ=WEEKLY;BYDAY=TU,TH;INTERVAL=2')).toEqual({ freq: 'WEEKLY', interval: 2, byDay: [2, 4] });
    expect(parseRecurrenceRule('FREQ=DAILY')).toEqual({ freq: 'DAILY', interval: 1, byDay: [] });
    expect(() => parseRecurrenceRule('FREQ=MONTHLY')).toThrow(RangeError);
    expect(() => parseRecurrenceRule('FREQ=WEEKLY;BYDAY=XX')).toThrow(RangeError);
    expect(() => parseRecurrenceRule('FREQ=WEEKLY;COUNT=3')).toThrow(RangeError);
  });
});

describe('expandRecurrence', () => {
  test('weekly on Tuesday, 3 occurrences, first week contains the start date', () => {
    expect(dates('FREQ=WEEKLY;BYDAY=TU', '2026-09-15', { count: 3, horizon: '2027-07-15' })).toEqual(['2026-09-15', '2026-09-22', '2026-09-29']);
  });

  test('weekly BYDAY before the start date inside the first week is skipped (DTSTART semantics)', () => {
    // 2026-09-16 is a Wednesday; Monday 14th is in the same week but before the start.
    expect(dates('FREQ=WEEKLY;BYDAY=MO,WE', '2026-09-16', { count: 3, horizon: '2027-07-15' })).toEqual(['2026-09-16', '2026-09-21', '2026-09-23']);
  });

  test('the horizon (academic year end) always bounds an open-ended rule; UNTIL narrows it further', () => {
    const open = dates('FREQ=WEEKLY;BYDAY=TU', '2026-09-15', { horizon: '2026-10-13' });
    expect(open).toEqual(['2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13']);
    expect(dates('FREQ=WEEKLY;BYDAY=TU', '2026-09-15', { until: '2026-09-29', horizon: '2027-07-15' })).toEqual(['2026-09-15', '2026-09-22', '2026-09-29']);
    expect(dates('FREQ=WEEKLY;BYDAY=TU', '2026-09-15', { until: '2099-01-01', horizon: '2026-09-22' })).toEqual(['2026-09-15', '2026-09-22']);
  });

  test('INTERVAL=2 weekly and DAILY rules', () => {
    expect(dates('FREQ=WEEKLY;INTERVAL=2', '2026-09-15', { count: 3, horizon: '2027-07-15' })).toEqual(['2026-09-15', '2026-09-29', '2026-10-13']);
    expect(dates('FREQ=DAILY;INTERVAL=3', '2026-09-15', { count: 3, horizon: '2027-07-15' })).toEqual(['2026-09-15', '2026-09-18', '2026-09-21']);
  });

  test('without BYDAY a weekly rule repeats on the start weekday; a start after the horizon yields nothing', () => {
    expect(dates('FREQ=WEEKLY', '2026-09-17', { count: 2, horizon: '2027-07-15' })).toEqual(['2026-09-17', '2026-09-24']);
    expect(dates('FREQ=WEEKLY', '2027-09-01', { horizon: '2027-07-15' })).toEqual([]);
  });

  test('the safety valve caps runaway expansions', () => {
    expect(dates('FREQ=DAILY', '2026-09-01', { horizon: '2030-01-01' })).toHaveLength(200);
  });
});
