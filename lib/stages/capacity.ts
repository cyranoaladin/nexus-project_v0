import { StageReservationStatus } from '@prisma/client';

export function computeReservationStatus(
  activeReservationCount: number,
  capacity: number
): StageReservationStatus {
  return activeReservationCount >= capacity ? 'WAITLISTED' : 'PENDING';
}

export function countActiveReservations(
  statuses: Array<StageReservationStatus | string | null | undefined>
): number {
  return statuses.filter((status) => status === 'PENDING' || status === 'CONFIRMED').length;
}
