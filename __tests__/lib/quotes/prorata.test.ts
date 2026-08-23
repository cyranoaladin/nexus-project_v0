import { calendarMonthToAcademicIndex, monthsRemainingFrom, computeProratedSchedule } from '@/lib/quotes/prorata';

describe('calendarMonthToAcademicIndex — September=1 .. June=10', () => {
  test('September is index 1, June is index 10', () => {
    expect(calendarMonthToAcademicIndex(9)).toBe(1);
    expect(calendarMonthToAcademicIndex(6)).toBe(10);
  });
  test('November is index 3', () => {
    expect(calendarMonthToAcademicIndex(11)).toBe(3);
  });
  test('July/August (outside the academic year) return null', () => {
    expect(calendarMonthToAcademicIndex(7)).toBeNull();
    expect(calendarMonthToAcademicIndex(8)).toBeNull();
  });
});

describe('monthsRemainingFrom', () => {
  test('starting in September (index 1) leaves all 10 months', () => {
    expect(monthsRemainingFrom(1)).toBe(10);
  });
  test('starting in November (index 3) leaves 8 months (CDC §47 worked example)', () => {
    expect(monthsRemainingFrom(3)).toBe(8);
  });
  test('starting in June (index 10) leaves exactly 1 month', () => {
    expect(monthsRemainingFrom(10)).toBe(1);
  });
});

describe('computeProratedSchedule — same monthly rate, not a naive day-fraction of the annual price', () => {
  test('mid-year entry (November) bills 8 months at the unchanged monthly rate', () => {
    const schedule = computeProratedSchedule(790, 3);
    expect(schedule.monthsBilled).toBe(8);
    expect(schedule.installmentAmount).toBe(790); // never discounted just because it's mid-year
    expect(schedule.total).toBe(790 * 8);
  });

  test('a full-year entry (September) matches the canonical 10-installment total', () => {
    const schedule = computeProratedSchedule(790, 1);
    expect(schedule.total).toBe(7900); // matches premiere-libre-cap-anticipees price_annual
  });
});
