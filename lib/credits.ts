import type { ServiceType } from '@/types/enums';
import type { Prisma, SessionType, SessionModality } from '@prisma/client';

// Compatibility entry points for legacy callers. Historical records are retained;
// credits no longer control access or generate accounting mutations.
export function calculateCreditCost(_serviceType: ServiceType): number { return 0; }
export async function checkCreditBalance(_studentId: string, _requiredCredits: number): Promise<boolean> { return true; }
export async function debitCredits(_studentId: string, _amount: number, _sessionId: string, _description: string): Promise<{ transaction: Prisma.CreditTransactionGetPayload<object> | null; created: boolean }> {
  return { transaction: null, created: false };
}
export async function refundCredits(_studentId: string, _amount: number, _sessionId: string, _description: string): Promise<{ transaction: Prisma.CreditTransactionGetPayload<object> | null; created: boolean }> {
  return { transaction: null, created: false };
}
export async function refundSessionBookingById(_sessionBookingId: string, _reason?: string) {
  return { ok: false, reason: 'CREDITS_RETIRED' as const };
}
export async function allocateMonthlyCredits(_studentId: string, _credits: number) { return null; }
export async function expireOldCredits() { return; }

// Preserved cancellation notice policy for callers outside the credit lifecycle.
export function canCancelBooking(
  sessionType: SessionType,
  modality: SessionModality,
  sessionDate: Date,
  now: Date = new Date()
): boolean {
  const hoursUntilSession = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Individual/Online/Hybrid: 24h notice required
  if (
    sessionType === 'INDIVIDUAL' ||
    modality === 'HYBRID' ||
    modality === 'ONLINE'
  ) {
    return hoursUntilSession >= 24;
  }

  // Group/Masterclass: 48h notice required
  if (sessionType === 'GROUP' || sessionType === 'MASTERCLASS') {
    return hoursUntilSession >= 48;
  }

  return false;
}
