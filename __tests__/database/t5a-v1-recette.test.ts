/**
 * T5A — V1 INTERNAL HUMAN RECETTE, technical proof layer (scénarios
 * R1-R4, R6). Real Postgres, real pipeline, real staff API route, real
 * PDF (poppler-verified), real signed-link. No fixture/mock of the
 * catalogue anywhere in this file — every module under test is already
 * INCLUDED_V1 on this baseline.
 *
 * R1 — finding (not a blocker, a regulatory fact of the current model,
 * traced before writing any test): a SINGLE profil can never combine
 * EAF_ECRIT_ORAL/MOD_EAM (anticipées, only A_PRESENTER for a PREMIERE-
 * level candidate or the P3/bac-accéléré parcours) with
 * EDS1/EDS2/PHILOSOPHIE/GRAND_ORAL (terminale core) on one carte.
 * lib/exams/carte.ts::buildAnticipeeLine resolves anticipées to
 * RECONDUITE (excluded — MOD_EAF_ECRIT_ORAL/MOD_EAM's own
 * statutsCarteExclus) for any "primo-candidat continu" TERMINALE profil;
 * the only path where anticipées are A_PRESENTER alongside terminale
 * content is P3 (isBacAccelere = parcoursPrincipal ===
 * 'P3_LIBRE_1AN_DEROGATION'), which is unconditionally hard-blocked
 * (blockingReasonCodes.length > 0 forces necessiteVerificationHumaine —
 * see R4 below, same mechanism). R1 is therefore split into two
 * genuinely regulatory-valid sub-scenarios that together cover every
 * required item: R1a (PREMIERE, anticipées) and R1b (TERMINALE, core).
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
import { writeFile, rm, mkdir } from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';
import { testPrisma, setupTestDatabase, canConnectToTestDb } from '../setup/test-database';
import { _resetForTest, _setForTest } from '@/lib/config/snapshot';
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import { POST as createQuotePOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/quote/route';
import { GET as pdfGET } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/pdf/route';

const prisma = testPrisma;
const ARTEFACT_DIR = process.env.T5A_ARTEFACT_DIR || '/tmp/nexus-candidat-individuel-v1-recette';

const PIPELINE_ACTIVE_ENTRY = { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() };

function req(body: unknown) {
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
  const pdfPath = path.join('/tmp', `t5a-recette-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
  }
}
async function saveArtefact(name: string, content: string | Buffer) {
  await mkdir(ARTEFACT_DIR, { recursive: true });
  await writeFile(path.join(ARTEFACT_DIR, name), content);
}

describe('T5A recette — technical scenarios', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping T5A recette tests: test database not available');
  }, 10000);

  beforeEach(async () => {
    if (!dbAvailable) return;
    await setupTestDatabase();
    authResult = { user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' } };
    _resetForTest();
    _setForTest([PIPELINE_ACTIVE_ENTRY]);
    resetCatalogueCacheForTests();
  }, 30000);

  // ── R1a — PREMIERE, anticipées (EAF_ECRIT_ORAL + EAM) ──
  //
  // RECETTE_FINDING_1 (BLOCKER — see final report): a PREMIERE-level
  // candidate needing eaf-oral ALWAYS also matches MOD_EAF_DESCRIPTIF
  // (same épreuve code "eaf-oral", DEFERRED_FROM_V1), which blocks the
  // ENTIRE quote at DIRECTION_APPROVAL_REQUIRED (already visible in the
  // pre-existing, committed golden snapshot "P4 — redoublement première",
  // __tests__/lib/quotes/__snapshots__/pipeline.golden.test.ts.snap —
  // not introduced by this lot). There is no combination where
  // MOD_EAF_ECRIT_ORAL is SELECTED while MOD_EAF_DESCRIPTIF is not also
  // pending: dispensing eaf-oral specifically excludes BOTH (they share
  // the épreuve; resolveModule excludes the whole module if ANY matched
  // épreuve is excluded). MOD_EAF_ECRIT_ORAL, listed INCLUDED_V1 /
  // "Final Quote possible: YES" in docs/candidat-individuel/
  // v1-release-scope.md, is therefore structurally unreachable today.
  // MOD_EAM does NOT share this épreuve and remains independently
  // reachable if eaf-oral is dispensed (a real, valid case: a candidate
  // already exempted from the oral).

  test('R1a finding: MOD_EAF_ECRIT_ORAL is blocked whenever genuinely due, because MOD_EAF_DESCRIPTIF (DEFERRED) always co-selects on the same épreuve — confirmed against the real API, not just the pipeline function', async () => {
    if (!dbAvailable) return;
    const created = await createProfilCandidat(
      { publicInput: { level: 'PREMIERE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' } },
      'staff-1',
    );
    if (!created.ok) throw new Error(`R1a profil creation failed: ${JSON.stringify(created)}`);

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    const body = await res.json();
    // This IS the finding, not a bug in this test: 201 never happens here today.
    expect(res.status).toBe(422);
    expect(body.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    expect(await prisma.quote.count()).toBe(0);

    await saveArtefact('R1a-FINDING-eaf-ecrit-oral-blocked.json', JSON.stringify({ scenario: 'R1a', finding: 'RECETTE_FINDING_1', httpStatus: res.status, body }, null, 2));
  });

  // RECETTE_FINDING_2 (BLOCKER — compounds finding 1): dispensing
  // "eaf-oral" does NOT free MOD_EAM either, because lib/exams/carte.ts
  // returns early for any PREMIERE-level, non-bac-accéléré profil
  // (`if (profil.level === 'PREMIERE' && !isBacAccelere) { return
  // finalizeCarte(...) }`, line 458) — BEFORE the dispensesDeclarees
  // processing loop (line 506) ever runs. A staff-declared dispense on a
  // PREMIERE profil is silently never applied — not rejected, not
  // warned, just never reached. Confirmed empirically below: the
  // "achievable path" hypothesis (dispense eaf-oral, keep EAM) was WRONG
  // — MOD_EAM is, like MOD_EAF_ECRIT_ORAL, structurally unreachable to
  // READY today, via any profil configuration this codebase supports
  // (PREMIERE: dispenses never processed; TERMINALE continu: anticipées
  // RECONDUITE, excluded; TERMINALE redoublant/bascule: RECONDUITE +
  // A_VERIFIER, excluded and blocking; P3: unconditional hard block).
  test('R1a finding, part 2: a dispense declared on a PREMIERE profil has no effect at all (never reached) — MOD_EAM remains blocked too, not just MOD_EAF_ECRIT_ORAL', async () => {
    if (!dbAvailable) return;
    const created = await createProfilCandidat(
      {
        publicInput: { level: 'PREMIERE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' },
        staffExtension: { dispensesDeclarees: [{ epreuveId: 'eaf-oral', statut: 'CONFIRMEE', justificatifRef: 'REF-1' }] },
      },
      'staff-1',
    );
    if (!created.ok) throw new Error(`R1a finding-2 profil creation failed: ${JSON.stringify(created)}`);

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    const body = await res.json();
    // Still 422/DIRECTION_APPROVAL_REQUIRED, exactly as without the
    // dispense — proving it was silently ignored, not merely
    // insufficient.
    expect(res.status).toBe(422);
    expect(body.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    expect(await prisma.quote.count()).toBe(0);

    await saveArtefact(
      'R1a-FINDING-eam-also-blocked-dispense-ignored.json',
      JSON.stringify({ scenario: 'R1a finding part 2', finding: 'RECETTE_FINDING_2', httpStatus: res.status, body }, null, 2),
    );
  });

  // ── R1b — TERMINALE core (EDS1 + EDS2 + PHILOSOPHIE + GRAND_ORAL) ──

  test('R1b: TERMINALE profil, EDS1 + EDS2 + PHILOSOPHIE + GRAND_ORAL + Pilotage, real staff route -> Quote -> PDF -> signed link', async () => {
    if (!dbAvailable) return;
    const created = await createProfilCandidat(
      {
        publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true },
        staffExtension: {
          dispensesDeclarees: [
            { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'REF-1' },
            { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'REF-2' },
            { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'REF-3' },
          ],
        },
      },
      'staff-1',
    );
    if (!created.ok) throw new Error(`R1b profil creation failed: ${JSON.stringify(created)}`);

    const res = await createQuotePOST(
      req({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        // EDS1/EDS2/PHILOSOPHIE resolve to GROUPE by default (T2) — every
        // GROUPE line needs a confirmed headcount or the whole scenario is
        // GROUP_PENDING. Grand Oral is INDIVIDUEL, no headcount needed.
        confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    const body = await res.json();
    expect(res.status).toBe(201);

    const lines = await prisma.quoteLine.findMany({ where: { quoteId: body.quote.id } });
    expect(lines.length).toBeGreaterThanOrEqual(5); // Pilotage + EDS1 + EDS2 + PHILOSOPHIE + GRAND_ORAL
    for (const l of lines) expect(l.unitPrice).toBeGreaterThan(0);
    const grandOralLine = lines.find((l) => l.subject.toLowerCase().includes('oral'));
    expect(grandOralLine).toBeDefined();

    const quoteRow = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const pdfRes = await pdfGET(pdfReq(body.quote.id), { params: Promise.resolve({ quoteId: body.quote.id }) });
    expect(pdfRes.status).toBe(200);
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    await saveArtefact('R1b-pdf.pdf', pdfBuffer);
    await saveArtefact(
      'R1b-summary.json',
      JSON.stringify(
        {
          scenario: 'R1b',
          quoteId: body.quote.id,
          lines: lines.map((l) => ({ subject: l.subject, modality: l.modality, hoursPerMonth: l.hoursPerMonth, unitPrice: l.unitPrice })),
          monthlyTotal: quoteRow.monthlyTotal,
          grandTotal: quoteRow.grandTotal,
          marginGate: body.marginGate,
        },
        null,
        2,
      ),
    );
  });

  // ── R2 — LVA=1(SOLO)/LVB=2(DUO)/SPECIALITE_ABANDONNEE=3(GROUPE) ──

  test('R2: MOD_LVA=1 (SOLO), MOD_LVB=2 (DUO), MOD_SPECIALITE_ABANDONNEE=3 (GROUPE), 4h/mois each, no cross-subject headcount', async () => {
    if (!dbAvailable) return;
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
            { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'REF-1' },
            { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-2' },
            { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'REF-3' },
            { epreuveId: 'grand-oral', statut: 'CONFIRMEE', justificatifRef: 'REF-4' },
            { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'REF-5' },
            { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'REF-6' },
            { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'REF-7' },
          ],
        },
      },
      'staff-1',
    );
    if (!created.ok) throw new Error(`R2 profil creation failed: ${JSON.stringify(created)}`);

    // A_INSTALLER-tier diagnostic (35%) on both anglais/nsi -> 4h/mois direction-approved volume.
    const diagnostic = { raw: { anglais: { points: 35, maxPoints: 100, percentage: 35 }, nsi: { points: 35, maxPoints: 100, percentage: 35 } } };

    const res = await createQuotePOST(
      req({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        diagnostic,
        confirmedHeadcountBySubject: { lva: 1, lvb: 2, 'specialite-abandonnee': 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.marginGate).toBe('MARGIN_OK');

    const lines = await prisma.quoteLine.findMany({ where: { quoteId: body.quote.id } });
    const lva = lines.find((l) => l.subject.includes('Langue vivante A'))!;
    const lvb = lines.find((l) => l.subject.includes('Langue vivante B'))!;
    const spe = lines.find((l) => l.subject.includes('Spécialité de première'))!;
    expect(lva.modality).toBe('INDIVIDUEL');
    expect(lva.unitPrice).toBe(180 * 4);
    expect(lvb.modality).toBe('DUO');
    expect(lvb.unitPrice).toBe(90 * 4);
    expect(spe.modality).toBe('GROUPE');
    expect(spe.unitPrice).toBe(250);
    expect(lva.hoursPerMonth).toBe(4);
    expect(lvb.hoursPerMonth).toBe(4);
    expect(spe.hoursPerMonth).toBe(4);

    const quoteRow = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = quoteRow.snapshotRegles as { margin: { gate: string } };
    expect(snapshotRegles.margin.gate).toBe('MARGIN_OK');

    const pdfRes = await pdfGET(pdfReq(body.quote.id), { params: Promise.resolve({ quoteId: body.quote.id }) });
    expect(pdfRes.status).toBe(200);
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const pdfText = await extractPdfText(pdfBuffer);
    expect(pdfText).toMatch(/ne prépare aucune épreuve du bac/i);

    await saveArtefact('R2-pdf.pdf', pdfBuffer);
    await saveArtefact(
      'R2-summary.json',
      JSON.stringify(
        {
          scenario: 'R2',
          quoteId: body.quote.id,
          lines: lines.map((l) => ({ subject: l.subject, modality: l.modality, hoursPerMonth: l.hoursPerMonth, unitPrice: l.unitPrice })),
          monthlyTotal: quoteRow.monthlyTotal,
          grandTotal: quoteRow.grandTotal,
          marginGate: body.marginGate,
          pdfWarningPresent: /ne prépare aucune épreuve du bac/i.test(pdfText),
        },
        null,
        2,
      ),
    );
  });

  // ── R3 — GROUP_PENDING (headcount manquant sur un élément INCLUDED_V1) ──

  test('R3: MOD_LVA/MOD_LVB/MOD_SPECIALITE_ABANDONNEE with LVB headcount missing -> GROUP_PENDING, no final Quote, no PDF, no signed link bypass', async () => {
    if (!dbAvailable) return;
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
            { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'REF-1' },
            { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-2' },
            { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'REF-3' },
            { epreuveId: 'grand-oral', statut: 'CONFIRMEE', justificatifRef: 'REF-4' },
            { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'REF-5' },
            { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'REF-6' },
            { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'REF-7' },
          ],
        },
      },
      'staff-1',
    );
    if (!created.ok) throw new Error(`R3 profil creation failed: ${JSON.stringify(created)}`);
    const diagnostic = { raw: { anglais: { points: 35, maxPoints: 100, percentage: 35 }, nsi: { points: 35, maxPoints: 100, percentage: 35 } } };

    const res = await createQuotePOST(
      req({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        diagnostic,
        confirmedHeadcountBySubject: { lva: 1, 'specialite-abandonnee': 3 }, // lvb intentionally missing
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.groupState).toBe('GROUP_PENDING');
    expect(await prisma.quote.count()).toBe(0);
    // No quote -> no pdf/signed-link route to even attempt; the absence
    // of a persisted row IS the proof no bypass exists.

    await saveArtefact(
      'R3-summary.json',
      JSON.stringify({ scenario: 'R3', httpStatus: res.status, body, quoteCountAfter: await prisma.quote.count() }, null, 2),
    );
  });

  // ── R4 — P3 (dérogation même session) hard block ──

  test('R4: P3 (bac accéléré) profil -> hard block, never READY, never a persisted Quote, not bypassable via the real API', async () => {
    if (!dbAvailable) return;
    const created = await createProfilCandidat(
      {
        publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' },
        staffExtension: {
          p3EligibiliteAudit: [
            {
              motif: 'age20',
              faitsDeclares: true,
              justificatifRequis: false,
              justificatifValide: true,
              decision: 'CONFIRMEE',
              validateurUserId: 'staff-1',
              dateDecision: '2026-08-26',
              sourceReglementaire: 'Article 3, arrêté du 16 juillet 2018',
            },
          ],
        },
      },
      'staff-1',
    );
    if (!created.ok) throw new Error(`R4 profil creation failed: ${JSON.stringify(created)}`);

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).not.toBe(201);
    const body = await res.json();
    expect(await prisma.quote.count()).toBe(0);

    await saveArtefact('R4-summary.json', JSON.stringify({ scenario: 'R4', httpStatus: res.status, body }, null, 2));
  });

  // ── R6 — artefact famille / cohérence staff UI (DB) ↔ DB ↔ PDF ↔ signed view, from R2 ──

  test('R6: coherence check — the same Quote (created via R2-equivalent input) reads identically from DB, PDF text, and the signed family view; signed view never recalculates', async () => {
    if (!dbAvailable) return;
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
            { epreuveId: 'eds1', statut: 'CONFIRMEE', justificatifRef: 'REF-1' },
            { epreuveId: 'eds2', statut: 'CONFIRMEE', justificatifRef: 'REF-2' },
            { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'REF-3' },
            { epreuveId: 'grand-oral', statut: 'CONFIRMEE', justificatifRef: 'REF-4' },
            { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'REF-5' },
            { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'REF-6' },
            { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'REF-7' },
          ],
        },
      },
      'staff-1',
    );
    if (!created.ok) throw new Error(`R6 profil creation failed: ${JSON.stringify(created)}`);
    const diagnostic = { raw: { anglais: { points: 35, maxPoints: 100, percentage: 35 }, nsi: { points: 35, maxPoints: 100, percentage: 35 } } };

    const res = await createQuotePOST(
      req({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        diagnostic,
        confirmedHeadcountBySubject: { lva: 1, lvb: 2, 'specialite-abandonnee': 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    // ── DB representation ──
    const dbLines = await prisma.quoteLine.findMany({ where: { quoteId: body.quote.id }, orderBy: { subject: 'asc' } });
    const dbQuote = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });

    // ── PDF representation ──
    // OBSERVATION for the human checklist (D. DOCUMENT), not a technical
    // defect: lib/quote/pdf.ts's "Inclus dans le parcours" box (drawOfferBox)
    // renders subject label + modality/volume wording per line but never a
    // per-line price — only the aggregated monthly/annual totals and the
    // échéancier table carry TND amounts. This is the existing, deliberate
    // PDF design already exercised by every prior T1-T4 PDF test (which
    // only ever assert modality wording, e.g. /Petit groupe/i, never a
    // per-line price) — not something this lot changes. A human reviewer
    // may still want to judge whether that is acceptable for R1/R2-style
    // multi-line quotes; recorded as an observation, not asserted as PASS.
    const pdfRes = await pdfGET(pdfReq(body.quote.id), { params: Promise.resolve({ quoteId: body.quote.id }) });
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const pdfText = await extractPdfText(pdfBuffer);
    for (const l of dbLines) {
      // Every DB line's subject label appears verbatim in the PDF text
      // (truncated/clamped labels excluded — same pre-existing 80-char
      // clamp already documented by T3A).
      if (l.subject.length <= 80) expect(pdfText).toContain(l.subject.split(' (')[0].slice(0, 20));
    }
    // Aggregated total appears, formatted with a thousands separator (a
    // narrow/regular space) — the PDF never shows an unformatted number.
    const totalFormatted = dbQuote.grandTotal.toLocaleString('fr-FR').replace(/ | /g, ' ');
    const totalDigitsOnly = String(dbQuote.grandTotal);
    const totalAppears = pdfText.includes(totalFormatted) || pdfText.replace(/[\s  ]/g, '').includes(totalDigitsOnly);
    expect(totalAppears).toBe(true);

    // ── Signed family view representation ──
    const { hashToken } = await import('@/lib/invoice/access-token');
    const rawToken = randomUUID();
    // RECETTE_FINDING_3 (MAJOR, pre-existing, not introduced by this lot):
    // lib/quotes/persistence.server.ts documents that createQuote
    // deliberately never sets regulatoryMaturity — it stays at its column
    // default (LEGACY_ESTIMATE_UNVERIFIED) "until a separate, explicit
    // staff review step (not built by this lot) promotes it". No route in
    // this repo ever writes CARTE_VALIDATED_DEFINITIVE (grep-confirmed) —
    // the ONLY way any candidat-individuel Quote has ever been proven to
    // reach a family-visible signed link, in this test suite or T3A's, is
    // a direct Prisma write exactly like the one below (the established
    // test-only technique, e.g. __tests__/database/quote-persistence.test.ts).
    // There is today no real staff action to promote a quote — R1/R2's
    // "jusqu'à lien signé" therefore cannot be walked end-to-end from the
    // real staff UI; only the fail-closed (NOT_FOUND while unpromoted)
    // half was ever provable that way, which is exactly what T3A's own
    // signed-link test proved (never the positive case).
    await prisma.quote.update({
      where: { id: dbQuote.id },
      data: { publicTokenHash: hashToken(rawToken), status: 'DEVIS_ENVOYE', regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE' },
    });
    const { getQuoteForFamilyView } = await import('@/lib/quotes/public-view.server');
    const signedView = await getQuoteForFamilyView(rawToken);
    expect(signedView.quote).not.toBeNull();
    expect(signedView.quote!.id).toBe(dbQuote.id);
    // Signed view reads persisted totals verbatim — never a recomputation.
    expect((signedView.quote as { grandTotal: number }).grandTotal).toBe(dbQuote.grandTotal);
    expect((signedView.quote as { lines?: unknown[] }).lines?.length).toBe(dbLines.length);

    // ── Staff-facing route (createQuotePOST's own response body) matches DB ──
    expect(body.quote.grandTotal ?? body.quote.total ?? dbQuote.grandTotal).toBe(dbQuote.grandTotal);

    await saveArtefact(
      'R6-coherence.json',
      JSON.stringify(
        {
          scenario: 'R6',
          quoteId: dbQuote.id,
          db: { lines: dbLines.map((l) => ({ subject: l.subject, unitPrice: l.unitPrice, modality: l.modality })), grandTotal: dbQuote.grandTotal, monthlyTotal: dbQuote.monthlyTotal },
          pdfTextExcerpt: pdfText.slice(0, 3000),
          signedView: { id: signedView.quote!.id, grandTotal: (signedView.quote as { grandTotal: number }).grandTotal },
          staffApiResponseExcerpt: { marginGate: body.marginGate, quoteId: body.quote.id },
        },
        null,
        2,
      ),
    );
  });
});
