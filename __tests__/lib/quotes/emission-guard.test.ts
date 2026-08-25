import type { Quote } from '@prisma/client';
import {
  assertQuoteCanBeAccepted,
  assertQuoteCanBeSent,
  collectQuoteEmissionBlockers,
  QuoteNotEmittableError,
} from '@/lib/quotes/emission-guard';

function legacyQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED',
    profilId: null,
    pricingVersion: 'v1',
    snapshotRegles: null,
    snapshotCarte: null,
    ...overrides,
  } as Quote;
}

function completeQuote(overrides: Partial<Quote> = {}): Quote {
  return legacyQuote({
    regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
    profilId: 'profil-1',
    snapshotRegles: { note: 'test' },
    snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
    ...overrides,
  });
}

describe('collectQuoteEmissionBlockers — invariant complet (mission Lot 5 correctif §1)', () => {
  test('un devis legacy accumule tous les blocages pertinents', () => {
    const reasons = collectQuoteEmissionBlockers(legacyQuote());
    expect(reasons).toContain('regulatoryMaturity != CARTE_VALIDATED_DEFINITIVE');
    expect(reasons).toContain('profilId missing');
    expect(reasons).toContain('snapshotRegles missing');
    expect(reasons).toContain('snapshotCarte missing or invalid');
  });

  test('un devis complet ne produit aucun blocage', () => {
    expect(collectQuoteEmissionBlockers(completeQuote())).toEqual([]);
  });

  test('maturité correcte mais profilId manquant : bloqué', () => {
    const reasons = collectQuoteEmissionBlockers(completeQuote({ profilId: null }));
    expect(reasons).toContain('profilId missing');
  });

  test('carte présente mais emissionAutomatiqueAutorisee=false : bloqué', () => {
    const reasons = collectQuoteEmissionBlockers(
      completeQuote({ snapshotCarte: { emissionAutomatiqueAutorisee: false, necessiteVerificationHumaine: false } }),
    );
    expect(reasons).toContain('snapshotCarte.emissionAutomatiqueAutorisee != true');
  });

  test('carte présente mais necessiteVerificationHumaine=true : bloqué même si emissionAutomatiqueAutorisee=true', () => {
    const reasons = collectQuoteEmissionBlockers(
      completeQuote({ snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: true } }),
    );
    expect(reasons).toContain('snapshotCarte.necessiteVerificationHumaine != false');
  });

  test('snapshotCarte de forme inattendue (tableau, primitif) : traité comme invalide, jamais silencieusement accepté', () => {
    expect(collectQuoteEmissionBlockers(completeQuote({ snapshotCarte: [] as never }))).toContain(
      'snapshotCarte missing or invalid',
    );
    expect(collectQuoteEmissionBlockers(completeQuote({ snapshotCarte: 'oui' as never }))).toContain(
      'snapshotCarte missing or invalid',
    );
  });

  test('pricingVersion manquant : bloqué (version tarifaire requise)', () => {
    const reasons = collectQuoteEmissionBlockers(completeQuote({ pricingVersion: '' }));
    expect(reasons).toContain('pricingVersion missing');
  });
});

describe('assertQuoteCanBeSent / assertQuoteCanBeAccepted', () => {
  test('ne lèvent rien pour un devis complet', () => {
    expect(() => assertQuoteCanBeSent(completeQuote())).not.toThrow();
    expect(() => assertQuoteCanBeAccepted(completeQuote())).not.toThrow();
  });

  test('lèvent QuoteNotEmittableError pour un devis legacy, avec les raisons attachées (jamais silencieux)', () => {
    try {
      assertQuoteCanBeSent(legacyQuote());
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(QuoteNotEmittableError);
      expect((error as InstanceType<typeof QuoteNotEmittableError>).reasons.length).toBeGreaterThan(0);
    }
    expect(() => assertQuoteCanBeAccepted(legacyQuote())).toThrow(QuoteNotEmittableError);
  });

  test('aucun paramètre de contournement (override) n\'existe sur ces fonctions — signature à un seul argument', () => {
    expect(assertQuoteCanBeSent.length).toBe(1);
    expect(assertQuoteCanBeAccepted.length).toBe(1);
  });
});
