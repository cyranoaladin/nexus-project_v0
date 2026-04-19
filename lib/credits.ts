import { ServiceType } from '@/types/enums';
import { SessionType, SessionModality } from '@prisma/client';

// Coûts des prestations en crédits
const CREDIT_COSTS = {
  COURS_ONLINE: 1,
  COURS_PRESENTIEL: 1.25,
  ATELIER_GROUPE: 1.5
} as const;

// Calcul du coût en crédits selon le type de prestation
export function calculateCreditCost(serviceType: ServiceType): number {
  switch (serviceType) {
    case 'COURS_ONLINE':
      return CREDIT_COSTS.COURS_ONLINE;
    case 'COURS_PRESENTIEL':
      return CREDIT_COSTS.COURS_PRESENTIEL;
    case 'ATELIER_GROUPE':
      return CREDIT_COSTS.ATELIER_GROUPE;
    default:
      return 1;
  }
}

// Vérification du solde de crédits (DÉSACTIVÉ : toujours vrai)
export async function checkCreditBalance(studentId: string, requiredCredits: number): Promise<boolean> {
  return true; 
}

// Débit des crédits pour une session (DÉSACTIVÉ : no-op)
export async function debitCredits(studentId: string, amount: number, sessionId: string, description: string) {
  return { transaction: null, created: true };
}

// Remboursement de crédits (DÉSACTIVÉ : no-op)
export async function refundCredits(studentId: string, amount: number, sessionId: string, description: string) {
  return { transaction: null, created: true };
}

// Remboursement de crédits (annulation, idempotent)
export async function refundCredits(studentId: string, amount: number, sessionId: string, description: string) {
  return { transaction: null, created: true };
}

// Remboursement basé sur une SessionBooking (idempotent et sûr en concurrence)
export async function refundSessionBookingById(sessionBookingId: string, reason?: string) {
  return { ok: true };
}

// Attribution des crédits mensuels
export async function allocateMonthlyCredits(studentId: string, credits: number) {
  return null;
}

// Expiration des crédits reportés
export async function expireOldCredits() {
  return;
}

/**
 * Check if a booking can be cancelled with refund based on cancellation policy
 * 
 * Cancellation policy:
 * - Individual/Online/Hybrid: Must cancel 24h before
 * - Group/Masterclass: Must cancel 48h before
 * 
 * @param sessionType - Type of session (INDIVIDUAL, GROUP, MASTERCLASS)
 * @param modality - Session modality (ONLINE, HYBRID, IN_PERSON)
 * @param sessionDate - Scheduled date and time of the session
 * @param now - Current date/time (defaults to new Date(), can be overridden for testing)
 * @returns true if cancellation is eligible for refund, false otherwise
 */
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
