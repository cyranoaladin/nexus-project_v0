/**
 * Disponibilité EFFECTIVE d'un coach : motif récurrent, fenêtre de validité,
 * dérogation datée, blackout — avec la priorité « le plus spécifique
 * l'emporte » que `lib/session-booking.ts` n'implémente PAS correctement
 * aujourd'hui (voir le commentaire de tête de
 * lib/planning/effective-availability.ts).
 */

import {
  resolveEffectiveAvailability,
  type CoachAvailabilityWindow,
} from '@/lib/planning/effective-availability';

function recurring(overrides: Partial<CoachAvailabilityWindow> = {}): CoachAvailabilityWindow {
  return {
    dayOfWeek: 2, // mardi
    startTime: '09:00',
    endTime: '17:00',
    specificDate: null,
    isAvailable: true,
    isRecurring: true,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: null,
    ...overrides,
  };
}

function dated(overrides: Partial<CoachAvailabilityWindow> = {}): CoachAvailabilityWindow {
  return {
    dayOfWeek: 2,
    startTime: '09:00',
    endTime: '17:00',
    specificDate: new Date('2026-03-10T00:00:00Z'),
    isAvailable: true,
    isRecurring: false,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: null,
    ...overrides,
  };
}

// Mardi 10 mars 2026.
const TUESDAY = { date: new Date('2026-03-10T00:00:00Z'), startTime: '10:00', endTime: '11:00' };

describe('resolveEffectiveAvailability — motif récurrent', () => {
  it('disponible quand le motif récurrent couvre le jour et le créneau', () => {
    const result = resolveEffectiveAvailability([recurring()], TUESDAY);
    expect(result).toEqual({ available: true, reason: 'RECURRING_AVAILABLE' });
  });

  it("indisponible quand aucun motif ne correspond au jour de la semaine", () => {
    const result = resolveEffectiveAvailability([recurring({ dayOfWeek: 3 })], TUESDAY);
    expect(result).toEqual({ available: false, reason: 'NO_MATCHING_AVAILABILITY' });
  });

  it('indisponible quand le motif récurrent ne couvre pas la plage horaire demandée', () => {
    const result = resolveEffectiveAvailability(
      [recurring({ startTime: '09:00', endTime: '10:00' })],
      TUESDAY,
    );
    expect(result.available).toBe(false);
  });
});

describe('resolveEffectiveAvailability — fenêtre de validité', () => {
  it('indisponible avant validFrom', () => {
    const result = resolveEffectiveAvailability(
      [recurring({ validFrom: new Date('2026-04-01T00:00:00Z') })],
      TUESDAY,
    );
    expect(result).toEqual({ available: false, reason: 'NO_MATCHING_AVAILABILITY' });
  });

  it('indisponible après validUntil', () => {
    const result = resolveEffectiveAvailability(
      [recurring({ validUntil: new Date('2026-02-01T00:00:00Z') })],
      TUESDAY,
    );
    expect(result).toEqual({ available: false, reason: 'NO_MATCHING_AVAILABILITY' });
  });

  it('disponible le jour exact de validUntil (borne incluse)', () => {
    const result = resolveEffectiveAvailability(
      [recurring({ validUntil: new Date('2026-03-10T00:00:00Z') })],
      TUESDAY,
    );
    expect(result.available).toBe(true);
  });
});

describe('resolveEffectiveAvailability — dérogation datée', () => {
  it('rend disponible un jour normalement hors motif récurrent', () => {
    // Aucun motif récurrent ne matche (mauvais jour) mais une ligne datée le couvre.
    const result = resolveEffectiveAvailability(
      [recurring({ dayOfWeek: 4 }), dated({ isAvailable: true })],
      TUESDAY,
    );
    expect(result).toEqual({ available: true, reason: 'DATED_AVAILABLE' });
  });

  it("l'emporte même quand un motif récurrent contradictoire existe (le plus spécifique gagne)", () => {
    const result = resolveEffectiveAvailability(
      [recurring({ startTime: '09:00', endTime: '09:30' }), dated({ isAvailable: true })],
      TUESDAY,
    );
    expect(result).toEqual({ available: true, reason: 'DATED_AVAILABLE' });
  });
});

describe('resolveEffectiveAvailability — priorité blackout', () => {
  it('un blackout daté rend indisponible malgré un motif récurrent qui couvrirait le créneau', () => {
    const result = resolveEffectiveAvailability(
      [recurring(), dated({ isAvailable: false })],
      TUESDAY,
    );
    expect(result).toEqual({ available: false, reason: 'DATED_BLACKOUT' });
  });

  it('un blackout daté l\'emporte même face à une ligne datée disponible simultanée', () => {
    const result = resolveEffectiveAvailability(
      [dated({ isAvailable: true }), dated({ isAvailable: false })],
      TUESDAY,
    );
    expect(result).toEqual({ available: false, reason: 'DATED_BLACKOUT' });
  });

  it('un blackout qui ne couvre pas le créneau demandé ne bloque pas une autre ligne datée disponible', () => {
    const result = resolveEffectiveAvailability(
      [
        dated({ isAvailable: false, startTime: '12:00', endTime: '13:00' }),
        dated({ isAvailable: true, startTime: '09:00', endTime: '17:00' }),
      ],
      TUESDAY,
    );
    expect(result).toEqual({ available: true, reason: 'DATED_AVAILABLE' });
  });

  it("la présence d'une ligne datée pour le jour supprime tout repli sur le motif récurrent, même hors couverture", () => {
    // Ligne datée pour ce jour mais qui ne couvre pas 10h-11h : pas de repli
    // sur le motif récurrent qui, lui, couvrirait le créneau.
    const result = resolveEffectiveAvailability(
      [recurring(), dated({ startTime: '14:00', endTime: '15:00', isAvailable: true })],
      TUESDAY,
    );
    expect(result).toEqual({ available: false, reason: 'NO_MATCHING_AVAILABILITY' });
  });
});
