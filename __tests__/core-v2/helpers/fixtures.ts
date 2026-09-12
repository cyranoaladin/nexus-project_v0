/**
 * Synthetic test fixtures (TEST_FIXTURE class in the hardcoding audit): the
 * dates below are inputs a test hands to the domain, not a calendar the
 * runtime derives anything from.
 */
export function academicYearDates(startYear: number): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: new Date(Date.UTC(startYear, 8, 1)),
    endsAt: new Date(Date.UTC(startYear + 1, 6, 15)),
  };
}

export const TEST_ORGANIZATION_TIMEZONE = 'Europe/Paris';
