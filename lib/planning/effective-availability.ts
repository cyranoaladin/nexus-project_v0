/**
 * Disponibilité EFFECTIVE d'un coach pour un créneau candidat.
 *
 * Remplace la résolution de `SessionBookingService.validateAvailability`
 * (lib/session-booking.ts), qui additionne (OR) fenêtre récurrente et fenêtre
 * datée SANS aucune priorité : une ligne `specificDate` avec
 * `isAvailable: false` (blackout) n'y annule jamais une correspondance
 * récurrente simultanée. Ce module est la SEULE implémentation correcte de
 * cette résolution ; `lib/session-booking.ts` n'est PAS modifié ici (hors
 * périmètre de cette tâche), voir docs/superpowers/plans/2026-09-06-core-
 * family-academic-planning.md, Tâche 10.
 *
 * Priorité, du plus spécifique au plus général :
 *   1. Une ligne `specificDate` = date exacte, `isAvailable: false`, dont la
 *      fenêtre couvre le créneau demandé → BLACKOUT, l'emporte toujours.
 *   2. Une ligne `specificDate` = date exacte, `isAvailable: true`, dont la
 *      fenêtre couvre le créneau demandé → dérogation datée, rend le créneau
 *      disponible même sans motif récurrent.
 *   3. Sinon, si AUCUNE ligne `specificDate` n'existe pour cette date exacte,
 *      repli sur le motif récurrent (`dayOfWeek`, `isRecurring: true`,
 *      fenêtre `validFrom`/`validUntil` couvrant la date, fenêtre horaire
 *      couvrant le créneau).
 *
 * Choix de conception : dès qu'AU MOINS UNE ligne `specificDate` existe pour
 * le jour demandé, elle devient AUTORITAIRE pour toute la journée — le motif
 * récurrent n'est plus consulté du tout, même pour un sous-créneau que
 * qu'aucune ligne datée ne couvre (résultat : indisponible). C'est la lecture
 * « le plus spécifique remplace entièrement », pas une fusion créneau par
 * créneau : une correction ponctuelle d'un jour donné (ex. « seulement 9h-12h
 * ce mardi au lieu de 9h-17h ») est ainsi complète et non partiellement
 * recouverte par l'ancien motif récurrent sur le reste de la journée.
 *
 * Fonction PURE (`resolveEffectiveAvailability`) + enveloppe Prisma fine
 * (`loadEffectiveAvailability`), même découpage que le reste de
 * `lib/planning/`.
 */

import type { Prisma } from '@prisma/client';

export interface CoachAvailabilityWindow {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly specificDate: Date | null;
  readonly isAvailable: boolean;
  readonly isRecurring: boolean;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
}

export interface AvailabilityCandidate {
  /** Date-seule (heure ignorée) de l'occurrence demandée. */
  readonly date: Date;
  readonly startTime: string;
  readonly endTime: string;
}

export type AvailabilityReason =
  | 'DATED_BLACKOUT'
  | 'DATED_AVAILABLE'
  | 'RECURRING_AVAILABLE'
  | 'NO_MATCHING_AVAILABILITY';

export interface AvailabilityCheck {
  readonly available: boolean;
  readonly reason: AvailabilityReason;
}

function isSameCalendarDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Tronque à minuit UTC — les colonnes `validFrom`/`validUntil` portent une
 * heure, mais leur rôle ici est de délimiter des JOURS, pas des instants. */
function startOfUTCDate(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function coversWindow(
  row: Pick<CoachAvailabilityWindow, 'startTime' | 'endTime'>,
  candidate: AvailabilityCandidate,
): boolean {
  return row.startTime <= candidate.startTime && row.endTime >= candidate.endTime;
}

export function resolveEffectiveAvailability(
  rows: readonly CoachAvailabilityWindow[],
  candidate: AvailabilityCandidate,
): AvailabilityCheck {
  const datedRows = rows.filter(
    (row) => row.specificDate !== null && isSameCalendarDate(row.specificDate, candidate.date),
  );

  if (datedRows.length > 0) {
    const blackout = datedRows.find((row) => !row.isAvailable && coversWindow(row, candidate));
    if (blackout) return { available: false, reason: 'DATED_BLACKOUT' };

    const replacement = datedRows.find((row) => row.isAvailable && coversWindow(row, candidate));
    if (replacement) return { available: true, reason: 'DATED_AVAILABLE' };

    return { available: false, reason: 'NO_MATCHING_AVAILABILITY' };
  }

  const candidateDay = startOfUTCDate(candidate.date);
  const recurring = rows.find(
    (row) =>
      row.isRecurring &&
      row.isAvailable &&
      row.specificDate === null &&
      row.dayOfWeek === candidate.date.getUTCDay() &&
      startOfUTCDate(row.validFrom) <= candidateDay &&
      (row.validUntil === null || startOfUTCDate(row.validUntil) >= candidateDay) &&
      coversWindow(row, candidate),
  );

  return recurring
    ? { available: true, reason: 'RECURRING_AVAILABLE' }
    : { available: false, reason: 'NO_MATCHING_AVAILABILITY' };
}

// ── Enveloppe impure ─────────────────────────────────────────────────────────

/**
 * Charge la disponibilité effective d'un coach depuis le client de
 * TRANSACTION fourni. `CoachAvailability.coachId` référence `User.id`, pas
 * `CoachProfile.id` — cette enveloppe résout donc `CoachProfile.userId`
 * avant d'interroger `coachAvailability`.
 */
export async function loadEffectiveAvailability(
  tx: Prisma.TransactionClient,
  coachProfileId: string,
  candidate: AvailabilityCandidate,
): Promise<AvailabilityCheck> {
  const coachProfile = await tx.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { userId: true },
  });
  if (!coachProfile) return { available: false, reason: 'NO_MATCHING_AVAILABILITY' };

  const rows = await tx.coachAvailability.findMany({
    where: { coachId: coachProfile.userId },
  });

  return resolveEffectiveAvailability(rows, candidate);
}
