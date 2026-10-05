import { Prisma } from '@prisma/client';
import { cancelSeriesOccurrences, PlanningSeriesCancellationConflictError } from '@/lib/planning/cancel-series-occurrences';
function database(status: string) {
  return {
    sessionBooking: {
      findMany: jest.fn().mockResolvedValue([{ id: 'synthetic-booking', status: 'SCHEDULED', studentId: 'synthetic-student', coachId: 'synthetic-coach' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockResolvedValue({ status }),
    },
    sessionBookingCancellationAudit: { create: jest.fn() },
  };
}
const input = { seriesId: 'synthetic-series', boundary: new Date('2099-01-01T00:00:00Z'), actorUserId: 'synthetic-staff', actorRole: 'ASSISTANTE', action: 'SERIES_CANCELLED' as const, reason: 'Synthetic reason' };
test('losing the CAS to a still-active occurrence prevents a false successful series cancellation', async () => {
  const tx = database('CONFIRMED');
  await expect(cancelSeriesOccurrences(tx as unknown as Prisma.TransactionClient, input)).rejects.toBeInstanceOf(PlanningSeriesCancellationConflictError);
  expect(tx.sessionBookingCancellationAudit.create).not.toHaveBeenCalled();
});
test.each(['CANCELLED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULED'])('a concurrent terminal state %s is preserved without inventing an audit', async status => {
  const tx = database(status);
  expect(await cancelSeriesOccurrences(tx as unknown as Prisma.TransactionClient, input)).toBe(0);
  expect(tx.sessionBookingCancellationAudit.create).not.toHaveBeenCalled();
});
