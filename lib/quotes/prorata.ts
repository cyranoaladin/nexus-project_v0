/**
 * Mid-year entry ("entrée en cours d'année") — CDC §47.
 *
 * A candidat individuel year runs September -> June (10 mensualités). A
 * family joining after September pays for the months remaining, not a
 * naive day-count fraction of the annual price — because some included
 * services (bilan initial, carte d'examen, Pilotage setup) have already
 * been delivered in full regardless of the start month. Pure, no React,
 * no DB.
 */

/** 1 = septembre, ..., 10 = juin. Anything outside this window is invalid for a September-start year. */
export type AcademicMonthIndex = number;

const ACADEMIC_MONTH_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]; // calendar months, in academic order

/** Converts a calendar month (1-12) into its academic-year position (1-10), or null if outside Sept-June. */
export function calendarMonthToAcademicIndex(calendarMonth: number): AcademicMonthIndex | null {
  const index = ACADEMIC_MONTH_ORDER.indexOf(calendarMonth);
  return index === -1 ? null : index + 1;
}

/** Months remaining from a given academic-year start index through June (index 10) inclusive. */
export function monthsRemainingFrom(startAcademicIndex: AcademicMonthIndex): number {
  return Math.max(0, 10 - startAcademicIndex + 1);
}

export interface ProratedSchedule {
  monthsBilled: number;
  installmentAmount: number;
  total: number;
}

/**
 * A mid-year entrant pays the same monthly rate for the months remaining
 * — no discount on the monthly price itself, since the service delivered
 * each month is unchanged. This is a deliberate, documented choice, not a
 * naive (daysRemaining / 365) fraction of the annual price, which would
 * undervalue months that include front-loaded services (bilan initial,
 * carte d'examen) delivered at entry regardless of when that is.
 */
export function computeProratedSchedule(monthlyPrice: number, startAcademicIndex: AcademicMonthIndex): ProratedSchedule {
  const monthsBilled = monthsRemainingFrom(startAcademicIndex);
  return {
    monthsBilled,
    installmentAmount: monthlyPrice,
    total: monthlyPrice * monthsBilled,
  };
}
