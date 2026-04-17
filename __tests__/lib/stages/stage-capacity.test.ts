import { countActiveReservations, computeReservationStatus } from '@/lib/stages/capacity';

describe('Stage capacity management', () => {
  it('attribue PENDING si confirmedCount < capacity', () => {
    expect(computeReservationStatus(3, 6)).toBe('PENDING');
  });

  it('attribue WAITLISTED si confirmedCount >= capacity', () => {
    expect(computeReservationStatus(6, 6)).toBe('WAITLISTED');
  });

  it('compte correctement les réservations actives (PENDING + CONFIRMED uniquement)', () => {
    expect(countActiveReservations(['PENDING', 'CONFIRMED', 'WAITLISTED'])).toBe(2);
  });

  it('ne compte pas les CANCELLED et WAITLISTED pour la capacité', () => {
    expect(countActiveReservations(['CANCELLED', 'WAITLISTED', 'COMPLETED'])).toBe(0);
  });
});
