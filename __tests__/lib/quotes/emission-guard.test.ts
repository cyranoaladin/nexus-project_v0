import type { Quote } from '@prisma/client';
import {
  assertQuoteCanBeAccepted,
  assertQuoteCanBeSent,
  collectFamilyLinkIssuanceBlockers,
  collectQuoteEmissionBlockers,
  collectQuotePromotionBlockers,
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
    grandTotal: 0,
    monthlyTotal: 0,
    ...overrides,
  } as Quote;
}

function completeQuote(overrides: Partial<Quote> = {}): Quote {
  return legacyQuote({
    regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
    profilId: 'profil-1',
    snapshotRegles: { margin: { gate: 'MARGIN_OK' }, groupState: { state: 'NOT_APPLICABLE' } },
    snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
    grandTotal: 2500,
    monthlyTotal: 250,
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

describe('collectQuotePromotionBlockers — T5R RECETTE_FINDING_3, gate for promoteQuoteToFamilyVisible', () => {
  test('un devis prêt (LEGACY_ESTIMATE_UNVERIFIED mais tout le reste valide) ne produit aucun blocage — regulatoryMaturity n\'est jamais exigée ici, c\'est ce que cette action définit', () => {
    const reasons = collectQuotePromotionBlockers(completeQuote({ regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED' }));
    expect(reasons).toEqual([]);
  });

  test('carte invalide (profilId manquant, snapshotCarte manquant) : mêmes blocages que collectQuoteEmissionBlockers', () => {
    const reasons = collectQuotePromotionBlockers(legacyQuote());
    expect(reasons).toContain('profilId missing');
    expect(reasons).toContain('snapshotCarte missing or invalid');
    expect(reasons).not.toContain('regulatoryMaturity != CARTE_VALIDATED_DEFINITIVE');
  });

  test('marginGate = BLOCKED : promotion refusée, même avec un override enregistré', () => {
    const reasons = collectQuotePromotionBlockers(
      completeQuote({
        regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED',
        snapshotRegles: { margin: { gate: 'BLOCKED' }, marginOverride: { reason: 'x' }, groupState: { state: 'NOT_APPLICABLE' } },
      }),
    );
    expect(reasons).toContain('snapshotRegles.margin.gate == BLOCKED');
  });

  test('groupState.state = GROUP_PENDING (défensif, ne devrait jamais être persisté) : promotion refusée', () => {
    const reasons = collectQuotePromotionBlockers(
      completeQuote({
        regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED',
        snapshotRegles: { margin: { gate: 'MARGIN_OK' }, groupState: { state: 'GROUP_PENDING' } },
      }),
    );
    expect(reasons).toContain('snapshotRegles.groupState.state == GROUP_PENDING');
  });

  test('total commercial <= 0 : promotion refusée (aucun 0 TND commercial)', () => {
    const reasons = collectQuotePromotionBlockers(completeQuote({ regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED', grandTotal: 0 }));
    expect(reasons).toContain('total commercial <= 0');
  });

  test('HUMAN_REVIEW_REQUIRED (margin WARNING) n\'est pas un blocage — seul BLOCKED l\'est', () => {
    const reasons = collectQuotePromotionBlockers(
      completeQuote({
        regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED',
        snapshotRegles: { margin: { gate: 'HUMAN_REVIEW_REQUIRED' }, groupState: { state: 'NOT_APPLICABLE' } },
      }),
    );
    expect(reasons).toEqual([]);
  });
});

describe('collectFamilyLinkIssuanceBlockers — T5R2 FAMILY_LINK_DISTRIBUTION, gate for issueOrRotateFamilyLink', () => {
  test('un devis publié (CARTE_VALIDATED_DEFINITIVE) et commercialement valide ne produit aucun blocage', () => {
    expect(collectFamilyLinkIssuanceBlockers(completeQuote())).toEqual([]);
  });

  test('un devis NON publié (LEGACY_ESTIMATE_UNVERIFIED) est bloqué — un lien ne peut être émis qu\'après publication (§5)', () => {
    const reasons = collectFamilyLinkIssuanceBlockers(completeQuote({ regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED' }));
    expect(reasons).toContain('regulatoryMaturity != CARTE_VALIDATED_DEFINITIVE');
  });

  test('marginGate = BLOCKED bloque l\'émission du lien, même si le devis est par ailleurs publié', () => {
    const reasons = collectFamilyLinkIssuanceBlockers(
      completeQuote({ snapshotRegles: { margin: { gate: 'BLOCKED' }, groupState: { state: 'NOT_APPLICABLE' } } }),
    );
    expect(reasons).toContain('snapshotRegles.margin.gate == BLOCKED');
  });

  test('GROUP_PENDING bloque l\'émission du lien (défensif)', () => {
    const reasons = collectFamilyLinkIssuanceBlockers(
      completeQuote({ snapshotRegles: { margin: { gate: 'MARGIN_OK' }, groupState: { state: 'GROUP_PENDING' } } }),
    );
    expect(reasons).toContain('snapshotRegles.groupState.state == GROUP_PENDING');
  });

  test('total commercial <= 0 bloque l\'émission du lien', () => {
    const reasons = collectFamilyLinkIssuanceBlockers(completeQuote({ grandTotal: 0 }));
    expect(reasons).toContain('total commercial <= 0');
  });

  test('carte invalide (profilId manquant) bloque l\'émission du lien, même avec regulatoryMaturity correcte', () => {
    const reasons = collectFamilyLinkIssuanceBlockers(completeQuote({ profilId: null }));
    expect(reasons).toContain('profilId missing');
  });
});
