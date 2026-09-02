/**
 * R1 — the reference "devis personnalisé V1" dossier (docs/candidat-
 * individuel/ADR-MID-YEAR-BILLING-MODEL.md), proven as a REAL HTTP contract
 * through the STAFF canonical pipeline end-to-end — mission "fair go-live"
 * Phase I: Profil API -> quote-creation API -> Prisma Quote/QuoteLine ->
 * staff PDF -> signed-link family-read gate. Real Postgres, real routes,
 * real PDF rendering (poppler-verified) — never a function-level shortcut.
 *
 * R1: Pilotage 150, Maths (EDS1) 250, NSI (EDS2) 250, Philo 250,
 *   Grand Oral 144 -> total 10 440, acompte 2 610, 10 mensualités de 783.
 * __tests__/lib/quotes/r1-r2-reference-dossiers.test.ts already locked
 * this exact composition through the LEGACY engine (buildRecommendation).
 * This file proves the SAME numbers are reachable and exact through the
 * STAFF canonical pipeline (buildCandidateQuoteRecommendation) — dispensing
 * HG/LVA/LVB/ES/EMC (the always-DIRECTION_A_VALIDER blockers on a nominal
 * terminale profile) leaves exactly R1's 5 lines undispensed and
 * automatically priced, sans bilan (NON_EVALUE -> 4h/module), matching the
 * ADR's own numbers to the TND.
 *
 * R2 (spécialité abandonnée + mixed LVA-individuel/LVB-duo modalities) is
 * NOT reproduced here as a full HTTP round trip: LVA/LVB are always
 * DIRECTION_A_VALIDER in the real canonical catalogue (confirmed
 * repeatedly this session), so R2's exact line selection is unreachable
 * without mocking a direction-approval decision that doesn't exist in
 * production — the same finding incrément 3 already recorded for the
 * legacy engine. R2's payment-schedule invariant is already locked at the
 * engine level (r1-r2-reference-dossiers.test.ts). The mission's requested
 * "R2 warning text verbatim" ("Important : cet accompagnement porte sur le
 * programme de Première...") does not exist anywhere in this codebase
 * today (confirmed by exhaustive grep) — not added here without clearer
 * confirmation this is real, wanted product copy rather than an
 * illustrative quote; recorded as a named POST_FAIR decision item in the
 * final report, not silently fabricated.
 */
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

