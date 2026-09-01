/**
 * DB integration test for POST /api/assistante/candidat-individuel/
 * profils/:id/quote (mission "vers un produit complet" §4) — real Postgres,
 * real pipeline, real createQuote/emission-guard. Only auth is mocked
 * (no real HTTP session in a test process); the feature flag is set via
 * the real BusinessConfig snapshot test seam (_setForTest), not mocked.
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
import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import { assertQuoteCanBeSent, QuoteNotEmittableError } from '@/lib/quotes/emission-guard';
import { POST as createQuotePOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/quote/route';

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

// T1 — deliberately dispenses only the DIRECTION_A_VALIDER-mapped
// épreuves (lva/lvb/histoire-géo/enseignement-scientifique/emc), leaving
// eds1/eds2/philosophie undispensed so the pipeline actually selects
// their already-APPROVED, cost-bearing GROUPE modules — unlike
// READY_STAFF_EXTENSION (all 9 dispensed), whose RECOMMANDE scenario is
// Pilotage-only (zero teacher-hour cost, margin invariant to any cost
// policy) and therefore useless for proving a real BLOCKED gate.
const MARGIN_SENSITIVE_STAFF_EXTENSION = {
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

function req(body: unknown) {
  return new NextRequest('http://localhost/api/assistante/candidat-individuel/profils/x/quote', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/assistante/candidat-individuel/profils/:id/quote', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('candidat-individuel quote-creation tests require a reachable PostgreSQL test database — DATABASE_TEST_MODE=REQUIRED, never a silent skip');
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

  test('flag OFF blocks even a valid ASSISTANTE session', async () => {
    _resetForTest(); // flag defaults OFF
    const res = await createQuotePOST(req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }), { params: Promise.resolve({ id: 'x' }) });
    expect(res.status).toBe(403);
  });

  test('a non-READY profil (nominal terminale, DIRECTION_APPROVAL_REQUIRED) is rejected — no Quote created', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' } },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    expect(await prisma.quote.count()).toBe(0);
  });

  test('a READY profil creates a draft Quote — profilId/snapshotCarte/snapshotRegles set, still blocked from send by the existing emission guard', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: READY_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.quote.profilId).toBe(created.profil.id);
    expect(body.quote.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED'); // never promoted by this route

    // Mission "vers un produit complet" §9 — no margin/cost data in any API
    // response from this surface: snapshotCarte/snapshotRegles are stored
    // for audit but never serialized back, even to an authorized caller.
    expect(body.quote).not.toHaveProperty('snapshotCarte');
    expect(body.quote).not.toHaveProperty('snapshotRegles');
    expect(JSON.stringify(body)).not.toMatch(/marginPct|costPolicy|teacherCostPerHourTnd/);

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    expect(row.snapshotCarte).not.toBeNull(); // figé pour l'audit, en DB uniquement
    expect(row.snapshotRegles).not.toBeNull();
    expect(() => assertQuoteCanBeSent(row)).toThrow(QuoteNotEmittableError); // draft stays provisoire — envoi interdit
  });

  test('idempotencyKey dedupes a retried submission — never a second Quote', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: READY_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const key = randomUUID();
    const body = { idempotencyKey: key, budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' };

    const first = await createQuotePOST(req(body), { params: Promise.resolve({ id: created.profil.id }) });
    expect(first.status).toBe(201);
    const second = await createQuotePOST(req(body), { params: Promise.resolve({ id: created.profil.id }) });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.alreadyExisted).toBe(true);
    expect(await prisma.quote.count()).toBe(1);
  });

  test('404 when the profil does not exist', async () => {
    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  test('400 when the requested scenarioTier is malformed', async () => {
    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'INVALID_TIER' }),
      { params: Promise.resolve({ id: 'x' }) },
    );
    expect(res.status).toBe(400);
  });
});

describe('P3 (bac accéléré, compression sur 1 an) — commercial coverage gate blocks emission at the API even when legally eligible', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('P3 quote-creation tests require a reachable PostgreSQL test database — DATABASE_TEST_MODE=REQUIRED, never a silent skip');
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

  // motif 'age20' is the same autoCheckable Article 3 condition used by
  // __tests__/lib/exams/carte.test.ts's own P3 fixtures — CONFIRMEE here
  // makes the LEGAL eligibility unambiguous (requiresHumanReview=false at
  // the parcours level), isolating what this test actually targets: the
  // separate, P3-specific COMMERCIAL coverage gate added this lot
  // (lib/exams/carte.ts's P3_COMPRESSION_NON_COUVERTE_CODE).
  const P3_LEGALLY_ELIGIBLE_STAFF_EXTENSION = {
    p3EligibiliteAudit: [
      {
        motif: 'age20',
        faitsDeclares: true,
        justificatifRequis: false,
        justificatifValide: true,
        decision: 'CONFIRMEE' as const,
        sourceReglementaire: 'Article 3, arrêté du 16 juillet 2018',
      },
    ],
  };

  test('a legally-eligible P3 profile is still rejected at 422 (HUMAN_REVIEW_REQUIRED) — no Quote created, no bypass via direct API call', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' }, staffExtension: P3_LEGALLY_ELIGIBLE_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.status).toBe('HUMAN_REVIEW_REQUIRED');
    expect(await prisma.quote.count()).toBe(0);
  });

  test('no invented volume/scenario is ever produced for a blocked P3 profile — the HUMAN_REVIEW_REQUIRED result carries no scenarios/pricing at all', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' }, staffExtension: P3_LEGALLY_ELIGIBLE_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/scenarios|grandTotal|monthlyTotal|hoursPerMonth/);
  });

  test('no signed link is ever accessible for a blocked P3 profile — since no Quote/token is ever persisted, there is nothing to reach', async () => {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE' }, staffExtension: P3_LEGALLY_ELIGIBLE_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(await prisma.quote.count()).toBe(0);
    expect(await prisma.quoteAuditLog.count()).toBe(0);
  });
});

describe('T1 — CANDIDAT INDIVIDUEL POLICY SAFETY CORE, §7/§8 (direction decision registry, commit 4ffaac8ed): route-level proof of the BLOCKED gate + persisted policy traceability', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('T1 margin-gate route tests require a reachable PostgreSQL test database — DATABASE_TEST_MODE=REQUIRED, never a silent skip');
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

  /**
   * Writes a real quotes.costPolicy row to the disposable test DB — the
   * same governed BusinessConfig namespace an admin would use in
   * production (lib/config/schemas.ts, registered in an earlier lot),
   * never a mock of getCommercialCostPolicy(). teacherCostPerHourTnd is
   * set high enough that even the currently-APPROVED candidat-individuel
   * modules (which cluster ~41-45% margin under the real 100 TND/h
   * default, per the readiness-review dossier's own §7 finding) fall
   * below the 30% BLOCKED threshold — proving the gate without touching
   * any commercial price or approval status.
   */
  async function writeBlockingCostPolicy(): Promise<void> {
    await prisma.businessConfig.create({
      data: {
        namespace: 'quotes.costPolicy',
        key: 'default',
        // No `source` field — T1 closeout item 2: provenance is never
        // admin/stored, it's derived by getCommercialCostPolicy() from the
        // mere fact this row exists and parses (-> 'BUSINESS_CONFIG').
        value: {
          teacherCostPerHourTnd: 5000,
          variableCostPerStudentMonthTnd: 10,
          marginGates: { greenPct: 40, warningPct: 30 },
        },
        schemaVersion: '1.0',
        version: 1,
        updatedBy: 'test-fixture',
      },
    });
  }

  test('a real BLOCKED-margin scenario (via a disposable-DB-only quotes.costPolicy row, never a catalogue change) is refused at the route: 422, no Quote created, no override applied silently', async () => {
    await writeBlockingCostPolicy();
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: MARGIN_SENSITIVE_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 } }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.gate).toBe('BLOCKED');
    expect(await prisma.quote.count()).toBe(0);
  });

  test('marginOverride with an explicit reason bypasses a real BLOCKED gate — the override is audited (reason, byUserId, timestamp) in the persisted snapshotRegles, never silent', async () => {
    await writeBlockingCostPolicy();
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: MARGIN_SENSITIVE_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 },
        marginOverride: { reason: 'Test T1 — override audité explicitement' },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.marginGate).toBe('BLOCKED');
    expect(await prisma.quote.count()).toBe(1);

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as {
      costPolicy: { source: string; teacherCostPerHourTnd: number };
      margin: { marginPct: number; gate: string };
      marginOverride: { reason: string; byUserId: string; at: string } | null;
    };

    // §8 traceability, proven directly against the persisted row: policy
    // provenance, its threshold family, the resulting margin/gate, and the
    // audited override are all recoverable from one Quote — no second
    // model invented, the existing snapshotRegles column already carries
    // this once the policy itself declares its provenance (T1 §2/§3).
    // This row came from a real BusinessConfig write (writeBlockingCostPolicy)
    // — T1 closeout item 2: it must read back as governed, never as the
    // coded fallback.
    expect(snapshotRegles.costPolicy.source).toBe('BUSINESS_CONFIG');
    expect(snapshotRegles.costPolicy.teacherCostPerHourTnd).toBe(5000);
    expect(snapshotRegles.margin.gate).toBe('BLOCKED');
    expect(snapshotRegles.marginOverride).not.toBeNull();
    expect(snapshotRegles.marginOverride!.reason).toBe('Test T1 — override audité explicitement');
    expect(snapshotRegles.marginOverride!.byUserId).toBe('staff-1');
    expect(typeof snapshotRegles.marginOverride!.at).toBe('string');
  });

  test('without a quotes.costPolicy row, the fallback used and persisted is explicitly source=BLENDED_FALLBACK — never ambiguous', async () => {
    // No writeBlockingCostPolicy() call — DEFAULT_COST_POLICY governs.
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: MARGIN_SENSITIVE_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 } }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as { costPolicy: { source: string; teacherCostPerHourTnd: number } };
    expect(snapshotRegles.costPolicy.source).toBe('BLENDED_FALLBACK');
    expect(snapshotRegles.costPolicy.teacherCostPerHourTnd).toBe(100);
  });

  test('a real, valid governed row (no "source" field, the correct stored shape) is read back with the full amount and source=BUSINESS_CONFIG — never silently defaulted', async () => {
    await prisma.businessConfig.create({
      data: {
        namespace: 'quotes.costPolicy',
        key: 'default',
        value: { teacherCostPerHourTnd: 9999, variableCostPerStudentMonthTnd: 10, marginGates: { greenPct: 40, warningPct: 30 } },
        schemaVersion: '1.0',
        version: 1,
        updatedBy: 'test-fixture',
      },
    });
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: MARGIN_SENSITIVE_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 },
        marginOverride: { reason: 'Test T1 closeout — coût 9999 déclenche BLOCKED, override attendu' },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as { costPolicy: { source: string; teacherCostPerHourTnd: number } };
    expect(snapshotRegles.costPolicy.source).toBe('BUSINESS_CONFIG');
    expect(snapshotRegles.costPolicy.teacherCostPerHourTnd).toBe(9999);
  });

  test('a pre-closeout-shaped row (carrying the old "source": "BLENDED_FALLBACK" field this closeout removed from the stored schema) is now itself malformed — fails closed to DEFAULT_COST_POLICY, never silently misread', async () => {
    // Exactly the shape 0e60466ea's own writeBlockingCostPolicy() used to
    // write, before this closeout corrected the stored schema — a
    // realistic "old row left over from before this fix" scenario.
    await prisma.businessConfig.create({
      data: {
        namespace: 'quotes.costPolicy',
        key: 'default',
        value: { source: 'BLENDED_FALLBACK', teacherCostPerHourTnd: 9999, variableCostPerStudentMonthTnd: 10, marginGates: { greenPct: 40, warningPct: 30 } },
        schemaVersion: '1.0',
        version: 1,
        updatedBy: 'test-fixture',
      },
    });
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: MARGIN_SENSITIVE_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 } }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as { costPolicy: { source: string; teacherCostPerHourTnd: number } };
    expect(snapshotRegles.costPolicy.source).toBe('BLENDED_FALLBACK');
    expect(snapshotRegles.costPolicy.teacherCostPerHourTnd).toBe(100); // DEFAULT, never the malformed row's 9999
  });
});

