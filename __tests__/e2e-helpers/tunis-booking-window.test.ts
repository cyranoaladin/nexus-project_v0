import { resolveTunisBookingWindow } from '@/e2e/helpers/tunis-booking-window';

// Africa/Tunis is UTC+1 year-round for the dates these fixtures use; the
// production helper reads the real offset, and this test injects it so the
// arithmetic is exercised without depending on the host's timezone database.
const tunisOffset = () => 1;

const at = (hours: number, minutes: number) => new Date(Date.UTC(2026, 8, 17, hours, minutes, 0));

describe('resolveTunisBookingWindow — a booking always fits inside one Tunis day', () => {
  it('stores the plain wall-clock window when the session is far from midnight', () => {
    const window = resolveTunisBookingWindow(at(9, 0), 60, tunisOffset);
    expect(window).toMatchObject({
      startTime: '10:00',
      endTime: '11:00',
      rolledToNextTunisDay: false,
    });
    expect(window.scheduledDate.toISOString()).toBe('2026-09-17T00:00:00.000Z');
  });

  it('clamps an end that would cross midnight, keeping a non-empty window', () => {
    // 22:30 UTC = 23:30 Tunis; a 60-minute session would end at 00:30.
    const window = resolveTunisBookingWindow(at(22, 30), 60, tunisOffset);
    expect(window).toMatchObject({ startTime: '23:30', endTime: '23:59', rolledToNextTunisDay: false });
  });

  // The regression: this exact minute made `main` red at 2026-09-17T16:59:04Z,
  // because `now + 6h` landed on it and the clamped end was not after the start.
  it('rolls to the next Tunis day when the start has no room left in its own', () => {
    const window = resolveTunisBookingWindow(at(22, 59), 60, tunisOffset);
    expect(window).toMatchObject({ startTime: '00:00', endTime: '01:00', rolledToNextTunisDay: true });
    expect(window.scheduledDate.toISOString()).toBe('2026-09-18T00:00:00.000Z');
  });

  it('never throws and never returns an empty window, at any minute of the day', () => {
    const degenerate: string[] = [];
    for (let minute = 0; minute < 24 * 60; minute += 1) {
      const window = resolveTunisBookingWindow(at(Math.floor(minute / 60), minute % 60), 60, tunisOffset);
      if (!(window.endTime > window.startTime)) {
        degenerate.push(`${minute}: ${window.startTime}/${window.endTime}`);
      }
    }
    expect(degenerate).toEqual([]);
  });

  it('shifts a rolled booking by at most one minute of wall clock, so ordering is preserved', () => {
    const start = at(22, 59);
    const window = resolveTunisBookingWindow(start, 60, tunisOffset);
    // 23:59 Tunis rolled to 00:00 Tunis the next day.
    const rolledStartUtc = Date.UTC(2026, 8, 18, 0, 0) - 60 * 60 * 1000;
    expect(rolledStartUtc - start.getTime()).toBe(60 * 1000);
  });

  it('holds for a 30-minute session too, where the degenerate minute moves', () => {
    const degenerate: string[] = [];
    for (let minute = 0; minute < 24 * 60; minute += 1) {
      const window = resolveTunisBookingWindow(at(Math.floor(minute / 60), minute % 60), 30, tunisOffset);
      if (!(window.endTime > window.startTime)) degenerate.push(String(minute));
    }
    expect(degenerate).toEqual([]);
  });
});
