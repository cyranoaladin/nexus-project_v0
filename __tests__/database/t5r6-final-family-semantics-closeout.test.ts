/**
 * T5R6 — FINAL FAMILY SEMANTICS CLOSEOUT. Resolves the 2 findings from
 * direction's real inspection of the T5R5 pack V3:
 *   - FINDING_15 (family subject labels): the family HTML page / public
 *     JSON route showed the raw generic catalogue labels ("Enseignement
 *     de spécialité 1/2", "Spécialité de première non poursuivie
 *     (regroupement mono-discipline)") instead of the real declared
 *     specialty names the PDF already humanizes
 *     (lib/quotes/pdf-adapter.server.ts::humanizeLineSubject, now
 *     exported and reused by both — invariant: same Quote ⇒ same
 *     commercial subject identity in PDF and family view).
 *   - FINDING_16 (abandoned-specialty warning wording): the old
 *     "ne prépare aucune épreuve du bac ... hors épreuve notée" wording
 *     was ambiguous — the carte correctly lists this specialty as
 *     "À présenter" (coefficient 8). Replaced (lib/quotes/pricing.ts::
 *     SPECIALITE_ABANDONNEE_WARNING) with wording that keeps the
 *     ponctuelle évaluation's existence explicit, never claims "aucune
 *     épreuve du bac". The carte's own statut/coefficient are untouched.
 *
 * Real Postgres, real routes throughout — mirrors t5r5's own R1/R2
 * fixture shapes exactly, for direct before/after comparability.
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
import { execFileSync } from 'child_process';
import { writeFile, rm } from 'fs/promises';
import path from 'path';
import { testPrisma, setupTestDatabase, canConnectToTestDb, createTestParent, createTestStudent } from '../setup/test-database';
import { _resetForTest, _setForTest } from '@/lib/config/snapshot';
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import { POST as createQuotePOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/quote/route';
import { POST as publishPOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/publish/route';
import { POST as familyLinkPOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/family-link/route';
import { GET as publicJsonGET } from '@/app/api/quotes/public/[token]/route';
import { GET as publicPdfGET } from '@/app/api/quotes/public/[token]/pdf/route';
import { SPECIALITE_ABANDONNEE_WARNING } from '@/lib/quotes/pricing';

const prisma = testPrisma;

async function extractPdfText(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `t5r6-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
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
function publicJsonReq(token: string) {
  return new NextRequest(`http://localhost/api/quotes/public/${token}`);
}
function publicPdfReq(token: string) {
  return new NextRequest(`http://localhost/api/quotes/public/${token}/pdf`);
}

const PIPELINE_ACTIVE_ENTRY = { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() };

describe('T5R6 — final family semantics closeout (real routes, real Postgres)', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping T5R6 tests: test database not available');
  }, 10000);

  beforeEach(async () => {
    if (!dbAvailable) return;
    await setupTestDatabase();
    authResult = { user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' } };
    _resetForTest();
    _setForTest([PIPELINE_ACTIVE_ENTRY]);
    resetCatalogueCacheForTests();
  }, 30000);

  async function createSyntheticFamily(parentFirstName: string, parentLastName: string, studentFirstName: string, studentLastName: string) {
    const contactLead = await prisma.contactLead.create({
      data: { name: `${parentFirstName} ${parentLastName}`, email: `${parentFirstName.toLowerCase()}.${parentLastName.toLowerCase()}.${randomUUID().slice(0, 8)}@nexus-test.com`, phone: '+216 99 000 000' },
    });
    const { parentProfile } = await createTestParent({ firstName: parentFirstName, lastName: parentLastName });
    const { student } = await createTestStudent(parentProfile.id, { user: { firstName: studentFirstName, lastName: studentLastName } });
    return { contactLeadId: contactLead.id, studentId: student.id };
  }

  test('A/B/C: R1 (Mathématiques/NSI) — the real public JSON projection shows the real specialty names, never the generic catalogue label, and matches the PDF exactly', async () => {
    if (!dbAvailable) return;
    const { contactLeadId, studentId } = await createSyntheticFamily('Claire', 'Recette', 'Camille', 'Recette');
    const created = await createProfilCandidat(
      {
        publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estTitulaireBacDejaObtenu: true },
        staffExtension: { dispensesDeclarees: [
          { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'T5R6-R1-1' },
          { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'T5R6-R1-2' },
          { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'T5R6-R1-3' },
        ] },
        contactLeadId,
        studentId,
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
    if (res.status !== 201) throw new Error(`quote creation failed: ${res.status} ${JSON.stringify(await res.json())}`);
    const { quote } = await res.json();

    const publishRes = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId: quote.id }) });
    expect(publishRes.status).toBe(200);
    const linkRes = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId: quote.id }) });
    expect(linkRes.status).toBe(200);
    const { familyUrl } = await linkRes.json();
    const token = new URL(familyUrl).pathname.split('/').pop()!;

    // A — real specialty names, generic label absent (public JSON, the
    // same read path app/devis/[token]/page.tsx uses).
    const jsonRes = await publicJsonGET(publicJsonReq(token), { params: Promise.resolve({ token }) });
    expect(jsonRes.status).toBe(200);
    const body = await jsonRes.json();
    const subjects: string[] = body.quote.lines.map((l: { subject: string }) => l.subject);
    expect(subjects).toContain('Mathématiques');
    expect(subjects).toContain('NSI');
    expect(JSON.stringify(body)).not.toContain('Enseignement de spécialité');

    // C — PDF carries the exact same commercial subject identity.
    const pdfRes = await publicPdfGET(publicPdfReq(token), { params: Promise.resolve({ token }) });
    expect(pdfRes.status).toBe(200);
    const pdfText = await extractPdfText(Buffer.from(await pdfRes.arrayBuffer()));
    expect(pdfText).toMatch(/Mathématiques\s*—\s*4 h\/mois/);
    expect(pdfText).toMatch(/NSI\s*—\s*4 h\/mois/);
    expect(pdfText).not.toMatch(/Enseignement de spécialité/);
    for (const s of subjects) expect(pdfText).toContain(s);
  });

  test('A/B/C/D/E/F: R2 (Mathématiques/Physique-Chimie, spécialité abandonnée NSI) — abandoned-specialty line names NSI, new warning wording present everywhere, old wording gone, carte coefficient/statut unchanged', async () => {
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
        staffExtension: { dispensesDeclarees: [
          { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'T5R6-R2-1' },
          { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'T5R6-R2-2' },
          { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'T5R6-R2-3' },
          { epreuveId: 'grand-oral', statut: 'CONFIRMEE', justificatifRef: 'T5R6-R2-4' },
          { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'T5R6-R2-5' },
          { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'T5R6-R2-6' },
          { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'T5R6-R2-7' },
        ] },
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

    // A/B — the abandoned-specialty line names NSI explicitly, never the
    // raw generic "regroupement mono-discipline" label.
    const jsonRes = await publicJsonGET(publicJsonReq(token), { params: Promise.resolve({ token }) });
    expect(jsonRes.status).toBe(200);
    const body = await jsonRes.json();
    const subjects: string[] = body.quote.lines.map((l: { subject: string }) => l.subject);
    expect(subjects.some((s) => s.startsWith('NSI'))).toBe(true);
    const serializedJson = JSON.stringify(body);
    expect(serializedJson).not.toContain('regroupement mono-discipline');

    // E — new warning wording present in the JSON projection.
    expect(body.quote.warnings).toEqual(expect.arrayContaining([SPECIALITE_ABANDONNEE_WARNING]));
    // D — old wording gone.
    expect(serializedJson).not.toMatch(/ne prépare aucune épreuve du bac/i);

    // C/E — PDF: same subject identity, new wording, old wording gone.
    // F — carte d'examen: spécialité abandonnée still "À présenter",
    // coefficient 8 — untouched by this lot's display-only changes.
    const pdfRes = await publicPdfGET(publicPdfReq(token), { params: Promise.resolve({ token }) });
    expect(pdfRes.status).toBe(200);
    const pdfText = await extractPdfText(Buffer.from(await pdfRes.arrayBuffer()));
    // pdftotext -layout reconstructs the page as visual rows/columns, so
    // this line's own price ("250 TND/mois") interleaves mid-phrase
    // between "non" and "poursuivie" in the flattened extraction order
    // (same reconstruction artifact fixed for in T5R5 §FINDING_14's own
    // test) — checked as separate fragments rather than one contiguous
    // phrase.
    const pdfTextFlat = pdfText.replace(/\s+/g, ' ');
    expect(pdfTextFlat).toContain('NSI');
    expect(pdfTextFlat).toContain('spécialité de Première non');
    expect(pdfTextFlat).toContain('poursuivie');
    expect(pdfTextFlat).not.toMatch(/regroupement mono-discipline/);
    expect(pdfTextFlat).toContain(SPECIALITE_ABANDONNEE_WARNING);
    expect(pdfTextFlat).not.toMatch(/ne prépare aucune épreuve du bac/i);
    // F — carte d'examen table (page 3): the épreuve row for the
    // abandoned specialty (NSI) is still "À présenter", coefficient 8 —
    // checked per physical line (not flattened) so it can't accidentally
    // match a different row's coefficient.
    const carteRow = pdfText.split('\n').find((line) => line.includes('NSI') && line.includes('À présenter'));
    expect(carteRow).toBeDefined();
    expect(carteRow).toMatch(/\b8\b/);

    const quoteRow = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    const snapshotCarte = quoteRow.snapshotCarte as { carte?: { epreuves?: Array<{ matiere?: string; statut?: string; coefficientEffectif?: number }> } };
    const abandonneeEpreuve = snapshotCarte.carte?.epreuves?.find((e) => e.matiere === 'NSI');
    expect(abandonneeEpreuve).toBeDefined();
    expect(abandonneeEpreuve!.statut).toBe('A_PRESENTER');
    expect(abandonneeEpreuve!.coefficientEffectif).toBe(8);
  });
});
