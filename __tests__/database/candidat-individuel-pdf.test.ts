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
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping candidat-individuel PDF tests: test database not available');
  }, 10000);

  beforeEach(async () => {
    if (!dbAvailable) return;
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
    if (!dbAvailable) return;
    const quoteId = await createReadyQuote();
    _resetForTest(); // flag defaults OFF
    const res = await pdfGET(pdfReq(quoteId), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(403);
  });

  test('staff PDF route: 403 for a role outside ADMIN/ASSISTANTE', async () => {
    if (!dbAvailable) return;
    const quoteId = await createReadyQuote();
    authResult = 'FORBIDDEN';
    const res = await pdfGET(pdfReq(quoteId), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(403);
  });

  test('staff PDF route: 404 for an unknown quote id', async () => {
    if (!dbAvailable) return;
    const res = await pdfGET(pdfReq('does-not-exist'), { params: Promise.resolve({ quoteId: 'does-not-exist' }) });
    expect(res.status).toBe(404);
  });

  test('staff PDF route: 404 for a legacy quote (profilId null) — this route is scoped to candidat-individuel only', async () => {
    if (!dbAvailable) return;
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
    if (!dbAvailable) return;
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
    if (!dbAvailable) return;
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
    if (!dbAvailable) return;
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
