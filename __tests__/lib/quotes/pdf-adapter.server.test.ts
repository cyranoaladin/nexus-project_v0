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
import { PARCOURS_TYPE_LABELS, type ParcoursTypeCode } from '@/lib/exams/parcours';

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
    paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
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
  profil: { level: 'TERMINALE' as const, specialite1: 'MATHEMATIQUES' as const, specialite2: 'PHYSIQUE_CHIMIE' as const },
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

  it('renders a P11 scenario (paymentPolicy=PAY_IN_FULL_AT_BOOKING — the single unambiguous discriminant, mission "vers un produit complet" lot de fermeture P11) as a single "paiement intégral à la réservation" line, never a fabricated 25%+mensualités schedule', () => {
    const quote = makeQuote({ paymentPolicy: 'PAY_IN_FULL_AT_BOOKING', deposit: 1800, monthlyTotal: 1800, lastInstallmentAmount: 0, grandTotal: 1800 });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine({ months: 1 })] }, ...BASE_INPUT });

    expect(dto.offer.ech).toHaveLength(1);
    expect(dto.offer.ech[0].label).toMatch(/intégral.*réservation/i);
    expect(dto.offer.ech[0].amount).toBe(1800);
  });

  it('a P11 quote is never mistaken for the annual model even though deposit is set (deposit alone is ambiguous — equal to grandTotal for P11 too — paymentPolicy is the only safe discriminant)', () => {
    const quote = makeQuote({ paymentPolicy: 'PAY_IN_FULL_AT_BOOKING', deposit: 2880, monthlyTotal: 2880, lastInstallmentAmount: 0, grandTotal: 2880 });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine({ months: 1 })] }, ...BASE_INPUT });
    expect(dto.mode).toMatch(/intégral.*réservation/i);
    expect(dto.mode).not.toMatch(/acompte|25%/i);
  });

  it('a historical pre-D4 row (deposit=null, the ONLY real meaning that column carries today — schema.prisma\'s own doc comment) renders the "échéancier historique" disclosure, never the P11 message', () => {
    const quote = makeQuote({ deposit: null, lastInstallmentAmount: null, monthlyTotal: 1800, grandTotal: 1800 });
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine({ months: 10 })] }, ...BASE_INPUT });

    expect(dto.offer.ech).toHaveLength(1);
    expect(dto.offer.ech[0].label).toMatch(/échéancier historique/i);
    expect(dto.offer.ech[0].label).not.toMatch(/P11/);
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
          parcours: { parcoursPrincipal: 'P1_LIBRE_2ANS_MODALITE_A' },
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
    // T5R3 — the enum is translated to its human label, never passed through raw.
    expect(dto.carteExamen!.parcoursLabel).toBe('Candidat individuel — parcours sur deux ans');
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

  // ── T5R RECETTE_FINDING_4: FAMILY_PDF_LINE_PRICING = REQUIRED ──

  it('offer.incPriced carries each commercial line\'s own unitPrice, labelled with subject/hours/modality', () => {
    const quote = makeQuote({ monthlyTotal: 720 });
    const lines = [
      makeLine({ id: 'l1', subject: 'Pilotage Nexus', modality: 'PILOTAGE', hoursPerMonth: null, unitPrice: 150, sortOrder: 0 }),
      makeLine({ id: 'l2', subject: 'Mathématiques', modality: 'GROUPE', hoursPerMonth: 8, unitPrice: 470, sortOrder: 1 }),
      makeLine({ id: 'l3', subject: 'Langue vivante A', modality: 'INDIVIDUEL', hoursPerMonth: 4, unitPrice: 100, sortOrder: 2 }),
    ];
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines }, ...BASE_INPUT });

    expect(dto.offer.incPriced).toEqual([
      { label: 'Pilotage Nexus (Pilotage)', amount: 150 },
      { label: 'Mathématiques — 8 h/mois (Petit groupe)', amount: 470 },
      { label: 'Langue vivante A — 4 h/mois (Individuel)', amount: 100 },
    ]);
    expect(dto.offer.incPriced!.every((line) => line.amount > 0)).toBe(true);
    expect(dto.publicAnnual).toBeGreaterThan(0);
  });

  it('offer.incPriced amounts are read verbatim from each line\'s own unitPrice — never derived/split from a total (no invented ventilation)', () => {
    // Note: quote.monthlyTotal is the amortized-with-deposit recurring
    // installment (D4 pricing model), NOT necessarily the raw sum of
    // per-line monthly prices — grandTotal/months (equivalently
    // sum(lineTotal)) is the structurally correct reconciliation target;
    // see __tests__/database/t5r-quote-publish.test.ts for that proof
    // against a real, amortized quote. This test only proves the adapter
    // reads unitPrice mechanically, one line at a time.
    const quote = makeQuote({ monthlyTotal: 620 });
    const lines = [
      makeLine({ id: 'l1', subject: 'Pilotage Nexus', modality: 'PILOTAGE', hoursPerMonth: null, unitPrice: 150, sortOrder: 0 }),
      makeLine({ id: 'l2', subject: 'Français', modality: 'GROUPE', hoursPerMonth: 8, unitPrice: 470, sortOrder: 1 }),
    ];
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines }, ...BASE_INPUT });
    const sum = dto.offer.incPriced!.reduce((s, item) => s + item.amount, 0);
    expect(sum).toBe(quote.monthlyTotal);
  });

  it('rejects a persisted 0-TND commercial line at the published/PDF boundary instead of rendering or splitting the total', () => {
    const quote = makeQuote();
    const lines = [makeLine({ id: 'l1', subject: 'Ligne sans prix reconstructible', unitPrice: 0 })];
    expect(() => buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines }, ...BASE_INPUT })).toThrow(
      /PDF_LINE_PRICING_MODEL_BLOCKER/,
    );
  });

  it('offer.incPriced amounts never include teacherCost/structureCost/margin/marginGate/pricingRuleId/moduleId — only unitPrice', () => {
    const quote = makeQuote();
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });
    const serialized = JSON.stringify(dto.offer.incPriced);
    expect(serialized).not.toMatch(/teacherCost|structureCost|marginGate|pricingRuleId|moduleId|MOD_/i);
  });
});

