/**
 * Unit tests for buildQuotePdfDataFromPersistedQuote (mission "vers un
 * produit complet" §4) — pure function, constructed Quote/QuoteLine
 * fixtures, no DB. Covers: brouillon banner driven by
 * collectQuoteEmissionBlockers (never a client-trusted flag), P11's
 * single-payment rendering (no fabricated 25%/mensualités schedule), the
 * carte-examen section parsed from the exact shape
 * app/api/assistante/candidat-individuel/profils/[id]/quote/route.ts
 * actually persists, and the absence of any cost/margin leak.
 */
import type { Quote, QuoteLine } from '@prisma/client';
import { buildQuotePdfDataFromPersistedQuote } from '@/lib/quotes/pdf-adapter.server';

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-test-1',
    publicTokenHash: 'hash',
    publicTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    idempotencyKey: 'idem-1',
    status: 'ESTIMATION',
    source: 'STAFF_WORKSPACE',
    contactLeadId: null,
    studentId: null,
    profilId: 'profil-1',
    diagnosticId: null,
    diagnosticChecksum: null,
    examSession: 2027,
    pricingVersion: 'v1',
    examPolicyVersion: 'v1',
    parcours: null,
    snapshotCarte: null,
    snapshotRegles: null,
    regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED',
    budget: 800,
    strategy: 'BEST_BALANCE',
    matchedOfferId: null,
    currency: 'TND',
    monthlyTotal: 470,
    grandTotal: 4700,
    deposit: 1175,
    lastInstallmentAmount: 465,
    validUntil: new Date('2027-01-01T00:00:00Z'),
    previousRevisionId: null,
    revisionNumber: 1,
    createdByUserId: 'staff-1',
    updatedByUserId: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    sentAt: null,
    consultedAt: null,
    ...overrides,
  } as Quote;
}

function makeLine(overrides: Partial<QuoteLine> = {}): QuoteLine {
  return {
    id: 'line-1',
    quoteId: 'quote-test-1',
    subject: 'Mathématiques',
    modality: 'GROUPE',
    hoursPerMonth: 8,
    unitPrice: 470,
    months: 10,
    lineTotal: 4700,
    offerId: null,
    priority: 'Haute',
    reason: 'Spécialité principale',
    sortOrder: 0,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  } as QuoteLine;
}

const BASE_INPUT = {
  parentName: 'Parent Test',
  parentEmail: 'parent@test.com',
  parentPhone: '+216 99 000 000',
  studentName: 'Élève Test',
  advisorName: 'Assistante Nexus',
};

