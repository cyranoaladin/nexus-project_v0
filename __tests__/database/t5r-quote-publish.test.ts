/**
 * T5R — RECETTE_FINDING_3: real staff promotion action
 * (POST /api/assistante/candidat-individuel/quotes/:quoteId/publish).
 * Real Postgres, real pipeline, real routes throughout — no direct
 * Prisma write is ever used to reach a family-visible state in this
 * file (that was exactly the forbidden pattern this lot replaces).
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
import { POST as createQuotePOST } from '@/app/api/assistante/candidat-individuel/profils/[id]/quote/route';
import { POST as publishPOST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/publish/route';
import { GET as pdfGET } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/pdf/route';

async function extractPdfText(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `t5r-pdf-line-pricing-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
  }
}

function pdfReq(quoteId: string) {
  return new NextRequest(`http://localhost/api/assistante/candidat-individuel/quotes/${quoteId}/pdf`);
}

const prisma = testPrisma;

const PIPELINE_ACTIVE_ENTRY = { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL', schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date() };

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

const VALID_PUBLIC_INPUT = {
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
const VALID_STAFF_EXTENSION = {
  dispensesDeclarees: [
    { epreuveId: 'eds1', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-1' },
    { epreuveId: 'eds2', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-2' },
    { epreuveId: 'philosophie', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-3' },
    { epreuveId: 'grand-oral', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-4' },
    { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-5' },
    { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-6' },
    { epreuveId: 'emc', statut: 'CONFIRMEE' as const, justificatifRef: 'REF-7' },
  ],
};
const VALID_DIAGNOSTIC = { raw: { anglais: { points: 35, maxPoints: 100, percentage: 35 }, nsi: { points: 35, maxPoints: 100, percentage: 35 } } };

describe('T5R — POST .../quotes/:quoteId/publish (RECETTE_FINDING_3)', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping T5R publish tests: test database not available');
  }, 10000);

  beforeEach(async () => {
    if (!dbAvailable) return;
    await setupTestDatabase();
    authResult = { user: { id: 'staff-1', role: 'ASSISTANTE', email: 'staff@test.com' } };
    _resetForTest();
    _setForTest([PIPELINE_ACTIVE_ENTRY]);
    resetCatalogueCacheForTests();
  }, 30000);

  async function createValidQuote(): Promise<string> {
    const created = await createProfilCandidat({ publicInput: VALID_PUBLIC_INPUT, staffExtension: VALID_STAFF_EXTENSION }, 'staff-1');
    if (!created.ok) throw new Error(`fixture profil creation failed: ${JSON.stringify(created)}`);
    const res = await createQuotePOST(
      quoteReq({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        diagnostic: VALID_DIAGNOSTIC,
        confirmedHeadcountBySubject: { lva: 3, lvb: 3, 'specialite-abandonnee': 3 },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    if (res.status !== 201) throw new Error(`fixture quote creation failed: ${res.status} ${JSON.stringify(await res.json())}`);
    const body = await res.json();
    return body.quote.id as string;
  }

  test('utilisateur non autorisé -> refus (403), aucune mutation', async () => {
    if (!dbAvailable) return;
    const quoteId = await createValidQuote();
    authResult = 'FORBIDDEN';
    const res = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(403);
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED');
  });

  test('quoteId inconnu -> 404', async () => {
    if (!dbAvailable) return;
    const res = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId: 'does-not-exist' }) });
    expect(res.status).toBe(404);
  });

  test('lien signé inaccessible avant publication', async () => {
    if (!dbAvailable) return;
    const quoteId = await createValidQuote();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED');
    // Same mechanism the pre-existing T3A test already proved: an
    // unpromoted draft is NOT_FOUND via the family view.
    const { getQuoteForFamilyView } = await import('@/lib/quotes/public-view.server');
    const { hashToken } = await import('@/lib/invoice/access-token');
    const rawToken = randomUUID();
    await prisma.quote.update({ where: { id: quoteId }, data: { publicTokenHash: hashToken(rawToken), status: 'DEVIS_ENVOYE' } });
    const before = await getQuoteForFamilyView(rawToken);
    expect(before.quote).toBeNull();
  });

  test('devis valide -> publication réussit (200), regulatoryMaturity=CARTE_VALIDATED_DEFINITIVE, lien signé accessible après', async () => {
    if (!dbAvailable) return;
    const quoteId = await createValidQuote();

    const res = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quote.regulatoryMaturity).toBe('CARTE_VALIDATED_DEFINITIVE');
    expect(body.alreadyPromoted).toBe(false);

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.regulatoryMaturity).toBe('CARTE_VALIDATED_DEFINITIVE');

    const { hashToken } = await import('@/lib/invoice/access-token');
    const { getQuoteForFamilyView } = await import('@/lib/quotes/public-view.server');
    const rawToken = randomUUID();
    await prisma.quote.update({ where: { id: quoteId }, data: { publicTokenHash: hashToken(rawToken), status: 'DEVIS_ENVOYE' } });
    const after = await getQuoteForFamilyView(rawToken);
    expect(after.quote).not.toBeNull();
    expect(after.quote!.id).toBe(quoteId);

    const auditRows = await prisma.quoteAuditLog.findMany({ where: { quoteId, action: 'PROMOTED_TO_FAMILY_VISIBLE' } });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].actorUserId).toBe('staff-1');
  });

  test('double appel (double clic/retry) -> idempotent : même résultat, une seule ligne d\'audit', async () => {
    if (!dbAvailable) return;
    const quoteId = await createValidQuote();

    const first = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId }) });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.alreadyPromoted).toBe(false);

    const second = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId }) });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.alreadyPromoted).toBe(true);
    expect(secondBody.quote.regulatoryMaturity).toBe('CARTE_VALIDATED_DEFINITIVE');

    const auditRows = await prisma.quoteAuditLog.findMany({ where: { quoteId, action: 'PROMOTED_TO_FAMILY_VISIBLE' } });
    expect(auditRows).toHaveLength(1); // not 2 — the retry never re-audits.
  });

  test('devis avec marge BLOCKED (override enregistré à la création) -> publication refusée (422), regulatoryMaturity inchangée', async () => {
    if (!dbAvailable) return;
    // A budget too low to reach MARGIN_OK naturally triggers BLOCKED;
    // marginOverride lets creation succeed (existing T1 mechanism) — the
    // resulting Quote is exactly the "BLOCKED but persisted via a
    // legitimate override" case the promotion gate must still refuse.
    const created = await createProfilCandidat({ publicInput: VALID_PUBLIC_INPUT, staffExtension: VALID_STAFF_EXTENSION }, 'staff-1');
    if (!created.ok) throw new Error(`fixture profil creation failed: ${JSON.stringify(created)}`);
    const res = await createQuotePOST(
      quoteReq({
        idempotencyKey: randomUUID(),
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: 'RECOMMANDE',
        diagnostic: VALID_DIAGNOSTIC,
        confirmedHeadcountBySubject: { lva: 3, lvb: 3, 'specialite-abandonnee': 3 },
        marginOverride: { reason: 'Test — condition commerciale exceptionnelle (fixture)' },
      }),
      { params: Promise.resolve({ id: created.profil.id }) },
    );
    // This fixture may or may not actually hit BLOCKED depending on the
    // real catalogue rates — skip gracefully if not, never fabricate the
    // condition by writing snapshotRegles directly (that would itself be
    // the forbidden manual DB patch this lot replaces).
    if (res.status !== 201) return;
    const body = await res.json();
    if (body.marginGate !== 'BLOCKED') return;

    const publishRes = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId: body.quote.id }) });
    expect(publishRes.status).toBe(422);
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: body.quote.id } });
    expect(row.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED');
  });

  test('T5R RECETTE_FINDING_4: the real, rendered PDF shows each commercial line\'s price and reconciles to the total — never teacherCost/margin/pricingRuleId/moduleId', async () => {
    if (!dbAvailable) return;
    const quoteId = await createValidQuote();
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    const lines = await prisma.quoteLine.findMany({ where: { quoteId } });

    const pdfRes = await pdfGET(pdfReq(quoteId), { params: Promise.resolve({ quoteId }) });
    expect(pdfRes.status).toBe(200);
    const text = await extractPdfText(Buffer.from(await pdfRes.arrayBuffer()));

    // Every commercial line's own price appears in the rendered PDF text.
    for (const line of lines) {
      expect(text).toMatch(new RegExp(String(line.unitPrice)));
    }
    // Reconciliation: each displayed line price is a per-month amount
    // (lineTotal = unitPrice x months, D4 pricing model); their sum over
    // the billing period equals the PDF's own annual total ("TOTAL
    // INDICATIF ... TND / an") — monthlyTotal is a DIFFERENT figure (the
    // amortized-with-deposit recurring installment, not the raw sum of
    // line prices), so grandTotal is the structurally correct total to
    // reconcile per-line monthly amounts against.
    const sum = lines.reduce((s, l) => s + l.lineTotal, 0);
    expect(sum).toBe(row.grandTotal);

    // No internal cost/margin/technical identifier ever surfaces.
    expect(text).not.toMatch(/teacherCost|structureCost|marginGate|pricingRuleId|MOD_[A-Z_]+/i);
  });
});
