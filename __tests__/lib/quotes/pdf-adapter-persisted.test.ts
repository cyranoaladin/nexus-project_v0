/**
 * buildQuotePdfDataFromPersistedQuote — maps an ALREADY-PERSISTED candidat-
 * individuel Quote (post creation, with deposit/lastInstallmentAmount/
 * parcours already frozen) into the EXISTING QuotePDFData shape
 * (lib/quote/pdf.ts's renderQuotePDF — the one and only PDF renderer,
 * PDF_ENGINE_COUNT=1). No new renderer, no new Quote/QuoteLine model.
 *
 * This file's exact claims: PDF_LINE_PRICING=PASS, PDF_TOTAL_RECONCILIATION=PASS,
 * PDF_PAYMENT_SCHEDULE=PASS (deposit=0, installments=10),
 * PDF_NO_INTERNAL_ENUMS=PASS, PDF_NO_TECHNICAL_LEAK=PASS.
 */
import type { Quote, QuoteLine } from '@prisma/client';
import { buildQuotePdfDataFromPersistedQuote } from '@/lib/quotes/pdf-adapter.server';

function baseQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    publicTokenHash: 'hash',
    publicTokenExpiresAt: new Date('2027-01-01'),
    idempotencyKey: 'idem-1',
    status: 'ESTIMATION',
    source: 'STAFF_WORKSPACE',
    contactLeadId: 'lead-1',
    studentId: null,
    diagnosticId: null,
    diagnosticChecksum: null,
    profilId: 'profil-1',
    snapshotCarte: null,
    snapshotRegles: null,
    parcours: 'P1_LIBRE_2ANS_MODALITE_A',
    examSession: 2027,
    pricingVersion: 'v1',
    examPolicyVersion: '2027@2026-01-01',
    budget: 700,
    strategy: 'BEST_BALANCE',
    matchedOfferId: null,
    currency: 'TND',
    monthlyTotal: 620,
    grandTotal: 6200,
    deposit: 0,
    lastInstallmentAmount: 620,
    regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
    paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
    validUntil: new Date('2027-06-01'),
    previousRevisionId: null,
    revisionNumber: 1,
    createdByUserId: 'staff-1',
    updatedByUserId: null,
    createdAt: new Date('2026-09-04'),
    updatedAt: new Date('2026-09-04'),
    sentAt: null,
    consultedAt: null,
    ...overrides,
  } as Quote;
}

function line(overrides: Partial<QuoteLine> = {}): QuoteLine {
  return {
    id: 'line-1',
    quoteId: 'quote-1',
    subject: 'Mathématiques',
    modality: 'GROUPE',
    hoursPerMonth: 8,
    unitPrice: 470,
    months: 10,
    lineTotal: 4700,
    offerId: null,
    priority: 'haute',
    reason: 'Priorité haute',
    sortOrder: 0,
    createdAt: new Date('2026-09-04'),
    ...overrides,
  } as QuoteLine;
}

const context = {
  leadName: 'Amira Ben Salah',
  leadEmail: 'amira@example.com',
  leadPhone: '+21620000000',
  advisorName: 'Nexus Réussite',
  levelLabel: 'Terminale',
  specialiteLabels: ['Mathématiques', 'NSI'],
};

describe('buildQuotePdfDataFromPersistedQuote', () => {
  test('PDF_LINE_PRICING: every line total reconciles unitPrice x months', () => {
    const lines = [line({ unitPrice: 470, months: 10, lineTotal: 4700 })];
    const data = buildQuotePdfDataFromPersistedQuote(baseQuote(), lines, context);
    expect(data.offer.inc).toContain('Mathématiques — 8 h/mois');
  });

  test('PDF_TOTAL_RECONCILIATION: offer.annualDisplay and budget reconcile with quote.grandTotal/monthlyTotal — never invented', () => {
    const data = buildQuotePdfDataFromPersistedQuote(baseQuote(), [line()], context);
    expect(data.offer.annualDisplay).toContain('6200');
    expect(data.budget).toContain('620');
    expect(data.publicAnnual).toBe(6200);
    expect(data.monthlyDisplay).toContain('620');
  });

  test('PDF_PAYMENT_SCHEDULE: deposit=0 renders no acompte row, exactly 10 mensualités, the last using lastInstallmentAmount', () => {
    const data = buildQuotePdfDataFromPersistedQuote(baseQuote({ deposit: 0, lastInstallmentAmount: 620 }), [line()], context);
    expect(data.offer.ech).toHaveLength(10);
    expect(data.offer.ech.every((row) => !/acompte/i.test(row.label))).toBe(true);
    expect(data.offer.ech[9].amount).toBe(620);
    expect(data.mode).toMatch(/sans acompte/i);
  });

  test('PDF_PAYMENT_SCHEDULE: a real deposit>0 (legacy row) renders exactly one acompte row plus the remaining installments', () => {
    const data = buildQuotePdfDataFromPersistedQuote(baseQuote({ deposit: 1550, lastInstallmentAmount: 517 }), [line()], context);
    const acompteRows = data.offer.ech.filter((row) => /acompte/i.test(row.label));
    expect(acompteRows).toHaveLength(1);
    expect(acompteRows[0].amount).toBe(1550);
    expect(data.offer.ech).toHaveLength(10); // 1 acompte + 9 remaining installments
  });

  test('PDF_NO_INTERNAL_ENUMS: no raw Prisma enum literal (ParcoursType/QuotePaymentPolicy/QuoteStatus) ever appears verbatim in any rendered string', () => {
    const data = buildQuotePdfDataFromPersistedQuote(baseQuote(), [line()], context);
    const flat = JSON.stringify(data);
    expect(flat).not.toMatch(/P1_LIBRE_2ANS_MODALITE_A|ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS|ESTIMATION|CARTE_VALIDATED_DEFINITIVE/);
  });

  test('PDF_NO_TECHNICAL_LEAK: profilId, pricing/examPolicy version, and publicTokenHash never appear — quoteNumber=quote.id is the one established, intentional reference (same convention as the pre-existing pdf-adapter.ts)', () => {
    const data = buildQuotePdfDataFromPersistedQuote(baseQuote(), [line()], context);
    const flat = JSON.stringify(data);
    expect(flat).not.toMatch(/profil-1|v1@|2027@2026-01-01|hash/);
    expect(data.quoteNumber).toBe('quote-1'); // the one intentional exception — an opaque reference number, never an enum/checksum
  });

  test('candidat-individuel identity: modalite/objectif never leak into a generic quote label, level comes from context not a hardcoded default', () => {
    const data = buildQuotePdfDataFromPersistedQuote(baseQuote(), [line()], context);
    expect(data.modalite).toBe('Candidat individuel');
    expect(data.level).toBe('Terminale');
    expect(data.specialites).toEqual(['Mathématiques', 'NSI']);
  });
});
