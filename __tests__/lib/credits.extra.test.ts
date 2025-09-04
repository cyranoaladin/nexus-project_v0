import { calculateCreditCost, canCancelBooking } from '@/lib/credits';
import { ServiceType } from '@/types/enums';

describe('lib/credits pure helpers', () => {
  test('calculateCreditCost mappings', () => {
    expect(calculateCreditCost(ServiceType.COURS_ONLINE)).toBeCloseTo(1);
    expect(calculateCreditCost(ServiceType.COURS_PRESENTIEL)).toBeCloseTo(1.25);
    expect(calculateCreditCost(ServiceType.ATELIER_GROUPE)).toBeCloseTo(1.5);
    // @ts-expect-error testing default
    expect(calculateCreditCost('UNKNOWN')).toBeCloseTo(1);
  });

  test('canCancelBooking respects 48h for group workshops', () => {
    const now = Date.now();
    const plus49h = new Date(now + 49 * 60 * 60 * 1000);
    const plus47h = new Date(now + 47 * 60 * 60 * 1000);
    expect(canCancelBooking(plus49h, ServiceType.ATELIER_GROUPE)).toBe(true);
    expect(canCancelBooking(plus47h, ServiceType.ATELIER_GROUPE)).toBe(false);
  });

  test('canCancelBooking respects 24h for standard sessions', () => {
    const now = Date.now();
    const plus25h = new Date(now + 25 * 60 * 60 * 1000);
    const plus23h = new Date(now + 23 * 60 * 60 * 1000);
    expect(canCancelBooking(plus25h, ServiceType.COURS_ONLINE)).toBe(true);
    expect(canCancelBooking(plus23h, ServiceType.COURS_ONLINE)).toBe(false);
  });
});
