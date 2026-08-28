/**
 * T5R4 — FINAL FAMILY QUOTE CLARITY CLOSEOUT. Resolves 4 findings raised
 * by direction's real PDF inspection after T5R3
 * (docs/candidat-individuel/t5b-human-recette/t5b-findings.md would be
 * the natural home, but this lot's own commit carries the closeout —
 * see FINDING_6-10 in the T5R4 mission directive):
 *   - FINDING_6 (FAMILY_PDF_PRICE_UNIT): line amounts now show "/mois".
 *   - FINDING_7 (FAMILY_PDF_IDENTITY): IDENTITY_PIPELINE =
 *     WORKS_WHEN_PROVIDED — proven here with a real, non-empty synthetic
 *     ContactLead + Student, never a code fix (none was needed).
 *   - FINDING_8 (FAMILY_PDF_INTERNAL_SOURCE): the exam-card SOURCE
 *     column (lib/exams-shaped strings) is gone.
 *   - FINDING_9 (FAMILY_PDF_HUMAN_SUBJECT_LABELS): MOD_EDS1/MOD_EDS2/
 *     MOD_SPECIALITE_ABANDONNEE's generic catalogue labels are replaced
 *     by the real declared specialties in the family PDF.
 *
 * Real Postgres, real routes throughout — profil/lead/student creation,
 * quote creation, publication, family-link issuance, and the real
 * public family-facing PDF fetched by its real signed URL. Text
 * extracted from the real rendered PDF via pdftotext (poppler).
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
import { testPrisma, setupTestDatabase, canConnectToTestDb, createTestParent, createTestStudent } from '../setup/test-database';
import { _resetForTest, _setForTest } from '@/lib/config/snapshot';
import { execFileSync } from 'child_process';
import { writeFile, rm } from 'fs/promises';
import path from 'path';
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import { POST as createQuotePOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/quote/route';
import { POST as publishPOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/publish/route';
import { POST as familyLinkPOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/family-link/route';
import { GET as publicPdfGET } from '@/app/api/quotes/public/[token]/pdf/route';

const prisma = testPrisma;

async function extractPdfText(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `t5r4-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
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
function publicPdfReq(token: string) {
  return new NextRequest(`http://localhost/api/quotes/public/${token}/pdf`);
}

const PIPELINE_ACTIVE_ENTRY = { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() };

const FORBIDDEN_INTERNAL_STRINGS = /teacherCost|structureCost|computeMargin|marginGate|pricingRuleId|moduleId|directionApprovalStatus|MOD_[A-Z_]+|SVC_[A-Z_]+/;

describe('T5R4 — final family quote clarity (real routes, real PDF, real Postgres)', () => {
  let dbAvailable = false;
  let previousNextAuthUrl: string | undefined;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping T5R4 tests: test database not available');
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

  /**
   * Real ContactLead ("Responsable" on the PDF) + real Student/User
   * ("Élève" on the PDF) — the exact model shape a genuine family-visible
   * quote is expected to carry. Both are independent records in this data
   * model (ContactLead = CRM lead identity, Student/ParentProfile = an
   * onboarded family account) — using matching synthetic names here for
   * clarity, not because the model requires it.
   */
  async function createSyntheticFamily(parentFirstName: string, parentLastName: string, studentFirstName: string, studentLastName: string) {
    const contactLead = await prisma.contactLead.create({
      data: { name: `${parentFirstName} ${parentLastName}`, email: `${parentFirstName.toLowerCase()}.${parentLastName.toLowerCase()}.${randomUUID().slice(0, 8)}@nexus-test.com`, phone: '+216 99 000 000' },
    });
    const { parentProfile } = await createTestParent({ firstName: parentFirstName, lastName: parentLastName });
    const { student } = await createTestStudent(parentProfile.id, { user: { firstName: studentFirstName, lastName: studentLastName } });
    return { contactLeadId: contactLead.id, studentId: student.id };
  }

  test('R1 final (Claire Recette / Camille Recette, Mathématiques/NSI): real family PDF shows real identity, humanized subjects, price units, no source leak', async () => {
    if (!dbAvailable) return;
    const { contactLeadId, studentId } = await createSyntheticFamily('Claire', 'Recette', 'Camille', 'Recette');

    const created = await createProfilCandidat(
      {
        publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estTitulaireBacDejaObtenu: true },
        staffExtension: {
          dispensesDeclarees: [
            { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'T5R4-R1-1' },
            { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'T5R4-R1-2' },
            { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'T5R4-R1-3' },
          ],
        },
        contactLeadId,
        studentId,
      },
      'staff-1',
    );
    if (!created.ok) throw new Error(`fixture profil creation failed: ${JSON.stringify(created)}`);
    expect(created.profil.contactLeadId).toBe(contactLeadId);
    expect(created.profil.studentId).toBe(studentId);

    const res = await createQuotePOST(
      quoteReq({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    if (res.status !== 201) throw new Error(`quote creation failed: ${res.status} ${JSON.stringify(await res.json())}`);
    const { quote } = await res.json();

    // The Quote row itself must have picked up the identity — proves the
    // propagation, not just a lucky PDF-adapter coincidence.
    const quoteRow = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(quoteRow.contactLeadId).toBe(contactLeadId);
    expect(quoteRow.studentId).toBe(studentId);

    const publishRes = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId: quote.id }) });
    expect(publishRes.status).toBe(200);
    const linkRes = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId: quote.id }) });
    expect(linkRes.status).toBe(200);
    const { familyUrl } = await linkRes.json();
    const token = new URL(familyUrl).pathname.split('/').pop()!;

    const pdfRes = await publicPdfGET(publicPdfReq(token), { params: Promise.resolve({ token }) });
    expect(pdfRes.status).toBe(200);
    const text = await extractPdfText(Buffer.from(await pdfRes.arrayBuffer()));

    // FINDING_7 — real identity, never "Non renseigné" for Élève/Responsable.
    expect(text).toMatch(/ÉLÈVE\s+Camille Recette/);
    expect(text).toMatch(/RESPONSABLE\s+Claire Recette/);

    // FINDING_9 — real specialty names, never the generic catalogue label.
    expect(text).toMatch(/Mathématiques\s*—\s*4 h\/mois/);
    expect(text).toMatch(/NSI\s*—\s*4 h\/mois/);
    expect(text).not.toMatch(/Enseignement de spécialité/);

    // FINDING_6 — explicit /mois unit on every line amount.
    expect(text).toMatch(/250 TND\/mois/);
    expect(text).toContain('Tarifs mensuels de référence');

    // FINDING_8 — no internal source leak.
    expect(text).not.toContain('SOURCE');
    expect(text).not.toMatch(/lib\/exams/);

    // Non-regression — T5R3 acquis (level/parcours humanized), never a raw enum.
    expect(text).toMatch(/NIVEAU\s+Terminale/);
    expect(text).not.toMatch(/\bP\d{1,2}_[A-Z_]+\b/);

    // Non-regression — total/échéancier untouched, no internal cost/margin leak.
    const lines = await prisma.quoteLine.findMany({ where: { quoteId: quote.id } });
    const sumMonthly = lines.reduce((s, l) => s + l.unitPrice, 0);
    expect(sumMonthly * 10).toBe(quoteRow.grandTotal);
    expect(text).not.toMatch(FORBIDDEN_INTERNAL_STRINGS);
  });

  test('R2 final (Marc Recette / Alex Recette, LVA=1/LVB=2/spécialité abandonnée=3): real identity, humanized abandoned-specialty line with volume, no source leak', async () => {
    if (!dbAvailable) return;
    const { contactLeadId, studentId } = await createSyntheticFamily('Marc', 'Recette', 'Alex', 'Recette');

    const created = await createProfilCandidat(
      {
        publicInput: {
          level: 'TERMINALE',
          examSession: 2027,
          modalite: 'A',
          specialite1: 'MATHEMATIQUES',
          specialite2: 'PHYSIQUE_CHIMIE',
          specialiteAbandonnee: 'NSI',
          changementSpecialite: true,
          langueA: 'ANGLAIS',
          langueB: 'ANGLAIS',
          estTitulaireBacDejaObtenu: true,
        },
        staffExtension: {
          dispensesDeclarees: [
            { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'T5R4-R2-1' },
            { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'T5R4-R2-2' },
            { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'T5R4-R2-3' },
            { epreuveId: 'grand-oral', statut: 'CONFIRMEE', justificatifRef: 'T5R4-R2-4' },
            { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'T5R4-R2-5' },
            { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'T5R4-R2-6' },
            { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'T5R4-R2-7' },
          ],
        },
        contactLeadId,
        studentId,
      },
      'staff-1',
    );
    if (!created.ok) throw new Error(`fixture profil creation failed: ${JSON.stringify(created)}`);

    const diagnostic = { raw: { anglais: { points: 35, maxPoints: 100, percentage: 35 }, nsi: { points: 35, maxPoints: 100, percentage: 35 } } };
    const res = await createQuotePOST(
      quoteReq({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        diagnostic,
        confirmedHeadcountBySubject: { lva: 1, lvb: 2, 'specialite-abandonnee': 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    if (res.status !== 201) throw new Error(`quote creation failed: ${res.status} ${JSON.stringify(await res.json())}`);
    const { quote } = await res.json();

    const publishRes = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId: quote.id }) });
    expect(publishRes.status).toBe(200);
    const linkRes = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId: quote.id }) });
    expect(linkRes.status).toBe(200);
    const { familyUrl } = await linkRes.json();
    const token = new URL(familyUrl).pathname.split('/').pop()!;

    const pdfRes = await publicPdfGET(publicPdfReq(token), { params: Promise.resolve({ token }) });
    expect(pdfRes.status).toBe(200);
    const text = await extractPdfText(Buffer.from(await pdfRes.arrayBuffer()));

    // FINDING_7
    expect(text).toMatch(/ÉLÈVE\s+Alex Recette/);
    expect(text).toMatch(/RESPONSABLE\s+Marc Recette/);

    // FINDING_9 — abandoned specialty: real subject + volume, no truncated "mono-di...".
    // (pdftotext -layout wraps this cell across two visual lines — checked
    // as two separate substrings rather than one contiguous regex.)
    expect(text).toMatch(/NSI\s*—\s*spécialité de Première non/);
    expect(text).toContain('poursuivie');
    expect(text).toContain('4 h/mois');
    expect(text).not.toMatch(/mono-discipline/);
    expect(text).not.toMatch(/mono-di\.\.\./);

    // The mandatory regulatory warning must survive unchanged.
    expect(text).toMatch(/ne prépare aucune épreuve du bac/i);

    // FINDING_6
    expect(text).toMatch(/250 TND\/mois/);

    // FINDING_8
    expect(text).not.toContain('SOURCE');
    expect(text).not.toMatch(/lib\/exams/);

    // Non-regression
    expect(text).toMatch(/NIVEAU\s+Terminale/);
    expect(text).not.toMatch(/\bP\d{1,2}_[A-Z_]+\b/);
    expect(text).not.toMatch(FORBIDDEN_INTERNAL_STRINGS);

    const quoteRow = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    const lines = await prisma.quoteLine.findMany({ where: { quoteId: quote.id } });
    const sumMonthly = lines.reduce((s, l) => s + l.unitPrice, 0);
    expect(sumMonthly * 10).toBe(quoteRow.grandTotal);
  });
});
