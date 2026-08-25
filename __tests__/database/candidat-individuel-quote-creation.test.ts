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
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping candidat-individuel quote-creation tests: test database not available');
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

  test('flag OFF blocks even a valid ASSISTANTE session', async () => {
    if (!dbAvailable) return;
    _resetForTest(); // flag defaults OFF
    const res = await createQuotePOST(req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }), { params: Promise.resolve({ id: 'x' }) });
    expect(res.status).toBe(403);
  });

  test('a non-READY profil (nominal terminale, DIRECTION_APPROVAL_REQUIRED) is rejected — no Quote created', async () => {
    if (!dbAvailable) return;
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
    if (!dbAvailable) return;
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
    expect(body.quote.snapshotCarte).not.toBeNull();
    expect(body.quote.snapshotRegles).not.toBeNull();
    expect(body.quote.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED'); // never promoted by this route

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    expect(() => assertQuoteCanBeSent(row)).toThrow(QuoteNotEmittableError); // draft stays provisoire — envoi interdit
  });

  test('idempotencyKey dedupes a retried submission — never a second Quote', async () => {
    if (!dbAvailable) return;
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
    if (!dbAvailable) return;
    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'RECOMMANDE' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  test('400 when the requested scenarioTier is malformed', async () => {
    if (!dbAvailable) return;
    const res = await createQuotePOST(
      req({ idempotencyKey: randomUUID(), budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }, scenarioTier: 'INVALID_TIER' }),
      { params: Promise.resolve({ id: 'x' }) },
    );
    expect(res.status).toBe(400);
  });
});
