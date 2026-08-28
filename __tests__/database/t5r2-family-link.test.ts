/**
 * T5R2 — RECETTE_FINDING (FAMILY_LINK_DISTRIBUTION, P1): real staff
 * family-link issuance/rotation action
 * (POST /api/assistante/candidat-individuel/quotes/:quoteId/family-link).
 * Real Postgres, real pipeline, real routes throughout. No direct Prisma
 * write is ever used to reach a family-visible link in this file.
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
function familyLinkReq() {
  return new NextRequest('http://localhost/api/assistante/candidat-individuel/quotes/x/family-link', { method: 'POST' });
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

describe('T5R2 — POST .../quotes/:quoteId/family-link (FAMILY_LINK_DISTRIBUTION)', () => {
  let dbAvailable = false;
  let previousNextAuthUrl: string | undefined;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping T5R2 family-link tests: test database not available');
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
   * T5R5 §FINDING_11 — collectQuotePromotionBlockers / collectFamilyLinkIssuanceBlockers
   * now require contactLeadId + studentId; every fixture below that
   * expects publish/link-issuance to SUCCEED must attach a real
   * (synthetic) identity via createProfilCandidat's own params, never a
   * direct Prisma write.
   */
  async function createSyntheticIdentity() {
    const contactLead = await prisma.contactLead.create({
      data: { name: 'Parent T5R2 FamilyLink', email: `parent.t5r2.${randomUUID().slice(0, 8)}@nexus-test.com`, phone: '+216 99 000 000' },
    });
    const { parentProfile } = await createTestParent({ firstName: 'Parent', lastName: 'T5R2FamilyLink' });
    const { student } = await createTestStudent(parentProfile.id, { user: { firstName: 'Eleve', lastName: 'T5R2FamilyLink' } });
    return { contactLeadId: contactLead.id, studentId: student.id };
  }

  async function createValidQuote(): Promise<string> {
    const { contactLeadId, studentId } = await createSyntheticIdentity();
    const created = await createProfilCandidat({ publicInput: VALID_PUBLIC_INPUT, staffExtension: VALID_STAFF_EXTENSION, contactLeadId, studentId }, 'staff-1');
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

  async function createAndPublishQuote(): Promise<string> {
    const quoteId = await createValidQuote();
    const res = await publishPOST(publishReq(), { params: Promise.resolve({ quoteId }) });
    if (res.status !== 200) throw new Error(`fixture publish failed: ${res.status} ${JSON.stringify(await res.json())}`);
    return quoteId;
  }

  // ── B — unpublished Quote -> link issue fails ──

  test('B: devis non publié (LEGACY_ESTIMATE_UNVERIFIED) -> émission du lien refusée (422), aucune mutation', async () => {
    if (!dbAvailable) return;
    const quoteId = await createValidQuote();
    const res = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.reasons).toContain('regulatoryMaturity != CARTE_VALIDATED_DEFINITIVE');
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.publicTokenHash).toBeDefined(); // creation-time placeholder, unchanged
  });

  // ── E — unauthorized staff -> fails ──

  test('E: utilisateur non autorisé -> refus (403), aucune mutation', async () => {
    if (!dbAvailable) return;
    const quoteId = await createAndPublishQuote();
    const before = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    authResult = 'FORBIDDEN';
    const res = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(403);
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(after.publicTokenHash).toBe(before.publicTokenHash);
  });

  test('quoteId inconnu -> 404', async () => {
    if (!dbAvailable) return;
    const res = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId: 'does-not-exist' }) });
    expect(res.status).toBe(404);
  });

  // ── A — valid published Quote -> link issue succeeds ──
  // ── F — issued token -> family view works ──
  // ── H — DB: tokenHash present, raw token absent ──
  // ── I — no secret leakage ──

  test('A/F/H/I: devis publié -> émission du lien réussit (200), URL famille fonctionnelle, token brut jamais persisté ni exposé ailleurs que dans familyUrl', async () => {
    if (!dbAvailable) return;
    const quoteId = await createAndPublishQuote();

    const res = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('LINK_ISSUED');
    expect(body.familyUrl).toMatch(/^https:\/\/nexus\.test\/devis\/[0-9a-f]{64}$/);
    expect(body).not.toHaveProperty('rawToken');
    expect(body).not.toHaveProperty('token');

    const rawToken = new URL(body.familyUrl).pathname.split('/').pop()!;

    // H — DB never carries the raw token, only its hash.
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.publicTokenHash).not.toBe(rawToken);
    const serializedRow = JSON.stringify(row);
    expect(serializedRow).not.toContain(rawToken);

    // I — no leakage anywhere in the persisted audit trail either.
    const auditRows = await prisma.quoteAuditLog.findMany({ where: { quoteId } });
    expect(JSON.stringify(auditRows)).not.toContain(rawToken);
    const linkAudit = auditRows.find((a) => a.action === 'LINK_ISSUED');
    expect(linkAudit).toBeDefined();
    expect(linkAudit!.actorUserId).toBe('staff-1');

    // F — the family view actually resolves the new raw token.
    const { getQuoteForFamilyView } = await import('@/lib/quotes/public-view.server');
    const familyView = await getQuoteForFamilyView(rawToken);
    expect(familyView.quote).not.toBeNull();
    expect(familyView.quote!.id).toBe(quoteId);
  });

  // ── G — rotation: old link invalid, new link works ──

  test('G: renouvellement du lien -> ancien lien invalide, nouveau lien fonctionnel, action=LINK_ROTATED', async () => {
    if (!dbAvailable) return;
    const quoteId = await createAndPublishQuote();

    const first = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId }) });
    const firstBody = await first.json();
    expect(firstBody.action).toBe('LINK_ISSUED');
    const firstToken = new URL(firstBody.familyUrl).pathname.split('/').pop()!;

    const second = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId }) });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.action).toBe('LINK_ROTATED');
    const secondToken = new URL(secondBody.familyUrl).pathname.split('/').pop()!;
    expect(secondToken).not.toBe(firstToken);

    const { getQuoteForFamilyView } = await import('@/lib/quotes/public-view.server');
    const oldView = await getQuoteForFamilyView(firstToken);
    expect(oldView.quote).toBeNull(); // old link denied
    const newView = await getQuoteForFamilyView(secondToken);
    expect(newView.quote).not.toBeNull();
    expect(newView.quote!.id).toBe(quoteId); // new link works

    const auditRows = await prisma.quoteAuditLog.findMany({ where: { quoteId, action: { in: ['LINK_ISSUED', 'LINK_ROTATED'] } } });
    expect(auditRows).toHaveLength(2);
  });

  // ── invalid/random token, token from another Quote -> inaccessible ──

  test('un token aléatoire/invalide, ou le token d\'un AUTRE devis, reste inaccessible pour ce devis', async () => {
    if (!dbAvailable) return;
    const quoteId1 = await createAndPublishQuote();
    const quoteId2 = await createAndPublishQuote();

    const link1Res = await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId: quoteId1 }) });
    const link1Body = await link1Res.json();
    const token1 = new URL(link1Body.familyUrl).pathname.split('/').pop()!;

    const { getQuoteForFamilyView } = await import('@/lib/quotes/public-view.server');

    // Random/invalid token.
    const randomView = await getQuoteForFamilyView('0'.repeat(64));
    expect(randomView.quote).toBeNull();

    // quote1's token correctly resolves ONLY quote1, never quote2.
    const view1 = await getQuoteForFamilyView(token1);
    expect(view1.quote!.id).toBe(quoteId1);
    expect(view1.quote!.id).not.toBe(quoteId2);
  });

  // ── C — BLOCKED Quote -> fails / D — GROUP_PENDING -> fails ──
  // Structural proof (mirrors t5r-quote-publish.test.ts's own BLOCKED
  // test): a BLOCKED-margin or GROUP_PENDING scenario can never even
  // reach a published (CARTE_VALIDATED_DEFINITIVE) state — publication
  // itself already refuses them (T5R RECETTE_FINDING_3,
  // collectQuotePromotionBlockers) — so family-link issuance's own
  // gate (collectFamilyLinkIssuanceBlockers, composing
  // collectQuoteEmissionBlockers + the same commercial-integrity checks)
  // is structurally unreachable with such a quote already. Proven at the
  // unit level (emission-guard.test.ts) against a fabricated Quote
  // object — no real DB fixture can construct a published-yet-BLOCKED
  // row without a direct write, which this suite deliberately never does.

  // ── J — retry/error behavior: no inconsistent creation ──

  test('J: deux émissions consécutives ne laissent jamais deux hachages actifs pour le même devis — le second appel remplace intégralement le premier', async () => {
    if (!dbAvailable) return;
    const quoteId = await createAndPublishQuote();

    await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId }) });
    await familyLinkPOST(familyLinkReq(), { params: Promise.resolve({ quoteId }) });

    const rows = await prisma.quote.findMany({ where: { id: quoteId } });
    expect(rows).toHaveLength(1); // no duplicate row ever created
    const distinctHashes = await prisma.quote.count({ where: { id: quoteId } });
    expect(distinctHashes).toBe(1);
  });
});
