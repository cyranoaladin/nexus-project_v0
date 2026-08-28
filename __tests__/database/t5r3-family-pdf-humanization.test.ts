/**
 * T5R3 — FAMILY PDF HUMANIZATION CLOSEOUT. Resolves the two T5B findings
 * (docs/candidat-individuel/t5b-human-recette/t5b-findings.md):
 *   - T5B_FINDING_1 (MAJOR): "Niveau"/"Niveau ressenti"/"Parcours" showed
 *     a raw ParcoursTypeCode enum in the family PDF.
 *   - T5B_FINDING_2 (MINOR): "Spécialités" was always empty (hardcoded).
 *
 * Real Postgres, real routes throughout — profil creation, quote
 * creation, publication, family-link issuance, and BOTH PDF surfaces
 * (staff draft PDF and the real public family-facing PDF, fetched by its
 * real signed URL) — never a direct Prisma write, never a mocked PDF
 * route response. Text extracted from the real rendered PDF via
 * pdftotext (poppler) — the same proof pattern T5R already established
 * for line pricing (t5r-quote-publish.test.ts).
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
import { NextRequest } from 'next/server';
import { testPrisma, setupTestDatabase, canConnectToTestDb } from '../setup/test-database';
import { _resetForTest, _setForTest } from '@/lib/config/snapshot';
import { execFileSync } from 'child_process';
import { writeFile, rm } from 'fs/promises';
import path from 'path';
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import { PARCOURS_TYPE_LABELS } from '@/lib/exams/parcours';
import { POST as createQuotePOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/quote/route';
import { POST as publishPOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/publish/route';
import { POST as familyLinkPOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/family-link/route';
import { GET as staffPdfGET } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/pdf/route';
import { GET as publicPdfGET } from '@/app/api/quotes/public/[token]/pdf/route';

const prisma = testPrisma;

async function extractPdfText(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `t5r3-pdf-humanization-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
  }
}

function quoteReq(body: unknown) {
  return new NextRequest('http://localhost/api/assistante/candidat-individuel/profils/x/quote', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}
function publishReq() {
  return new NextRequest('http://localhost/api/assistante/candidat-individuel/quotes/x/publish', { method: 'POST' });
}
function familyLinkReq() {
  return new NextRequest('http://localhost/api/assistante/candidat-individuel/quotes/x/family-link', { method: 'POST' });
}
function staffPdfReq(quoteId: string) {
  return new NextRequest(`http://localhost/api/assistante/candidat-individuel/quotes/${quoteId}/pdf`);
}
function publicPdfReq(token: string) {
  return new NextRequest(`http://localhost/api/quotes/public/${token}/pdf`);
}

const PIPELINE_ACTIVE_ENTRY = { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() };

// Every raw internal identifier that must never reach a family-facing PDF
// (T5R §12/§13's existing invariant, replayed here — non-regression).
const FORBIDDEN_INTERNAL_STRINGS = /teacherCost|structureCost|computeMargin|marginGate|pricingRuleId|moduleId|directionApprovalStatus|MOD_[A-Z_]+|SVC_[A-Z_]+/;

describe('T5R3 — family PDF humanization (real routes, real PDF, real Postgres)', () => {
  let dbAvailable = false;
  let previousNextAuthUrl: string | undefined;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping T5R3 family PDF humanization tests: test database not available');
    previousNextAuthUrl = process.env.NEXTAUTH_URL;
    process.env.NEXTAUTH_URL = 'https://nexus.test';
  }, 10000);

  afterAll(() => {
    if (previousNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousNextAuthUrl;
  });

  beforeEach(async () => {
    if (!dbAvailable) return;
    await setupTestDatabase();
    authResult = { user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' } };
    _resetForTest();
    _setForTest([PIPELINE_ACTIVE_ENTRY]);
    resetCatalogueCacheForTests();
  }, 30000);

  /** R1a-equivalent: PREMIERE, EAF_ECRIT_ORAL + EAM + Pilotage, headcount confirmed (T5A/T5B fixture). */
  async function createPublishedPremiereQuote(): Promise<string> {
    const created = await createProfilCandidat(
      { publicInput: { level: 'PREMIERE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' } },
      'staff-1',
    );
    if (!created.ok) throw new Error(`fixture profil creation failed: ${JSON.stringify(created)}`);
    const res = await createQuotePOST(
      quoteReq({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { francais: 3, 'maths-anticipees': 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    if (res.status !== 201) throw new Error(`fixture quote creation failed: ${res.status} ${JSON.stringify(await res.json())}`);
    const { quote } = await res.json();
    const publishRes = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId: quote.id }) });
    if (publishRes.status !== 200) throw new Error(`fixture publish failed: ${publishRes.status}`);
    return quote.id;
  }

  /** R1b-equivalent: TERMINALE, EDS1 + EDS2 + Philosophie + Grand Oral + Pilotage. */
  async function createPublishedTerminaleQuote(): Promise<string> {
    const created = await createProfilCandidat(
      {
        publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estTitulaireBacDejaObtenu: true },
        staffExtension: {
          dispensesDeclarees: [
            { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'T5R3-R1b-1' },
            { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'T5R3-R1b-2' },
            { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'T5R3-R1b-3' },
          ],
        },
      },
      'staff-1',
    );
    if (!created.ok) throw new Error(`fixture profil creation failed: ${JSON.stringify(created)}`);
    const res = await createQuotePOST(
      quoteReq({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    if (res.status !== 201) throw new Error(`fixture quote creation failed: ${res.status} ${JSON.stringify(await res.json())}`);
    const { quote } = await res.json();
    const publishRes = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId: quote.id }) });
    if (publishRes.status !== 200) throw new Error(`fixture publish failed: ${publishRes.status}`);
    return quote.id;
  }

  async function issueFamilyPdfBuffer(quoteId: string): Promise<Buffer> {
    const linkRes = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId }) });
    if (linkRes.status !== 200) throw new Error(`fixture family-link issuance failed: ${linkRes.status} ${JSON.stringify(await linkRes.json())}`);
    const { familyUrl } = await linkRes.json();
    const token = new URL(familyUrl).pathname.split('/').pop()!;
    const pdfRes = await publicPdfGET(publicPdfReq(token), { params: Promise.resolve({ token }) });
    expect(pdfRes.status).toBe(200);
    return Buffer.from(await pdfRes.arrayBuffer());
  }

  test('R1a (PREMIERE) real family PDF: "Niveau"/"Niveau ressenti" are "Première", "Parcours" is humanized, no raw enum anywhere', async () => {
    if (!dbAvailable) return;
    const quoteId = await createPublishedPremiereQuote();
    const pdfBuffer = await issueFamilyPdfBuffer(quoteId);
    const text = await extractPdfText(pdfBuffer);

    expect(text).toMatch(/NIVEAU\s+Première/);
    expect(text).toMatch(/NIVEAU RESSENTI\s+Première/);
    expect(text).not.toMatch(/P\d{1,2}_[A-Z_]+/); // no raw ParcoursTypeCode string anywhere in the document
    for (const code of Object.keys(PARCOURS_TYPE_LABELS)) expect(text).not.toContain(code);

    // T5B_FINDING_2 non-regression proof: "Spécialités" is the real, human-labeled pair.
    expect(text).toMatch(/SPÉCIALITÉS\s+Mathématiques[\s\S]*Physique-Chimie/);

    expect(text).not.toMatch(FORBIDDEN_INTERNAL_STRINGS);
  });

  test('R1b (TERMINALE) real family PDF: "Niveau"/"Niveau ressenti" are "Terminale", specialités reflect the real profile (MATHEMATIQUES/NSI, not a coincidental commercial-line guess)', async () => {
    if (!dbAvailable) return;
    const quoteId = await createPublishedTerminaleQuote();
    const pdfBuffer = await issueFamilyPdfBuffer(quoteId);
    const text = await extractPdfText(pdfBuffer);

    expect(text).toMatch(/NIVEAU\s+Terminale/);
    expect(text).toMatch(/NIVEAU RESSENTI\s+Terminale/);
    expect(text).not.toMatch(/P\d{1,2}_[A-Z_]+/);
    expect(text).toMatch(/SPÉCIALITÉS\s+Mathématiques[\s\S]*NSI/);
    expect(text).not.toMatch(FORBIDDEN_INTERNAL_STRINGS);

    // Line pricing + total reconciliation (T5R RECETTE_FINDING_4 acquis — non-regression).
    const lines = await prisma.quoteLine.findMany({ where: { quoteId } });
    const quoteRow = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    const sumMonthly = lines.reduce((s, l) => s + l.unitPrice, 0);
    expect(sumMonthly * 10).toBe(quoteRow.grandTotal);
    for (const l of lines) expect(l.unitPrice).toBeGreaterThan(0);
    expect(lines.some((l) => l.subject === 'SVC_EPS_ADMINISTRATIF' || l.subject.includes('EPS_ADMINISTRATIF'))).toBe(false);
  });

  test('the staff draft PDF surface gets the exact same fix — no raw enum, no forbidden internal strings, real specialités', async () => {
    if (!dbAvailable) return;
    const quoteId = await createPublishedTerminaleQuote();
    const pdfRes = await staffPdfGET(staffPdfReq(quoteId), { params: Promise.resolve({ quoteId }) });
    expect(pdfRes.status).toBe(200);
    const text = await extractPdfText(Buffer.from(await pdfRes.arrayBuffer()));

    expect(text).toMatch(/NIVEAU\s+Terminale/);
    expect(text).not.toMatch(/P\d{1,2}_[A-Z_]+/);
    expect(text).toMatch(/SPÉCIALITÉS\s+Mathématiques[\s\S]*NSI/);
    expect(text).not.toMatch(FORBIDDEN_INTERNAL_STRINGS);
  });
});