describe('buildQuotePdfDataFromPersistedQuote', () => {
  it('marks a quote without CARTE_VALIDATED_DEFINITIVE as a brouillon interne — never a client-trusted flag', () => {
    const quote = makeQuote({ regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED' });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });

    expect(dto.draftBannerTitle).toBe('BROUILLON INTERNE — NE PAS ENVOYER');
    expect(dto.regulatoryDisclaimer).toMatch(/brouillon interne/i);
  });

  it('marks a quote as brouillon even when regulatoryMaturity=CARTE_VALIDATED_DEFINITIVE if other emission blockers remain (profilId missing, no snapshotRegles, etc.)', () => {
    // collectQuoteEmissionBlockers checks 5 independent conditions — this
    // proves the PDF banner tracks the REAL gate, not a single field.
    const quote = makeQuote({ regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE', snapshotRegles: null });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });
    expect(dto.draftBannerTitle).toBe('BROUILLON INTERNE — NE PAS ENVOYER');
  });

  it('never sets the brouillon banner once every emission-guard condition is genuinely satisfied', () => {
    const quote = makeQuote({
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
      profilId: 'profil-1',
      pricingVersion: 'v1',
      snapshotRegles: { costPolicy: {} },
      snapshotCarte: { carte: { epreuves: [], parcours: { parcoursPrincipal: 'P1' }, avertissementsGeneraux: [] }, emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
    });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });
    expect(dto.draftBannerTitle).toBeUndefined();
    expect(dto.regulatoryDisclaimer).toBeUndefined();
  });

  it('renders P11-style quotes (deposit=null) as a single "paiement intégral à la réservation" line, never a fabricated 25%+mensualités schedule', () => {
    const quote = makeQuote({ deposit: null, lastInstallmentAmount: null, monthlyTotal: 1800, grandTotal: 1800 });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });

    expect(dto.offer.ech).toHaveLength(1);
    expect(dto.offer.ech[0].label).toMatch(/intégral.*réservation/i);
    expect(dto.offer.ech[0].amount).toBe(1800);
  });

  it('renders a standard annual quote as acompte + 9 regular installments + a corrected last installment', () => {
    // months=10 (makeLine default) => 1 acompte + 9 mensualités regulières + 1 dernière = 10 lignes,
    // matching D4 (25% acompte + 10 mensualités) exactly.
    const quote = makeQuote({ deposit: 1175, monthlyTotal: 470, lastInstallmentAmount: 465, grandTotal: 5870 });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine({ months: 10 })] }, ...BASE_INPUT });

    // 1 acompte + 10 mensualités (9 regular + 1 corrected last) = 11 rows —
    // same structure as the legacy adapter's buildInstallments.
    expect(dto.offer.ech).toHaveLength(11);
    const total = dto.offer.ech.reduce((sum, item) => sum + item.amount, 0);
    expect(total).toBe(5870);
    expect(dto.offer.ech[0].label).toMatch(/acompte/i);
    expect(dto.offer.ech[dto.offer.ech.length - 1].amount).toBe(465);
  });

  it('parses the carte-examen snapshot in the exact shape the quote-creation route persists it', () => {
    const quote = makeQuote({
      snapshotCarte: {
        carte: {
          parcours: { parcoursPrincipal: 'P1_LIBRE_2ANS' },
          epreuves: [
            { code: 'maths', libelle: 'Mathématiques', matiere: 'Mathématiques', statut: 'A_PRESENTER', coefficientEffectif: 8, sourceReglementaire: 'Arrêté X' },
            { code: 'histoire', libelle: 'Histoire-Géo', matiere: 'Histoire-Géo', statut: 'CONSERVEE', coefficientEffectif: 'À_VERIFIER', sourceReglementaire: 'Arrêté Y' },
          ],
          avertissementsGeneraux: ['Rythme compressé — accompagnement renforcé à arbitrer explicitement'],
        },
        emissionAutomatiqueAutorisee: false,
        necessiteVerificationHumaine: true,
      },
    });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });

    expect(dto.carteExamen).toBeDefined();
    expect(dto.carteExamen!.parcoursLabel).toBe('P1_LIBRE_2ANS');
    expect(dto.carteExamen!.necessiteVerificationHumaine).toBe(true);
    expect(dto.carteExamen!.epreuves).toHaveLength(2);
    expect(dto.carteExamen!.epreuves[0].coefficient).toBe('8');
    expect(dto.carteExamen!.epreuves[1].coefficient).toBe('À vérifier');
    expect(dto.carteExamen!.epreuves[1].statut).toBe('Conservée');
    expect(dto.carteExamen!.avertissements).toContain('Rythme compressé — accompagnement renforcé à arbitrer explicitement');
  });

  it('omits the carte-examen section entirely for a legacy quote (no snapshotCarte)', () => {
    const quote = makeQuote({ snapshotCarte: null });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });
    expect(dto.carteExamen).toBeUndefined();
  });

  it('never leaks cost/margin data into the DTO even when snapshotRegles carries it', () => {
    const quote = makeQuote({
      snapshotRegles: {
        costPolicy: { teacherCostPerHourTnd: 50, structureCostPerHourTnd: 15 },
        margin: { marginPct: 61.2, gate: 'GREEN' },
      },
    });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });

    const serialized = JSON.stringify(dto);
    expect(serialized).not.toMatch(/teacherCostPerHourTnd|structureCostPerHourTnd|marginPct|costPolicy/i);
  });
});
