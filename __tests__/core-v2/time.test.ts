/**
 * Zone arithmetic of the planning engine: DST is resolved by the IANA zone
 * database, never by a fixed offset. Europe/Paris has transitions; Africa/Tunis
 * (the organization's zone) does not — both are covered so a wrong
 * "fixed +1" shortcut would fail here.
 */
import {
  addDays,
  formatLocalDate,
  localDateKeyOf,
  parseLocalDate,
  parseLocalTime,
  weekdayOf,
  zoneOffsetMs,
  zonedLocalToUtc,
  zonedParts,
} from '@/lib/core-v2/time';

const at = (date: string, time: string, tz: string) => zonedLocalToUtc(parseLocalDate(date), parseLocalTime(time), tz).toISOString();

describe('zonedLocalToUtc', () => {
  test('Europe/Paris: the same 18:00 wall time is UTC+1 in winter and UTC+2 in summer (DST 2026: 29 March → 25 October)', () => {
    expect(at('2026-03-28', '18:00', 'Europe/Paris')).toBe('2026-03-28T17:00:00.000Z');
    expect(at('2026-03-29', '18:00', 'Europe/Paris')).toBe('2026-03-29T16:00:00.000Z');
    expect(at('2026-10-24', '18:00', 'Europe/Paris')).toBe('2026-10-24T16:00:00.000Z');
    expect(at('2026-10-25', '18:00', 'Europe/Paris')).toBe('2026-10-25T17:00:00.000Z');
  });

  test('Africa/Tunis: no DST, always UTC+1', () => {
    expect(at('2026-03-28', '18:00', 'Africa/Tunis')).toBe('2026-03-28T17:00:00.000Z');
    expect(at('2026-07-15', '18:00', 'Africa/Tunis')).toBe('2026-07-15T17:00:00.000Z');
    expect(zoneOffsetMs(new Date('2026-07-15T12:00:00Z'), 'Africa/Tunis')).toBe(3_600_000);
  });

  test('spring-forward gap: a non-existent wall time is shifted forward by the gap, deterministically', () => {
    // 2026-03-29 02:30 does not exist in Paris (02:00 → 03:00).
    expect(at('2026-03-29', '02:30', 'Europe/Paris')).toBe('2026-03-29T01:30:00.000Z'); // = 03:30 CEST
    expect(zonedParts(new Date('2026-03-29T01:30:00.000Z'), 'Europe/Paris')).toMatchObject({ hour: 3, minute: 30 });
  });

  test('fall-back overlap: a repeated wall time resolves to its FIRST occurrence', () => {
    // 2026-10-25 02:30 happens twice in Paris (CEST 00:30Z, then CET 01:30Z).
    expect(at('2026-10-25', '02:30', 'Europe/Paris')).toBe('2026-10-25T00:30:00.000Z');
  });

  test('UTC and a far-east zone behave', () => {
    expect(at('2026-01-10', '09:15', 'UTC')).toBe('2026-01-10T09:15:00.000Z');
    expect(at('2026-01-10', '09:15', 'Asia/Tokyo')).toBe('2026-01-10T00:15:00.000Z');
  });
});

describe('local calendar helpers', () => {
  test('occurrence key is the local date in the series zone, not the UTC date', () => {
    // 23:30 Tunis on the 10th is 22:30Z on the 10th; 00:30 Tunis on the 11th is 23:30Z on the 10th.
    expect(localDateKeyOf(new Date('2026-02-10T23:30:00Z'), 'Africa/Tunis')).toBe('2026-02-11');
    expect(localDateKeyOf(new Date('2026-02-10T22:30:00Z'), 'Africa/Tunis')).toBe('2026-02-10');
  });

  test('date arithmetic and validation', () => {
    expect(formatLocalDate(addDays(parseLocalDate('2026-02-27'), 2))).toBe('2026-03-01');
    expect(formatLocalDate(addDays(parseLocalDate('2028-02-28'), 1))).toBe('2028-02-29');
    expect(weekdayOf(parseLocalDate('2026-09-15'))).toBe(2); // Tuesday
    expect(() => parseLocalDate('2026-02-30')).toThrow(RangeError);
    expect(() => parseLocalTime('24:00')).toThrow(RangeError);
  });
});
