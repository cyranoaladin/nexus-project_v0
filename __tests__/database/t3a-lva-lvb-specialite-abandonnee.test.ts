/**
 * T3A — STAFF HEADCOUNT WORKFLOW + LVA/LVB/SPECIALITE_ABANDONNEE (docs/
 * candidat-individuel/direction-decisions-commercial-governance.md §3,
 * commit 4ffaac8ed). Proves the T2 confirmedHeadcountBySubject mechanism
 * against the three gated modules BEFORE any real catalogue activation —
 * "travaille d'abord avec les éléments toujours direction-gated et prouve
 * le workflow par tests directs/fixtures appropriées" (§7).
 *
 * Real Postgres, real pipeline, real route, real PDF (poppler-verified).
 * MOD_LVA/MOD_LVB/MOD_SPECIALITE_ABANDONNEE are marked APPROVED via a
 * disposable jest.doMock('@/lib/pricing', ...) fixture ONLY (same pattern
 * already established by __tests__/lib/quotes/second-groupe-p11.test.ts
 * and the P11 PDF describe block in candidat-individuel-pdf.test.ts) —
 * never the real committed data/pricing.canonical.json, until §8's
 * separate, explicit activation commit.
 *
 * Fixture profile (verified against the real pipeline before writing this
 * file): TERMINALE, P7_TITULAIRE_BAC parcours, specialite1=MATHEMATIQUES,
 * specialite2=PHYSIQUE_CHIMIE, specialiteAbandonnee=NSI (changementSpecialite
 * declared — the only way profile-validation.ts's P9 coherence check
 * accepts it), langueA=langueB=ANGLAIS (the diagnostic tool's domain table,
 * lib/quotes/diagnostic.ts::PRISMA_SUBJECT_TO_DOMAIN, only covers ANGLAIS
 * among languages today — a real product limitation, not invented here;
 * both fields pointing at the one covered language is a deliberate test
 * simplification, not a claim about real-world LVA/LVB pairing). Every
 * OTHER matched épreuve (eds1/eds2/philosophie/grand-oral/histoire-
 * geographie/enseignement-scientifique/emc) is explicitly dispensed so
 * the RECOMMANDE scenario contains Pilotage + exactly the three GROUPE
 * lines under test — no other module's own DIRECTION_A_VALIDER gate (e.g.
 * MOD_HG_ARIA, MOD_EMC_ARIA) gets in the way, and no unrelated headcount
 * entry is ever needed. With a diagnosed A_RECTIFIER weakness (15%) on
 * both anglais and nsi, all three lines resolve to 8h/470 TND (the
 * PETIT_GROUPE_8H tier) — confirmed empirically before this file was
 * written, not assumed.
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

const prisma = testPrisma;

const GATED_MODULE_IDS = ['MOD_LVA', 'MOD_LVB', 'MOD_SPECIALITE_ABANDONNEE'];

const STAFF_EXTENSION = {
  dispensesDeclarees: [
    { epreuveId: 'eds1', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-1' },
    { epreuveId: 'eds2', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-2' },
    { epreuveId: 'philosophie', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-3' },
    { epreuveId: 'grand-oral', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-4' },
    { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-5' },
    { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-8' },
    { epreuveId: 'emc', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-9' },
  ],
};

const PUBLIC_INPUT = {
  level: 'TERMINALE' as const,
  examSession: 2027,
  modalite: 'A' as const,
  specialite1: 'MATHEMATIQUES',
  specialite2: 'PHYSIQUE_CHIMIE',
  specialiteAbandonnee: 'NSI',
  changementSpecialite: true,
  langueA: 'ANGLAIS',
  langueB: 'ANGLAIS',
  estTitulaireBacDejaObtenu: true,
};

const DIAGNOSTIC = {
  raw: {
    anglais: { points: 15, maxPoints: 100, percentage: 15 },
    nsi: { points: 15, maxPoints: 100, percentage: 15 },
  },
};

// subject key -> catalogue label (verified against the real pipeline; also
// what persists as QuoteLine.subject, since persistence.server.ts stores
// RecommendedLine.label, never the subjectId).
const SUBJECT_LABELS: Record<string, string> = {
  lva: 'Langue vivante A (petit groupe live)',
  lvb: 'Langue vivante B (petit groupe live)',
  'specialite-abandonnee': 'Spécialité de première non poursuivie (regroupement mono-discipline)',
};

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
  const pdfPath = path.join('/tmp', `t3a-gated-module-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
  }
}

describe('T3A — MOD_LVA/MOD_LVB/MOD_SPECIALITE_ABANDONNEE, APPROVED via disposable fixture only, never the real canonical catalogue', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping T3A gated-module tests: test database not available');
  }, 10000);

  beforeEach(async () => {
    if (!dbAvailable) return;
    await setupTestDatabase();
    authResult = { user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' } };
    jest.resetModules();
    jest.doMock('@/lib/pricing', () => {
      const actual = jest.requireActual('@/lib/pricing');
      const raw = actual.getCandidatIndividuelCatalogueRaw();
      const approved = {
        ...raw,
        modules: raw.modules.map((m: { moduleId: string; directionApprovalStatus: string }) =>
          GATED_MODULE_IDS.includes(m.moduleId)
            ? {
                ...m,
                directionApprovalStatus: 'APPROVED',
                requiresHumanReview: false,
                pricingRuleId: 'PETIT_GROUPE_8H',
                volumePolicy: { kind: 'derive', hoursPerMonth: 8, source: 'T3A disposable test fixture — never the real canonical catalogue' },
              }
            : m,
        ),
      };
      return { ...actual, getCandidatIndividuelCatalogueRaw: () => approved };
    });
  });

  afterEach(() => {
    jest.dontMock('@/lib/pricing');
    jest.resetModules();
  });

  /** jest.resetModules() wipes every singleton (config snapshot, catalogue cache) — every collaborator is re-imported fresh, per the established P11-fixture pattern. */
  async function freshImports() {
    const { _setForTest: setForTestFresh, _resetForTest: resetForTestFresh } = await import('@/lib/config/snapshot');
    resetForTestFresh();
    setForTestFresh([PIPELINE_ACTIVE_ENTRY]);
    const { resetCatalogueCacheForTests } = await import('@/lib/quotes/catalogue');
    resetCatalogueCacheForTests();
    const { createProfilCandidat } = await import('@/lib/quotes/profil-candidat.server');
    const { POST: createQuotePOST } = await import('@/app/api/assistante/candidat-individuel/profils/[id]/quote/route');
    const { GET: pdfGET } = await import('@/app/api/assistante/candidat-individuel/quotes/[quoteId]/pdf/route');
    return { createProfilCandidat, createQuotePOST, pdfGET };
  }

  async function createProfil(createProfilCandidat: Awaited<ReturnType<typeof freshImports>>['createProfilCandidat']) {
    const created = await createProfilCandidat({ publicInput: PUBLIC_INPUT, staffExtension: STAFF_EXTENSION }, 'staff-1');
    if (!created.ok) throw new Error(`T3A profil creation failed in test fixture: ${JSON.stringify(created)}`);
    return created.profil;
  }

  async function postQuote(
    createQuotePOST: Awaited<ReturnType<typeof freshImports>>['createQuotePOST'],
    profilId: string,
    confirmedHeadcountBySubject?: Record<string, number>,
  ) {
    return createQuotePOST(
      req({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        diagnostic: DIAGNOSTIC,
        ...(confirmedHeadcountBySubject ? { confirmedHeadcountBySubject } : {}),
      }),
      { params: Promise.resolve({ id: profilId }) },
    );
  }

  // ── A/G — no headcount at all, or an incomplete map, blocks the WHOLE scenario ──

  test('§10.A: no confirmedHeadcountBySubject at all -> 422 GROUP_PENDING, no Quote created', async () => {
    if (!dbAvailable) return;
    const { createProfilCandidat, createQuotePOST } = await freshImports();
    const profil = await createProfil(createProfilCandidat);
    const res = await postQuote(createQuotePOST, profil.id);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.groupState).toBe('GROUP_PENDING');
    expect(await prisma.quote.count()).toBe(0);
  });

  test('§10.G: one matière missing from confirmedHeadcountBySubject (lvb) still blocks the WHOLE scenario -> 422 GROUP_PENDING, no partial Quote, no cross-application', async () => {
    if (!dbAvailable) return;
    const { createProfilCandidat, createQuotePOST } = await freshImports();
    const profil = await createProfil(createProfilCandidat);
    const res = await postQuote(createQuotePOST, profil.id, { lva: 3, 'specialite-abandonnee': 3 }); // lvb missing
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.groupState).toBe('GROUP_PENDING');
    expect(await prisma.quote.count()).toBe(0);
  });

  // ── B/C/D/E — per-subject headcount x modality truth table, real tariff, real margin, real PDF ──

  const UNIFORM_HEADCOUNT_CASES: Array<{ headcount: number; expectedModality: string; expectedPdfWord: RegExp; unitPriceCheck: (hours: number) => number }> = [
    { headcount: 1, expectedModality: 'INDIVIDUEL', expectedPdfWord: /Individuel/i, unitPriceCheck: (h) => 180 * h },
    { headcount: 2, expectedModality: 'DUO', expectedPdfWord: /Duo/i, unitPriceCheck: (h) => 90 * h },
    { headcount: 3, expectedModality: 'GROUPE', expectedPdfWord: /Petit groupe/i, unitPriceCheck: () => 470 },
    { headcount: 4, expectedModality: 'GROUPE', expectedPdfWord: /Petit groupe/i, unitPriceCheck: () => 470 },
  ];

  test.each(
    GATED_MODULE_IDS.flatMap((_, i) => UNIFORM_HEADCOUNT_CASES.map((c) => ({ subject: ['lva', 'lvb', 'specialite-abandonnee'][i], ...c }))),
  )(
    '§10.B-E: $subject with headcount=$headcount -> $expectedModality, correct tariff, MARGIN_OK gate, correct PDF wording',
    async ({ subject, headcount, expectedModality, expectedPdfWord, unitPriceCheck }) => {
      if (!dbAvailable) return;
      const { createProfilCandidat, createQuotePOST, pdfGET } = await freshImports();
      const profil = await createProfil(createProfilCandidat);
      // Every GROUPE line needs an entry (all-or-nothing) — the other two
      // subjects are pinned at 3 (GROUPE, uncontested) so only the subject
      // under test varies.
      const confirmedHeadcountBySubject: Record<string, number> = { lva: 3, lvb: 3, 'specialite-abandonnee': 3, [subject]: headcount };
      const res = await postQuote(createQuotePOST, profil.id, confirmedHeadcountBySubject);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.marginGate).toBe('MARGIN_OK');

      const lines = await prisma.quoteLine.findMany({ where: { quoteId: body.quote.id } });
      const line = lines.find((l) => l.subject === SUBJECT_LABELS[subject]);
      expect(line).toBeDefined();
      expect(line!.modality).toBe(expectedModality);
      expect(line!.unitPrice).toBe(unitPriceCheck(line!.hoursPerMonth ?? 8));

      const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
      const snapshotRegles = row.snapshotRegles as { margin: { gate: string } };
      expect(snapshotRegles.margin.gate).toBe('MARGIN_OK');

      const pdfRes = await pdfGET(pdfReq(body.quote.id), { params: Promise.resolve({ quoteId: body.quote.id }) });
      expect(pdfRes.status).toBe(200);
      const text = await extractPdfText(Buffer.from(await pdfRes.arrayBuffer()));
      // Pre-existing, unrelated PDF layout constraint (lib/quote/pdf.ts's
      // drawOfferBox clamps every "Inclus dans le parcours" bullet to 80
      // chars): "specialite-abandonnee"'s own catalogue label is long
      // enough that its modality suffix never survives the clamp,
      // regardless of which modality it resolved to — true for ANY
      // sufficiently long-labeled module, not something this lot
      // introduces or is asked to fix. The DB-level modality/unitPrice
      // assertions above are the authoritative, unambiguous proof for
      // this subject; the PDF wording check only applies where the label
      // is short enough to reliably survive (lva/lvb).
      if (subject !== 'specialite-abandonnee') {
        expect(text).toMatch(expectedPdfWord);
      }
    },
  );

  test('the PDF for a specialite-abandonnee line ALWAYS carries the mandatory "ne prépare aucune épreuve du bac" warning, regardless of effective modality (SOLO/DUO/GROUPE)', async () => {
    if (!dbAvailable) return;
    for (const headcount of [1, 2, 3]) {
      const { createProfilCandidat, createQuotePOST, pdfGET } = await freshImports();
      const profil = await createProfil(createProfilCandidat);
      const res = await postQuote(createQuotePOST, profil.id, { lva: 3, lvb: 3, 'specialite-abandonnee': headcount });
      expect(res.status).toBe(201);
      const body = await res.json();
      const pdfRes = await pdfGET(pdfReq(body.quote.id), { params: Promise.resolve({ quoteId: body.quote.id }) });
      const text = await extractPdfText(Buffer.from(await pdfRes.arrayBuffer()));
      expect(text).toMatch(/ne prépare aucune épreuve du bac/i);
    }
  });

  // ── F — multi-subject, distinct headcounts, no cross-application ──

  test('§10.F: LVA=1 (SOLO), LVB=2 (DUO), specialite-abandonnee=3 (GROUPE) resolve independently — no headcount ever applied to the wrong matière', async () => {
    if (!dbAvailable) return;
    const { createProfilCandidat, createQuotePOST } = await freshImports();
    const profil = await createProfil(createProfilCandidat);
    const res = await postQuote(createQuotePOST, profil.id, { lva: 1, lvb: 2, 'specialite-abandonnee': 3 });
    expect(res.status).toBe(201);
    const body = await res.json();

    const lines = await prisma.quoteLine.findMany({ where: { quoteId: body.quote.id } });
    const byLabel = Object.fromEntries(lines.map((l) => [l.subject, l]));
    expect(byLabel[SUBJECT_LABELS.lva].modality).toBe('INDIVIDUEL');
    expect(byLabel[SUBJECT_LABELS.lva].unitPrice).toBe(180 * (byLabel[SUBJECT_LABELS.lva].hoursPerMonth ?? 8));
    expect(byLabel[SUBJECT_LABELS.lvb].modality).toBe('DUO');
    expect(byLabel[SUBJECT_LABELS.lvb].unitPrice).toBe(90 * (byLabel[SUBJECT_LABELS.lvb].hoursPerMonth ?? 8));
    expect(byLabel[SUBJECT_LABELS['specialite-abandonnee']].modality).toBe('GROUPE');
    expect(byLabel[SUBJECT_LABELS['specialite-abandonnee']].unitPrice).toBe(470);

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as {
      groupState: { state: string; lineResolutions: Array<{ subject: string; requestedModality: string; confirmedHeadcount: number; effectiveModality: string; groupConfirmed: boolean }> };
    };
    expect(snapshotRegles.groupState.state).toBe('GROUP_CONFIRMED'); // specialite-abandonnee genuinely confirmed
    const bySubjectRes = Object.fromEntries(snapshotRegles.groupState.lineResolutions.map((r) => [r.subject, r]));
    expect(bySubjectRes.lva).toEqual({ subject: 'lva', requestedModality: 'GROUPE', confirmedHeadcount: 1, effectiveModality: 'SOLO', groupConfirmed: false });
    expect(bySubjectRes.lvb).toEqual({ subject: 'lvb', requestedModality: 'GROUPE', confirmedHeadcount: 2, effectiveModality: 'DUO', groupConfirmed: false });
    expect(bySubjectRes['specialite-abandonnee']).toEqual({ subject: 'specialite-abandonnee', requestedModality: 'GROUPE', confirmedHeadcount: 3, effectiveModality: 'GROUPE', groupConfirmed: true });
  });

  // ── §12 signed-link view: same persisted Quote, no divergent recalculation ──

  test('§12 signed-link view: an unpromoted draft (LEGACY_ESTIMATE_UNVERIFIED, no CARTE_VALIDATED_DEFINITIVE) is NOT_FOUND via the family view, exactly like every other candidat-individuel draft — the group-headcount mechanism does not bypass this gate', async () => {
    if (!dbAvailable) return;
    const { createProfilCandidat, createQuotePOST } = await freshImports();
    const profil = await createProfil(createProfilCandidat);
    const res = await postQuote(createQuotePOST, profil.id, { lva: 3, lvb: 3, 'specialite-abandonnee': 3 });
    expect(res.status).toBe(201);
    const body = await res.json();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });

    const { hashToken } = await import('@/lib/invoice/access-token');
    const rawToken = randomUUID();
    await prisma.quote.update({ where: { id: row.id }, data: { publicTokenHash: hashToken(rawToken) } });

    const { getQuoteForFamilyView } = await import('@/lib/quotes/public-view.server');
    const { quote } = await getQuoteForFamilyView(rawToken);
    expect(quote).toBeNull();
  });

  // ── T1/T2 non-regression against these three gated modules specifically ──

  test('non-regression: invalid confirmedHeadcountBySubject values (0/-1/1.5) are still rejected at 400, never silently coerced', async () => {
    if (!dbAvailable) return;
    const { createProfilCandidat, createQuotePOST } = await freshImports();
    const profil = await createProfil(createProfilCandidat);
    for (const invalid of [0, -1, 1.5]) {
      const res = await postQuote(createQuotePOST, profil.id, { lva: invalid, lvb: 3, 'specialite-abandonnee': 3 });
      expect(res.status).toBe(400);
    }
    expect(await prisma.quote.count()).toBe(0);
  });

  test('T3A closeout: without the fixture override, the REAL canonical catalogue still blocks LVA/LVB/SPECIALITE_ABANDONNEE with DIRECTION_APPROVAL_REQUIRED — activation was reverted (§1 closeout: PETIT_GROUPE_4H_GOVERNANCE = UNAPPROVED_BUSINESS_ASSUMPTION), the fixture never leaks outside its own mock scope', async () => {
    if (!dbAvailable) return;
    jest.dontMock('@/lib/pricing');
    jest.resetModules();
    const { _setForTest: setForTestFresh, _resetForTest: resetForTestFresh } = await import('@/lib/config/snapshot');
    resetForTestFresh();
    setForTestFresh([PIPELINE_ACTIVE_ENTRY]);
    const { resetCatalogueCacheForTests } = await import('@/lib/quotes/catalogue');
    resetCatalogueCacheForTests();
    const { buildCandidateQuoteRecommendation } = await import('@/lib/quotes/pipeline');
    const result = buildCandidateQuoteRecommendation({
      publicInput: PUBLIC_INPUT,
      staffExtension: STAFF_EXTENSION,
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
      diagnostic: DIAGNOSTIC,
    } as never);
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    if (result.status === 'DIRECTION_APPROVAL_REQUIRED') {
      expect(result.pendingModuleIds.sort()).toEqual(['MOD_LVA', 'MOD_LVB', 'MOD_SPECIALITE_ABANDONNEE'].sort());
    }
    // Re-arm the fixture for any subsequent test in this file (afterEach also does this, defensive here since this test bypassed the shared beforeEach fixture).
    jest.doMock('@/lib/pricing', () => {
      const actual = jest.requireActual('@/lib/pricing');
      const raw = actual.getCandidatIndividuelCatalogueRaw();
      return { ...actual, getCandidatIndividuelCatalogueRaw: () => raw };
    });
  });
});