describe('T2 — CANDIDAT INDIVIDUEL HEADCOUNT & GROUP STATE SAFETY (direction decision registry, commit 4ffaac8ed), corrected per the T2-closeout review (post-294a885d6): route-level GROUP_PENDING/GROUP_CONFIRMED/NOT_APPLICABLE, real DUO/SOLO pricing, per-subject cardinality, persistence', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('T2 group-headcount route tests require a reachable PostgreSQL test database — DATABASE_TEST_MODE=REQUIRED, never a silent skip');
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

  // MARGIN_SENSITIVE_STAFF_EXTENSION's RECOMMANDE scenario has exactly
  // three GROUPE-modality lines (verified against the real pipeline):
  // eds1 (Mathématiques), eds2 (Physique-Chimie), philosophie — each an
  // independent subject/cohort, the fixture this whole describe block
  // exercises the per-subject cardinality model against.
  async function createMarginSensitiveProfil() {
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: MARGIN_SENSITIVE_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    return created;
  }

  test('a GROUPE-containing scenario with no confirmedHeadcountBySubject at all is GROUP_PENDING: 422, no Quote created — never silently priced at the catalogue GROUPE rate as if effectif=3', async () => {
    const created = await createMarginSensitiveProfil();
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.groupState).toBe('GROUP_PENDING');
    expect(await prisma.quote.count()).toBe(0);
  });

  test('§2 all-or-nothing: confirming only eds1 while eds2/philosophie are missing still blocks the WHOLE scenario as GROUP_PENDING — never a partial Quote', async () => {
    const created = await createMarginSensitiveProfil();
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: 3 } }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.groupState).toBe('GROUP_PENDING');
    expect(await prisma.quote.count()).toBe(0);
  });

  test('confirmedHeadcountBySubject values of 0/-1/1.5 are rejected at the route (400), never silently coerced — validated before the pricing function repriced anything', async () => {
    const created = await createMarginSensitiveProfil();
    if (!created.ok) return;

    for (const invalid of [0, -1, 1.5]) {
      const res = await createQuotePOST(
        req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: invalid, eds2: 3, philosophie: 3 } }),
        { params: Promise.resolve({ id: created.profil.id }) },
      );
      expect(res.status).toBe(400);
    }
    expect(await prisma.quote.count()).toBe(0);
  });

  test('T2-closeout item 1: confirmedHeadcount=1 for every subject bascules to real SOLO (INDIVIDUEL) pricing but the scenario state is NOT_APPLICABLE, never GROUP_CONFIRMED — the group question no longer applies', async () => {
    const created = await createMarginSensitiveProfil();
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: 1, eds2: 1, philosophie: 1 } }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const lines = await prisma.quoteLine.findMany({ where: { quoteId: body.quote.id } });
    const groupSourced = lines.filter((l) => l.modality === 'INDIVIDUEL' && l.unitPrice === 180 * (l.hoursPerMonth ?? 0));
    expect(groupSourced.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.modality === 'GROUPE')).toBe(false);

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as { groupState: { state: string; confirmedHeadcountBySubject: Record<string, number>; lineResolutions: Array<{ effectiveModality: string; groupConfirmed: boolean }> } };
    expect(snapshotRegles.groupState.state).toBe('NOT_APPLICABLE');
    expect(snapshotRegles.groupState.confirmedHeadcountBySubject).toEqual({ eds1: 1, eds2: 1, philosophie: 1 });
    expect(snapshotRegles.groupState.lineResolutions.every((r) => r.effectiveModality === 'SOLO' && r.groupConfirmed === false)).toBe(true);
  });

  test('T2-closeout item 1: confirmedHeadcount=2 for every subject bascules to real DUO pricing — 90 TND/h/student, state NOT_APPLICABLE, never GROUP_CONFIRMED', async () => {
    const created = await createMarginSensitiveProfil();
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: 2, eds2: 2, philosophie: 2 } }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const lines = await prisma.quoteLine.findMany({ where: { quoteId: body.quote.id } });
    const duoSourced = lines.filter((l) => l.modality === 'DUO' && l.unitPrice === 90 * (l.hoursPerMonth ?? 0));
    expect(duoSourced.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.modality === 'GROUPE')).toBe(false);

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as { groupState: { state: string; lineResolutions: Array<{ effectiveModality: string; groupConfirmed: boolean }> } };
    expect(snapshotRegles.groupState.state).toBe('NOT_APPLICABLE');
    expect(snapshotRegles.groupState.lineResolutions.every((r) => r.effectiveModality === 'DUO' && r.groupConfirmed === false)).toBe(true);
  });

  test('confirmedHeadcount=3 for every subject keeps the GROUPE catalogue price unchanged, state=GROUP_CONFIRMED — a genuinely confirmed group', async () => {
    const created = await createMarginSensitiveProfil();
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3 } }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const lines = await prisma.quoteLine.findMany({ where: { quoteId: body.quote.id } });
    expect(lines.some((l) => l.modality === 'GROUPE')).toBe(true);

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as { groupState: { state: string; lineResolutions: Array<{ groupConfirmed: boolean }> } };
    expect(snapshotRegles.groupState.state).toBe('GROUP_CONFIRMED');
    expect(snapshotRegles.groupState.lineResolutions.every((r) => r.groupConfirmed)).toBe(true);
  });

  test('§2 HEADCOUNT_CARDINALITY = PER_GROUP_HEADCOUNT_REQUIRED: eds1=3, eds2=2, philosophie=4 — each subject resolved with its OWN headcount, never a shared one; eds2 never bleeds into eds1/philosophie', async () => {
    const created = await createMarginSensitiveProfil();
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: 3, eds2: 2, philosophie: 4 } }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const lines = await prisma.quoteLine.findMany({ where: { quoteId: body.quote.id } });
    // QuoteLine.subject persists RecommendedLine.label (an immutable
    // display snapshot), not the subjectId — incrément 3 (candidate-need.ts)
    // resolves EDS1/EDS2's real specialty name (from the profile's own
    // specialite1/specialite2, mission §5) instead of the generic catalogue
    // text ("Enseignement de spécialité 1"/"2"), so they remain
    // distinguishable by their real, human-correct names.
    const bySubject = Object.fromEntries(lines.map((l) => [l.subject, l]));
    expect(bySubject['Mathématiques'].modality).toBe('GROUPE');
    expect(bySubject['Physique-Chimie'].modality).toBe('DUO');
    expect(bySubject['Physique-Chimie'].unitPrice).toBe(90 * (bySubject['Physique-Chimie'].hoursPerMonth ?? 0));
    expect(bySubject['Philosophie'].modality).toBe('GROUPE');

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as {
      groupState: { state: string; lineResolutions: Array<{ subject: string; confirmedHeadcount: number; effectiveModality: string; groupConfirmed: boolean }> };
    };
    expect(snapshotRegles.groupState.state).toBe('GROUP_CONFIRMED'); // at least one (eds1, philosophie) truly confirmed
    const bySubjectRes = Object.fromEntries(snapshotRegles.groupState.lineResolutions.map((r) => [r.subject, r]));
    expect(bySubjectRes.eds1).toEqual({ subject: 'eds1', requestedModality: 'GROUPE', confirmedHeadcount: 3, effectiveModality: 'GROUPE', groupConfirmed: true });
    expect(bySubjectRes.eds2).toEqual({ subject: 'eds2', requestedModality: 'GROUPE', confirmedHeadcount: 2, effectiveModality: 'DUO', groupConfirmed: false });
    expect(bySubjectRes.philosophie).toEqual({ subject: 'philosophie', requestedModality: 'GROUPE', confirmedHeadcount: 4, effectiveModality: 'GROUPE', groupConfirmed: true });
  });

  test('a headcount entry for a subject absent from the scenario is silently ignored — never misapplied to eds1/eds2/philosophie', async () => {
    const created = await createMarginSensitiveProfil();
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        confirmedHeadcountBySubject: { eds1: 3, eds2: 3, philosophie: 3, 'lva': 999 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as { groupState: { lineResolutions: Array<{ subject: string }> } };
    expect(snapshotRegles.groupState.lineResolutions.map((r) => r.subject).sort()).toEqual(['eds1', 'eds2', 'philosophie']);
  });

  test('a P11-shaped scenario (all-INDIVIDUEL) or a Pilotage-only scenario never require confirmedHeadcountBySubject — groupState is NOT_APPLICABLE, non-regressive', async () => {
    // READY_STAFF_EXTENSION dispenses every épreuve -> Pilotage-only scenario.
    const created = await createProfilCandidat(
      { publicInput: { level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE', estTitulaireBacDejaObtenu: true }, staffExtension: READY_STAFF_EXTENSION },
      'staff-1',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as { groupState: { state: string; confirmedHeadcountBySubject: Record<string, number> | null } };
    expect(snapshotRegles.groupState.state).toBe('NOT_APPLICABLE');
    expect(snapshotRegles.groupState.confirmedHeadcountBySubject).toBeNull();
  });

  test('invariant, enforced at persistence level: every groupConfirmed=true resolution has effectiveModality===GROUPE and confirmedHeadcount>=group_min_open (3)', async () => {
    const created = await createMarginSensitiveProfil();
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: 3, eds2: 2, philosophie: 1 } }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as {
      groupState: { lineResolutions: Array<{ confirmedHeadcount: number; effectiveModality: string; groupConfirmed: boolean }> };
    };
    for (const r of snapshotRegles.groupState.lineResolutions) {
      if (r.groupConfirmed) {
        expect(r.effectiveModality).toBe('GROUPE');
        expect(r.confirmedHeadcount).toBeGreaterThanOrEqual(3);
      } else {
        expect(r.effectiveModality).not.toBe('GROUPE');
      }
    }
  });

  test('§11.E persistence: headcountBySubject/state/lineResolutions are recoverable exactly, reading back from Postgres — no ambiguity, no second model of truth', async () => {
    const created = await createMarginSensitiveProfil();
    if (!created.ok) return;

    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE', confirmedHeadcountBySubject: { eds1: 2, eds2: 2, philosophie: 2 } }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    const body = await res.json();

    // Fresh read — not the in-process response — proves genuine persistence.
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    const snapshotRegles = row.snapshotRegles as {
      groupState: { state: string; confirmedHeadcountBySubject: Record<string, number>; lineResolutions: Array<{ subject: string; requestedModality: string; effectiveModality: string; confirmedHeadcount: number; groupConfirmed: boolean }> };
    };
    expect(snapshotRegles.groupState.state).toBe('NOT_APPLICABLE');
    expect(snapshotRegles.groupState.confirmedHeadcountBySubject).toEqual({ eds1: 2, eds2: 2, philosophie: 2 });
    expect(snapshotRegles.groupState.lineResolutions.sort((a, b) => a.subject.localeCompare(b.subject))).toEqual([
      { subject: 'eds1', requestedModality: 'GROUPE', effectiveModality: 'DUO', confirmedHeadcount: 2, groupConfirmed: false },
      { subject: 'eds2', requestedModality: 'GROUPE', effectiveModality: 'DUO', confirmedHeadcount: 2, groupConfirmed: false },
      { subject: 'philosophie', requestedModality: 'GROUPE', effectiveModality: 'DUO', confirmedHeadcount: 2, groupConfirmed: false },
    ]);

    const lines = await prisma.quoteLine.findMany({ where: { quoteId: row.id } });
    const total = lines.reduce((s, l) => s + l.lineTotal, 0);
    expect(row.grandTotal).toBe(total);
  });
});
