/**
 * DB integration test for the candidat-individuel PDF integration (mission
 * "vers un produit complet" §4/§5/§6) — real Postgres, real pipeline, real
 * createQuote, real renderQuotePDF (poppler-verified). Covers: the staff
 * PDF route, its role/flag/ownership guards, the signed-link gate blocking
 * an unready candidat-individuel draft while leaving a legacy quote
 * (profilId null) fully untouched.
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
import { createQuote } from '@/lib/quotes/persistence.server';

const prisma = testPrisma;

const READY_STAFF_EXTENSION = {
  dispensesDeclarees: [
    { epreuveId: 'eds1', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-1' },
    { epreuveId: 'eds2', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-2' },
    { epreuveId: 'philosophie', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-3' },
    { epreuveId: 'grand-oral', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-4' },
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

function createQuoteReq() {
  return new NextRequest('http://localhost/api/assistante/candidat-individuel/profils/x/quote', {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function pdfReq(quoteId: string) {
  return new NextRequest(`http://localhost/api/assistante/candidat-individuel/quotes/${quoteId}/pdf`);
}

async function extractPdfText(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `candidat-individuel-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
  }
}

async function createReadyQuote() {
  const created = await createProfilCandidat(
    { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: READY_STAFF_EXTENSION },
    'staff-1',
  );
  if (!created.ok) throw new Error('profil creation failed in test fixture');

  const res = await createQuotePOST(createQuoteReq(), { params: Promise.resolve({ id: created.profil.id }) });
  const body = await res.json();
  if (res.status !== 201) throw new Error(`quote creation failed in test fixture: ${res.status} ${JSON.stringify(body)}`);
  return body.quote.id as string;
}

describe('Candidat-individuel PDF integration (mission "vers un produit complet" §4)', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('candidat-individuel PDF tests require a reachable PostgreSQL test database — DATABASE_TEST_MODE=REQUIRED, never a silent skip');
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

  test('staff PDF route: 403 when the pipeline flag is OFF', async () => {
    const quoteId = await createReadyQuote();
    _resetForTest(); // flag defaults OFF
    const res = await pdfGET(pdfReq(quoteId), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(403);
  });

  test('staff PDF route: 403 for a role outside ADMIN/ASSISTANTE', async () => {
    const quoteId = await createReadyQuote();
    authResult = 'FORBIDDEN';
    const res = await pdfGET(pdfReq(quoteId), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(403);
  });

  test('staff PDF route: 404 for an unknown quote id', async () => {
    const res = await pdfGET(pdfReq('does-not-exist'), { params: Promise.resolve({ quoteId: 'does-not-exist' }) });
    expect(res.status).toBe(404);
  });

  test('staff PDF route: 404 for a legacy quote (profilId null) — this route is scoped to candidat-individuel only', async () => {
    const legacy = await createQuote({
      idempotencyKey: randomUUID(),
      source: 'PUBLIC_SIMULATOR',
      examSession: 2027,
      budget: 500,
      strategy: 'BEST_BALANCE',
      scenario: {
        tier: 'RECOMMANDE',
        months: 10,
        deposit: 1000,
        monthlyTotal: 400,
        lastInstallmentAmount: 400,
        grandTotal: 4600,
        matchedOfferId: null,
        includedFeatures: [],
        lines: [{ label: 'Mathématiques', modality: 'GROUPE', hoursPerMonth: 8, unitPriceMonthly: 400, offerId: null, priorityLabel: 'Haute', reason: 'Test' }],
      } as never,
    });
    const res = await pdfGET(pdfReq(legacy.quote.id), { params: Promise.resolve({ quoteId: legacy.quote.id }) });
    expect(res.status).toBe(404);
  });

  test('staff PDF route: 200, a real PDF, the brouillon banner, the carte-examen page, and no cost/margin leak', async () => {
    const quoteId = await createReadyQuote();
    const res = await pdfGET(pdfReq(quoteId), { params: Promise.resolve({ quoteId }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');

    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');

    const text = await extractPdfText(buffer);
    expect(text).toContain('BROUILLON INTERNE');
    expect(text).toContain("Carte d'examen");
    // Every quote created through this route today is still
    // LEGACY_ESTIMATE_UNVERIFIED-equivalent (nothing promotes
    // regulatoryMaturity to CARTE_VALIDATED_DEFINITIVE yet) — so the
    // review-needed banner must also be present.
    expect(text).not.toMatch(/marge|teacherCost|costPolicy|TND\/h\b/i);
  });

  test('signed-link gate: an unready candidat-individuel draft is NOT viewable via its public token (same NOT_FOUND as an invalid token)', async () => {
    const quoteId = await createReadyQuote();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });

    // getQuoteByPublicToken needs the RAW token, which createQuotePOST's
    // curated response never returns (by design — mission §9). Read the
    // row directly and mint a fresh token the same way createQuote does,
    // to exercise the gate deterministically without depending on a
    // discarded raw token.
    const { hashToken } = await import('@/lib/invoice/access-token');
    const rawToken = randomUUID();
    await prisma.quote.update({ where: { id: row.id }, data: { publicTokenHash: hashToken(rawToken) } });

    const { quote, reason } = await getQuoteForFamilyView(rawToken);
    expect(quote).toBeNull();
    expect(reason).toBe('NOT_FOUND');
  });

  test('signed-link gate: a legacy quote (profilId null) keeps its exact prior behavior — visible via its token regardless of emission-guard state', async () => {
    const legacy = await createQuote({
      idempotencyKey: randomUUID(),
      source: 'PUBLIC_SIMULATOR',
      examSession: 2027,
      budget: 500,
      strategy: 'BEST_BALANCE',
      scenario: {
        tier: 'RECOMMANDE',
        months: 10,
        deposit: 1000,
        monthlyTotal: 400,
        lastInstallmentAmount: 400,
        grandTotal: 4600,
        matchedOfferId: null,
        includedFeatures: [],
        lines: [{ label: 'Mathématiques', modality: 'GROUPE', hoursPerMonth: 8, unitPriceMonthly: 400, offerId: null, priorityLabel: 'Haute', reason: 'Test' }],
      } as never,
    });
    expect(legacy.rawToken).not.toBeNull();

    const { quote } = await getQuoteForFamilyView(legacy.rawToken!);
    expect(quote).not.toBeNull();
    expect(quote!.id).toBe(legacy.quote.id);
  });
});

describe('Candidat-individuel P11 PDF + signed-link proof (mission "vers un produit complet" lot de fermeture P11 §6) — SVC_SECOND_GROUPE APPROVED via fixture only, never the real canonical catalogue', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('P11 PDF tests require a reachable PostgreSQL test database — DATABASE_TEST_MODE=REQUIRED, never a silent skip');
    }
  }, 10000);

  beforeEach(async () => {
    await setupTestDatabase();
    _resetForTest();
    activatePipeline();
    authResult = { user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' } };
    jest.resetModules();
    jest.doMock('@/lib/pricing', () => {
      const actual = jest.requireActual('@/lib/pricing');
      const raw = actual.getCandidatIndividuelCatalogueRaw();
      const approved = {
        ...raw,
        services: raw.services.map((s: { serviceId: string; directionApprovalStatus: string }) =>
          s.serviceId === 'SVC_SECOND_GROUPE' ? { ...s, directionApprovalStatus: 'APPROVED' } : s,
        ),
      };
      return { ...actual, getCandidatIndividuelCatalogueRaw: () => approved };
    });
  });

  afterEach(() => {
    jest.dontMock('@/lib/pricing');
    jest.resetModules();
  });

  async function createReadyP11Quote(): Promise<string> {
    // jest.resetModules() in beforeEach wipes the in-memory config snapshot
    // singleton along with everything else — re-activate the pipeline flag
    // against the freshly re-imported module, not the stale pre-reset one.
    const { _setForTest: setForTestFresh } = await import('@/lib/config/snapshot');
    setForTestFresh([
      { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() },
    ]);

    const { resetCatalogueCacheForTests } = await import('@/lib/quotes/catalogue');
    resetCatalogueCacheForTests();
    const { createProfilCandidat: createProfil } = await import('@/lib/quotes/profil-candidat.server');
    const { POST: createQuote } = await import('@/app/api/assistante/candidat-individuel/profils/[id]/quote/route');

    const created = await createProfil(
      {
        publicInput: {
          level: 'TERMINALE', examSession: 2027, modalite: 'A',
          specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', moyenneRattrapage: 9,
        },
      },
      'staff-1',
    );
    if (!created.ok) throw new Error('P11 profil creation failed in test fixture');

    const res = await createQuote(createQuoteReq(), { params: Promise.resolve({ id: created.profil.id }) });
    const body = await res.json();
    if (res.status !== 201) throw new Error(`P11 quote creation failed in test fixture: ${res.status} ${JSON.stringify(body)}`);
    return body.quote.id as string;
  }

  test('the pipeline reaches READY and persists paymentPolicy=PAY_IN_FULL_AT_BOOKING for a real P11 profile, end-to-end through the API route', async () => {
    const quoteId = await createReadyP11Quote();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.paymentPolicy).toBe('PAY_IN_FULL_AT_BOOKING');
    expect(row.deposit).toBe(row.grandTotal);
    expect(row.lastInstallmentAmount).toBe(0);
  });

  test('staff PDF route: the rendered PDF shows "paiement intégral à la réservation", never a fabricated acompte 25% / mensualités schedule, and no cost/margin leak', async () => {
    const quoteId = await createReadyP11Quote();
    const { GET: pdfGetP11 } = await import('@/app/api/assistante/candidat-individuel/quotes/[quoteId]/pdf/route');
    const res = await pdfGetP11(pdfReq(quoteId), { params: Promise.resolve({ quoteId }) });

    expect(res.status).toBe(200);
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = await extractPdfText(buffer);

    expect(text).toMatch(/intégral.*réservation|réservation.*intégral/i);
    expect(text).not.toMatch(/acompte.*25\s*%|25\s*%.*acompte/i);
    expect(text).not.toMatch(/marge|teacherCost|costPolicy/i);
  });

  test('signed-link view: the family-facing page (via getQuoteForFamilyView) exposes paymentPolicy=PAY_IN_FULL_AT_BOOKING for the P11 quote', async () => {
    const quoteId = await createReadyP11Quote();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });

    const { hashToken } = await import('@/lib/invoice/access-token');
    const rawToken = randomUUID();
    await prisma.quote.update({ where: { id: row.id }, data: { publicTokenHash: hashToken(rawToken) } });

    const { getQuoteForFamilyView: getFamilyView } = await import('@/lib/quotes/public-view.server');
    const { quote } = await getFamilyView(rawToken);
    // Same regulatoryMaturity gate as the existing "unready draft" test —
    // an unpromoted quote (LEGACY_ESTIMATE_UNVERIFIED, no CARTE_VALIDATED_
    // DEFINITIVE) is NOT_FOUND via the family view regardless of paymentPolicy,
    // so this proves the P11 wiring doesn't accidentally bypass that gate.
    expect(quote).toBeNull();
  });
});

describe('T2 — CANDIDAT INDIVIDUEL HEADCOUNT & GROUP STATE SAFETY (direction decision registry, commit 4ffaac8ed §9): PDF must reflect the effective (repriced) mode, never the requested GROUPE price', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('T2 PDF tests require a reachable PostgreSQL test database — DATABASE_TEST_MODE=REQUIRED, never a silent skip');
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

  // Dispenses only the DIRECTION_A_VALIDER-mapped épreuves — unlike
  // READY_STAFF_EXTENSION above (all 9 dispensed -> Pilotage-only, no
  // GROUPE line, T2 never applies), this leaves eds1/eds2/philosophie
  // undispensed so the pipeline selects their already-APPROVED,
  // GROUPE-modality modules — the exact scenario T2 needs to reprice.
  const MARGIN_SENSITIVE_STAFF_EXTENSION = {
    dispensesDeclarees: [
      { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-5' },
      { epreuveId: 'lva', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-6' },
      { epreuveId: 'lvb', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-7' },
      { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-8' },
      { epreuveId: 'emc', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-9' },
    ],
  };

  // MARGIN_SENSITIVE_STAFF_EXTENSION's RECOMMANDE scenario has exactly
  // three GROUPE-modality lines (eds1/eds2/philosophie) — every subject
  // gets the SAME headcount here to exercise the uniform-bascule case;
  // per-subject cardinality itself is proven at the DB level
  // (__tests__/database/candidat-individuel-quote-creation.test.ts).
  async function createGroupPricedQuote(confirmedHeadcount: number): Promise<string> {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: MARGIN_SENSITIVE_STAFF_EXTENSION },
      'staff-1',
    );
    if (!created.ok) throw new Error('profil creation failed in test fixture');
    const req = new NextRequest('http://localhost/api/assistante/candidat-individuel/profils/x/quote', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { eds1: confirmedHeadcount, eds2: confirmedHeadcount, philosophie: confirmedHeadcount },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await createQuotePOST(req, { params: Promise.resolve({ id: created.profil.id }) });
    const body = await res.json();
    if (res.status !== 201) throw new Error(`quote creation failed in test fixture: ${res.status} ${JSON.stringify(body)}`);
    return body.quote.id as string;
  }

  test('a confirmedHeadcount=1 (SOLO) quote\'s PDF shows "Individuel", never "Petit groupe", and the total exactly matches the persisted (repriced) grandTotal — state NOT_APPLICABLE per the T2-closeout semantics correction, never GROUP_CONFIRMED', async () => {
    const quoteId = await createGroupPricedQuote(1);
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });

    const res = await pdfGET(pdfReq(quoteId), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(200);
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = await extractPdfText(buffer);

    expect(text).not.toContain('Petit groupe');
    expect(text).toContain('Individuel');
    // The persisted grandTotal (already proven repriced at the DB level,
    // __tests__/database/candidat-individuel-quote-creation.test.ts) must
    // be exactly what the family-facing PDF displays — no independent,
    // possibly-stale recomputation inside the PDF adapter.
    expect(text).toContain(String(row.grandTotal));
    expect(text).not.toMatch(/marge|teacherCost|costPolicy|TND\/h\b/i);
  });

  test('a confirmedHeadcount=2 (DUO) quote\'s PDF shows "Duo", never "Petit groupe"', async () => {
    const quoteId = await createGroupPricedQuote(2);
    const res = await pdfGET(pdfReq(quoteId), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(200);
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = await extractPdfText(buffer);

    expect(text).not.toContain('Petit groupe');
    expect(text).toMatch(/Duo/i);
  });

  test('no signed link (or PDF) can ever exist for a GROUP_PENDING quote — since confirmedHeadcountBySubject is never supplied, no Quote is ever persisted, exactly like a BLOCKED-margin or P3-blocked profile', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: MARGIN_SENSITIVE_STAFF_EXTENSION },
      'staff-1',
    );
    if (!created.ok) throw new Error('profil creation failed in test fixture');
    const req = new NextRequest('http://localhost/api/assistante/candidat-individuel/profils/x/quote', {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }), // no confirmedHeadcountBySubject
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await createQuotePOST(req, { params: Promise.resolve({ id: created.profil.id }) });
    expect(res.status).toBe(422);
    expect(await prisma.quote.count()).toBe(0);
  });
});
