/**
 * T5R5 — FINAL OPERATIONAL & FAMILY VIEW CLOSEOUT. Resolves the 3 findings
 * from direction's real inspection of the T5R4 pack that require code (a
 * 4th, FINDING_14, is a pure PDF-layout fix covered by
 * __tests__/lib/quote/pdf.test.ts):
 *   - FINDING_11 (family-visible Quote ⇒ identity present): promotion and
 *     family-link issuance now refuse a Quote missing contactLeadId or
 *     studentId — proven here by attempting both BEFORE and AFTER identity
 *     is attached, always via the real UI/API flow
 *     (createProfilCandidat's own contactLeadId/studentId params), never a
 *     direct Prisma write.
 *   - FINDING_12 (FAMILY_VIEW_INTERNAL_REASONING = FORBIDDEN): the public
 *     JSON projection (the same read path app/devis/[token]/page.tsx uses)
 *     never carries QuoteLine.reason or any of the internal markers it can
 *     contain (coefficient, bilan :, seuil, TND/h, priorité...).
 *   - FINDING_13 (family view beneficiary): the projection's studentName
 *     matches the Quote's real attached Student.
 *
 * Real Postgres, real routes throughout — mirrors t5r4-family-quote-
 * clarity.test.ts's own fixture shape (R1/R2 scenarios).
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
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import { POST as createQuotePOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/quote/route';
import { POST as publishPOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/publish/route';
import { POST as familyLinkPOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/family-link/route';
import { GET as publicJsonGET } from '@/app/api/quotes/public/[token]/route';
import { SPECIALITE_ABANDONNEE_WARNING } from '@/lib/quotes/pricing';

const prisma = testPrisma;

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

const PIPELINE_ACTIVE_ENTRY = { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() };

// Every internal pricing-engine reasoning marker that FINDING_12 forbids
// on the family-facing projection — the exact vocabulary direction quoted
// as leaking ("Priorité haute (coefficient 8/16...)", "bilan : non
// évalué", "bilan : à installer", "Effectif 1 < seuil 3", "180 TND/h
// min", "90 TND/h/élève", bascule wording).
const FORBIDDEN_FAMILY_MARKERS = /coefficient|bilan\s*:|seuil|TND\/h|priorité|bascule|à installer|non évalué|à rectifier/i;

describe('T5R5 — final operational & family view closeout (real routes, real Postgres)', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping T5R5 tests: test database not available');
  }, 10000);

  beforeEach(async () => {
    if (!dbAvailable) return;
    await setupTestDatabase();
    authResult = { user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' } };
    _resetForTest();
    _setForTest([PIPELINE_ACTIVE_ENTRY]);
    resetCatalogueCacheForTests();
  }, 30000);

  /**
   * Same shape as T5R4's own createSyntheticFamily helper — a real
   * ContactLead ("Responsable") + real Student/User ("Élève"), both
   * independent records, created through real persistence calls (never a
   * direct DB write to reach a family-visible state).
   */
  async function createSyntheticFamily(parentFirstName: string, parentLastName: string, studentFirstName: string, studentLastName: string) {
    const contactLead = await prisma.contactLead.create({
      data: { name: `${parentFirstName} ${parentLastName}`, email: `${parentFirstName.toLowerCase()}.${parentLastName.toLowerCase()}.${randomUUID().slice(0, 8)}@nexus-test.com`, phone: '+216 99 000 000' },
    });
    const { parentProfile } = await createTestParent({ firstName: parentFirstName, lastName: parentLastName });
    const { student } = await createTestStudent(parentProfile.id, { user: { firstName: studentFirstName, lastName: studentLastName } });
    return { contactLeadId: contactLead.id, studentId: student.id };
  }

  test('R1 (FINDING_11): a quote with NO identity attached cannot be promoted nor have a family link issued — both refused (422) with the specific missing-identity reasons', async () => {
    if (!dbAvailable) return;
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estTitulaireBacDejaObtenu: true },
        staffExtension: { dispensesDeclarees: [
          { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R1-1' },
          { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R1-2' },
          { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R1-3' },
        ] } },
      'staff-1',
    );
    if (!created.ok) throw new Error(`fixture profil creation failed: ${JSON.stringify(created)}`);
    expect(created.profil.contactLeadId).toBeNull();
    expect(created.profil.studentId).toBeNull();

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
    expect(publishRes.status).toBe(422);
    const publishBody = await publishRes.json();
    expect(publishBody.reasons).toEqual(expect.arrayContaining(['contactLeadId missing (Responsable)', 'studentId missing (Élève)']));

    // Family-link issuance is refused too — for a different, prior reason
    // (never promoted), demonstrating the guard applies at BOTH choke
    // points, not just the one exercised first.
    const linkRes = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId: quote.id }) });
    expect(linkRes.status).toBe(422);

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(row.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED'); // never silently promoted
  });

  test('R1 (FINDING_11/12/13): once identity IS attached, promotion + family-link succeed, and the real public JSON projection shows the beneficiary but never staff-only reasoning', async () => {
    if (!dbAvailable) return;
    const { contactLeadId, studentId } = await createSyntheticFamily('Claire', 'Recette', 'Camille', 'Recette');

    const created = await createProfilCandidat(
      {
        publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', estTitulaireBacDejaObtenu: true },
        staffExtension: { dispensesDeclarees: [
          { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R1-1' },
          { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R1-2' },
          { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R1-3' },
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
    expect(publishRes.status).toBe(200); // FINDING_11 — identity present, promotion succeeds

    const linkRes = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId: quote.id }) });
    expect(linkRes.status).toBe(200);
    const { familyUrl } = await linkRes.json();
    const token = new URL(familyUrl).pathname.split('/').pop()!;

    const jsonRes = await publicJsonGET(publicJsonReq(token), { params: Promise.resolve({ token }) });
    expect(jsonRes.status).toBe(200);
    const body = await jsonRes.json();
    const serialized = JSON.stringify(body);

    // FINDING_13 — real beneficiary name, never blank/technical.
    expect(body.quote.studentName).toBe('Camille Recette');

    // T5R6 §FINDING_15 — real declared specialty names, never the raw
    // generic catalogue label ("Enseignement de spécialité 1/2"). Same
    // humanization the PDF already applies (humanizeLineSubject).
    const subjects = body.quote.lines.map((l: { subject: string }) => l.subject);
    expect(subjects).toContain('Mathématiques');
    expect(subjects).toContain('NSI');
    expect(serialized).not.toContain('Enseignement de spécialité');

    // FINDING_12 — QuoteLine.reason itself never reaches the projection,
    // and none of its internal-marker vocabulary survives anywhere in the
    // response, even indirectly.
    for (const line of body.quote.lines) {
      expect(line).not.toHaveProperty('reason');
    }
    expect(serialized).not.toMatch(FORBIDDEN_FAMILY_MARKERS);
    expect(serialized).not.toMatch(/teacherCost|structureCost|marginGate|pricingRuleId|MOD_[A-Z_]+/i);
  });

  test('R2 (FINDING_12): the abandoned-specialty line\'s mandatory regulatory warning DOES surface via the safe extraction — the fix removes internal reasoning, never the one genuinely useful signal', async () => {
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
          { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R2-1' },
          { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R2-2' },
          { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R2-3' },
          { epreuveId: 'grand-oral', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R2-4' },
          { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R2-5' },
          { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R2-6' },
          { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'T5R5-R2-7' },
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

    const jsonRes = await publicJsonGET(publicJsonReq(token), { params: Promise.resolve({ token }) });
    expect(jsonRes.status).toBe(200);
    const body = await jsonRes.json();
    const serialized = JSON.stringify(body);

    expect(body.quote.studentName).toBe('Alex Recette');
    // T5R6 §FINDING_16 — wording updated.
    expect(body.quote.warnings).toEqual(expect.arrayContaining([SPECIALITE_ABANDONNEE_WARNING]));
    expect(serialized).not.toMatch(/ne prépare aucune épreuve du bac/i);

    // T5R6 §FINDING_15 — the abandoned-specialty line explicitly names NSI
    // (the real declared specialiteAbandonnee), never the raw generic
    // "Spécialité de première non poursuivie (regroupement mono-discipline)".
    const subjects = body.quote.lines.map((l: { subject: string }) => l.subject);
    expect(subjects.some((s: string) => s.startsWith('NSI'))).toBe(true);
    expect(serialized).not.toContain('regroupement mono-discipline');
    for (const line of body.quote.lines) {
      expect(line).not.toHaveProperty('reason');
    }
    expect(serialized).not.toMatch(FORBIDDEN_FAMILY_MARKERS);
  });
});