describe('T5R3 §1 — FAMILY_PDF_INTERNAL_ENUMS = FORBIDDEN', () => {
  function quoteWithParcours(parcoursPrincipal: string) {
    return makeQuote({
      snapshotCarte: {
        carte: { parcours: { parcoursPrincipal }, epreuves: [], avertissementsGeneraux: [] },
        emissionAutomatiqueAutorisee: true,
        necessiteVerificationHumaine: false,
      },
    });
  }

  // Generic — every known ParcoursTypeCode, not just the one finding
  // originally reported (P1_LIBRE_2ANS_MODALITE_A). Catches a future code
  // added to the enum without a corresponding PARCOURS_TYPE_LABELS entry
  // too: parcoursLabel must never equal the raw code.
  it.each(Object.keys(PARCOURS_TYPE_LABELS) as ParcoursTypeCode[])('carte.parcoursLabel is a human label, never the raw enum, for %s', (code) => {
    const quote = quoteWithParcours(code);
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });
    expect(dto.carteExamen!.parcoursLabel).toBe(PARCOURS_TYPE_LABELS[code]);
    expect(dto.carteExamen!.parcoursLabel).not.toBe(code);
    expect(dto.carteExamen!.parcoursLabel).not.toMatch(/^P\d{1,2}_[A-Z_]+$/); // shape of the raw enum itself
  });

  it('an unrecognized parcours code fails closed to "Non renseigné" — never passed through raw', () => {
    const quote = quoteWithParcours('SOME_FUTURE_CODE_NOT_YET_MAPPED');
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });
    expect(dto.carteExamen!.parcoursLabel).toBe('Non renseigné');
  });

  it('"Niveau"/"Niveau ressenti" come from the profil\'s actual grade level, never from the parcours enum (P1_LIBRE_2ANS_MODALITE_A must not leak into level/currentLevel either)', () => {
    const quote = quoteWithParcours('P1_LIBRE_2ANS_MODALITE_A');
    const dto = buildQuotePdfDataFromPersistedQuote({
      quote: { ...quote, lines: [makeLine()] },
      ...BASE_INPUT,
      profil: { level: 'PREMIERE', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' },
    });
    expect(dto.level).toBe('Première');
    expect(dto.currentLevel).toBe('Première');
    expect(dto.level).not.toMatch(/P\d{1,2}_/);
    expect(dto.currentLevel).not.toMatch(/P\d{1,2}_/);
  });

  it('a whole-DTO serialization never contains a raw ParcoursTypeCode string, across every known code', () => {
    for (const code of Object.keys(PARCOURS_TYPE_LABELS)) {
      const quote = quoteWithParcours(code);
      const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT });
      expect(JSON.stringify(dto)).not.toContain(`"${code}"`);
    }
  });
});