let authResult: { user: { id: string; role: string; email: string } } | 'FORBIDDEN' = {
  user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' },
};
jest.mock('@/lib/guards', () => {
  const { NextResponse } = require('next/server');
  return {
    requireAnyRole: jest.fn(async () => {
      if (authResult === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      return authResult;
    }),
    isErrorResponse: (r: unknown) => {
      if (typeof r !== 'object' || r === null) return false;
      const x = r as { json?: unknown; status?: unknown };
      return typeof x.json === 'function' && 'status' in (r as object);
    },
  };
});

import { randomUUID } from 'crypto';
import { execFileSync } from 'child_process';
import { writeFile, rm } from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';
import { testPrisma, setupTestDatabase, canConnectToTestDb } from '../setup/test-database';
import { _resetForTest, _setForTest } from '@/lib/config/snapshot';
import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import { POST as createQuotePOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/quote/route';
import { GET as pdfGET } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/pdf/route';
import { getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
import { hashToken } from '@/lib/invoice/access-token';

const prisma = testPrisma;

// Dispenses only the 5 modules that are always DIRECTION_A_VALIDER on a
// nominal terminale profile (HG/LVA/LVB/ES/EMC) — leaves EDS1/EDS2/
// philosophie/grand-oral undispensed, exactly R1's 5-line composition
// (matches the existing golden fixture "profil READY avec EDS1/EDS2").
const R1_STAFF_EXTENSION = {
  dispensesDeclarees: [
    { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-5' },
    { epreuveId: 'lva', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-6' },
    { epreuveId: 'lvb', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-7' },
    { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-8' },
    { epreuveId: 'emc', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-9' },
  ],
};

function activatePipeline() {
  _setForTest([
    { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() },
  ]);
}

function createQuoteReq(body: unknown) {
  return new NextRequest('http://localhost/api/assistante/candidat-individuel/profils/x/quote', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function pdfReq(quoteId: string) {
  return new NextRequest(`http://localhost/api/assistante/candidat-individuel/quotes/${quoteId}/pdf`);
}

async function extractPdfText(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `r1-http-contract-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
  }
}

describe('R1 — full HTTP contract through the staff canonical pipeline (mission "fair go-live" Phase I)', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('R1 HTTP contract tests require a reachable PostgreSQL test database — DATABASE_TEST_MODE=REQUIRED, never a silent skip');
    }
  }, 10000);

  beforeEach(async () => {
    await setupTestDatabase();
    _resetForTest();
    activatePipeline();
    authResult = { user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' } };
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  });

  test('Profil API -> quote-creation API: R1 exact numbers (grandTotal=10440, deposit=2610, monthlyTotal=783), READY, no override needed', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estTitulaireBacDejaObtenu: true }, staffExtension: R1_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      createQuoteReq({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.quote.grandTotal).toBe(10440);
    expect(body.quote.deposit).toBe(2610);
    expect(body.quote.monthlyTotal).toBe(783);

    // Prisma Quote/QuoteLine — persisted, not just the curated API response.
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id }, include: { lines: true } });
    expect(row.grandTotal).toBe(10440);
    expect(row.deposit).toBe(2610);
    expect(row.monthlyTotal).toBe(783);
    expect(row.lastInstallmentAmount).toBe(783);
    expect(row.paymentPolicy).toBe('ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS');
    // deposit + 9*monthlyTotal + lastInstallmentAmount === grandTotal, the
    // exact D4 invariant, proven against the persisted row (never a mock).
    expect((row.deposit ?? 0) + row.monthlyTotal * 9 + (row.lastInstallmentAmount ?? 0)).toBe(row.grandTotal);

    const lineTotals = row.lines.map((l) => l.unitPrice).sort((a, b) => a - b);
    expect(lineTotals).toEqual([144, 150, 250, 250, 250]); // Grand Oral, Pilotage, EDS1, EDS2, Philosophie — R1's exact 5 lines.
    // QuoteLine.subject is the immutable HUMAN LABEL snapshot (persistence.
    // server.ts::createQuote writes line.label, never the internal
    // pedagogicalSlot) — proves EDS1/EDS2 show as the real specialties.
    const subjects = row.lines.map((l) => l.subject).sort();
    expect(subjects).toContain('Mathématiques');
    expect(subjects).toContain('NSI');
  });

  test('staff PDF: R1\'s exact total (10440 TND), human specialty names, deposit/mensualités — never an internal code, never a cost/margin leak', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estTitulaireBacDejaObtenu: true }, staffExtension: R1_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const quoteRes = await createQuotePOST(
      createQuoteReq({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    const quoteBody = await quoteRes.json();
    expect(quoteRes.status).toBe(201);

    const res = await pdfGET(pdfReq(quoteBody.quote.id), { params: Promise.resolve({ quoteId: quoteBody.quote.id }) });
    expect(res.status).toBe(200);
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = await extractPdfText(buffer);

    expect(text).toContain('10440'); // grandTotal, human formatting may or may not add a thousands separator — check the digits are present.
    expect(text).toMatch(/2\s*610|2610/); // acompte.
    expect(text).toMatch(/783/); // mensualité.
    expect(text).toContain('Mathématiques');
    expect(text).toContain('NSI');
    expect(text).not.toMatch(/\beds1\b|\beds2\b/i); // never the internal pedagogicalSlot.
    expect(text).not.toMatch(/marge|teacherCost|costPolicy|profilId|token|hash/i);
  });

  // Mission "fair go-live" Phase J — PDF_MUST_SHOW / PDF_MUST_NEVER_SHOW,
  // checked exhaustively against a real rendered R1 PDF (not a mock DTO).
  test('PDF commercial content audit — every mission-required human field present, every named internal code/ID absent', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estTitulaireBacDejaObtenu: true }, staffExtension: R1_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const quoteRes = await createQuotePOST(
      createQuoteReq({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    const quoteBody = await quoteRes.json();
    expect(quoteRes.status).toBe(201);

    const res = await pdfGET(pdfReq(quoteBody.quote.id), { params: Promise.resolve({ quoteId: quoteBody.quote.id }) });
    expect(res.status).toBe(200);
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = await extractPdfText(buffer);

    // PDF_MUST_SHOW — human, family-facing content.
    expect(text).toMatch(/Nexus\s*Réussite/i);
    expect(text).toMatch(/session/i);
    expect(text).toMatch(/Mathématiques/);
    expect(text).toMatch(/NSI/);
    expect(text).toMatch(/Philosophie/i);
    expect(text).toMatch(/Grand\s*Oral/i);
    expect(text).toMatch(/Pilotage/i);
    expect(text).toMatch(/acompte/i);
    expect(text).toMatch(/mensualit/i); // mensualité/mensualités.
    expect(text).toMatch(/10440/);

    // PDF_MUST_NEVER_SHOW — internal codes/IDs, ever, regardless of case.
    for (const forbidden of [
      /\bMOD_[A-Z_]+\b/, // catalogue module ids.
      /\bSVC_[A-Z_]+\b/, // catalogue service ids.
      /\beds1\b/i,
      /\beds2\b/i,
      /coverageKey/i,
      /pricingRuleId/i,
      /\bmarge\b/i,
      /teacherCost/i,
      /structureCost/i,
      /dossierCost/i,
      /costPolicy/i,
      /\bprofilId\b/i,
      /\btoken\b/i,
      /\bhash\b/i,
      /\{\s*"/, // a raw JSON object literal leaking through.
    ]) {
      expect(text).not.toMatch(forbidden);
    }
  });

  test('family-read: R1\'s quote is correctly and safely blocked (NOT_FOUND) via its signed link — regulatoryMaturity stays LEGACY_ESTIMATE_UNVERIFIED by design (this route never promotes it), so no candidat-individuel quote is family-visible today; this is a deliberate fail-closed state, not an untested gap', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estTitulaireBacDejaObtenu: true }, staffExtension: R1_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const quoteRes = await createQuotePOST(
      createQuoteReq({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    const quoteBody = await quoteRes.json();
    expect(quoteRes.status).toBe(201);

    const rawToken = randomUUID();
    await prisma.quote.update({ where: { id: quoteBody.quote.id }, data: { publicTokenHash: hashToken(rawToken) } });

    const { quote, reason } = await getQuoteForFamilyView(rawToken);
    expect(quote).toBeNull();
    expect(reason).toBe('NOT_FOUND');
  });
});