describe('T5R3 §2 — FAMILY_PDF_EMPTY_SPECIALITES = FORBIDDEN', () => {
  it('Cas A — profil available: specialités are the real, human-labeled subjects from ProfilCandidat, not derived from commercial line labels', () => {
    const quote = makeQuote();
    const dto = buildQuotePdfDataFromPersistedQuote({
      quote: { ...quote, lines: [makeLine()] },
      ...BASE_INPUT,
      profil: { level: 'TERMINALE', specialite1: 'MATHEMATIQUES', specialite2: 'NSI' },
    });
    expect(dto.specialites).toEqual(['Mathématiques', 'NSI']);
  });

  it('Cas B — profil unavailable: specialites is empty (never invented/guessed), letting the renderer omit the row entirely rather than showing a placeholder', () => {
    const quote = makeQuote();
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines: [makeLine()] }, ...BASE_INPUT, profil: null });
    expect(dto.specialites).toEqual([]);
  });
});

describe('T5R4 §FINDING_9 — humanized commercial line labels (never a generic catalogue label when the real specialty is known)', () => {
  it('Cas A — MOD_EDS1/MOD_EDS2 generic labels are replaced by the real declared specialties', () => {
    const quote = makeQuote();
    const lines = [
      makeLine({ id: 'l1', subject: 'Enseignement de spécialité 1', modality: 'GROUPE', hoursPerMonth: 4, unitPrice: 250, sortOrder: 0 }),
      makeLine({ id: 'l2', subject: 'Enseignement de spécialité 2', modality: 'GROUPE', hoursPerMonth: 4, unitPrice: 250, sortOrder: 1 }),
    ];
    const dto = buildQuotePdfDataFromPersistedQuote({
      quote: { ...quote, lines },
      ...BASE_INPUT,
      profil: { level: 'TERMINALE', specialite1: 'MATHEMATIQUES', specialite2: 'NSI' },
    });
    expect(dto.offer.incPriced!.map((i) => i.label)).toEqual([
      'Mathématiques — 4 h/mois (Petit groupe)',
      'NSI — 4 h/mois (Petit groupe)',
    ]);
    // Never both the generic catalogue string AND the real name — the generic string must be gone entirely.
    expect(JSON.stringify(dto.offer.incPriced)).not.toMatch(/Enseignement de spécialité/);
  });

  it('Cas A — MOD_SPECIALITE_ABANDONNEE generic label is replaced by the real abandoned subject, volume/modality/price untouched', () => {
    const quote = makeQuote();
    const lines = [makeLine({ id: 'l1', subject: 'Spécialité de première non poursuivie (regroupement mono-discipline)', modality: 'GROUPE', hoursPerMonth: 4, unitPrice: 250, sortOrder: 0 })];
    const dto = buildQuotePdfDataFromPersistedQuote({
      quote: { ...quote, lines },
      ...BASE_INPUT,
      profil: { level: 'TERMINALE', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', specialiteAbandonnee: 'NSI' },
    });
    expect(dto.offer.incPriced![0].label).toBe('NSI — spécialité de Première non poursuivie — 4 h/mois (Petit groupe)');
    expect(dto.offer.incPriced![0].amount).toBe(250);
    expect(JSON.stringify(dto.offer.incPriced)).not.toMatch(/mono-discipline/);
  });

  it('Cas B — profil unavailable: generic catalogue labels are left exactly as persisted, never guessed', () => {
    const quote = makeQuote();
    const lines = [makeLine({ id: 'l1', subject: 'Enseignement de spécialité 1', unitPrice: 250 })];
    const dto = buildQuotePdfDataFromPersistedQuote({ quote: { ...quote, lines }, ...BASE_INPUT, profil: null });
    expect(dto.offer.incPriced![0].label).toContain('Enseignement de spécialité 1');
  });

  it('a subject that is not one of the three known generic catalogue labels is left untouched (e.g. Pilotage, Grand Oral, LVA/LVB — already specific)', () => {
    const quote = makeQuote();
    const lines = [makeLine({ id: 'l1', subject: 'Grand Oral', modality: 'INDIVIDUEL', hoursPerMonth: null, unitPrice: 144 })];
    const dto = buildQuotePdfDataFromPersistedQuote({
      quote: { ...quote, lines },
      ...BASE_INPUT,
      profil: { level: 'TERMINALE', specialite1: 'MATHEMATIQUES', specialite2: 'NSI' },
    });
    expect(dto.offer.incPriced![0].label).toBe('Grand Oral (Individuel)');
  });
});
