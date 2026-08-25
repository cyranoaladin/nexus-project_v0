/**
 * DB integration tests for the Quote persistence layer (CDC §24-26, §45-46).
 */
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { randomUUID } from 'crypto';
import {
  testPrisma,
  setupTestDatabase,
  createTestParent,
  createTestStudent,
  canConnectToTestDb,
} from '../setup/test-database';
import {
  createQuote,
  getQuoteByPublicToken,
  markQuoteConsultedIfSent,
  transitionQuoteStatus,
} from '@/lib/quotes/persistence.server';
import { QuoteNotEmittableError } from '@/lib/quotes/emission-guard';
import { ALWAYS_INCLUDED_PRIORITY_SCORE } from '@/lib/quotes/schemas';
import type { QuoteScenario } from '@/lib/quotes/schemas';

const prisma = testPrisma;

/**
 * Test-only helper: creates a minimal, structurally valid ProfilCandidat
 * and marks an already-created Quote as CARTE_VALIDATED_DEFINITIVE with
 * every prerequisite the emission guard checks (lib/quotes/emission-guard.ts)
 * — used only where a test's actual purpose (e.g. the status transition
 * graph) needs to get past the guard to exercise something else. createQuote
 * itself deliberately has no way to produce this state yet (Lot 5 correctif
 * §1/§2 — no code path today populates profilId/snapshotCarte).
 */
async function markQuoteComplete(quoteId: string): Promise<void> {
  const profil = await prisma.profilCandidat.create({
    data: {
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'PHYSIQUE_CHIMIE',
    },
  });
  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
      profilId: profil.id,
      snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
      snapshotRegles: { note: 'test fixture — Lot 5 correctif' },
    },
  });
}

const scenario: QuoteScenario = {
  tier: 'RECOMMANDE',
  lines: [
    {
      subject: 'pilotage',
      label: 'Nexus Libre — Pilotage',
      modality: 'PILOTAGE',
      hoursPerMonth: 0,
      unitPriceMonthly: 150,
      priorityScore: ALWAYS_INCLUDED_PRIORITY_SCORE,
      priorityLabel: 'haute',
      reason: 'Socle',
    },
    {
      subject: 'francais',
      label: 'Français',
      modality: 'GROUPE',
      hoursPerMonth: 8,
      unitPriceMonthly: 470,
      priorityScore: 100,
      priorityLabel: 'haute',
      reason: 'Priorité haute',
    },
  ],
  notRecommended: [{ subject: 'maths-anticipees', reason: 'bilan solide' }],
  monthlyTotal: 620,
  grandTotal: 6200,
  months: 10,
  matchedOfferId: null,
  deposit: 1550,
  lastInstallmentAmount: 620,
};

describe('Quote persistence', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping quote persistence tests: test database not available');
  }, 10000);

  beforeEach(async () => {
    if (!dbAvailable) return;
    await setupTestDatabase();
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  }, 30000);

  test('createQuote persists the quote, its lines, and an audit log entry', async () => {
    if (!dbAvailable) return;
    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id);

    const result = await createQuote({
      idempotencyKey: randomUUID(),
      source: 'PUBLIC_SIMULATOR',
      studentId: student.id,
      examSession: 2027,
      budget: 700,
      strategy: 'BEST_BALANCE',
      scenario,
    });

    expect(result.alreadyExisted).toBe(false);
    expect(result.rawToken).not.toBeNull();
    expect(result.quote.status).toBe('ESTIMATION');
    expect(result.quote.monthlyTotal).toBe(620);
    expect(result.quote.lines).toHaveLength(2);
    expect(result.quote.pricingVersion).toBeTruthy();
    expect(result.quote.examPolicyVersion).toBeTruthy();

    const auditLogs = await prisma.quoteAuditLog.findMany({ where: { quoteId: result.quote.id } });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('CREATED');
  });

  test('createQuote is idempotent: a retried request with the same key returns the existing row, never a duplicate', async () => {
    if (!dbAvailable) return;
    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id);
    const idempotencyKey = randomUUID();

    const first = await createQuote({
      idempotencyKey,
      source: 'PUBLIC_SIMULATOR',
      studentId: student.id,
      examSession: 2027,
      budget: 700,
      strategy: 'BEST_BALANCE',
      scenario,
    });
    const second = await createQuote({
      idempotencyKey,
      source: 'PUBLIC_SIMULATOR',
      studentId: student.id,
      examSession: 2027,
      budget: 700,
      strategy: 'BEST_BALANCE',
      scenario,
    });

    expect(second.alreadyExisted).toBe(true);
    expect(second.quote.id).toBe(first.quote.id);
    expect(second.rawToken).toBeNull(); // never re-issues the raw token

    const allQuotes = await prisma.quote.count();
    expect(allQuotes).toBe(1);
  });

  test('public quote creation atomically deduplicates the lead and notification under concurrent retries', async () => {
    if (!dbAvailable) return;
    const idempotencyKey = randomUUID();
    const input = {
      idempotencyKey,
      source: 'PUBLIC_SIMULATOR' as const,
      examSession: 2027,
      budget: 700,
      strategy: 'BEST_BALANCE' as const,
      scenario,
      contact: {
        name: 'Parent Retry',
        email: `retry-${idempotencyKey}@example.com`,
        phone: '+21699000000',
        profile: 'candidat_individuel',
        interest: 'Devis Bac',
        source: 'devis-bac',
        notes: 'Test idempotence',
        type: 'contact',
        consent: true,
      },
    };

    const [first, second] = await Promise.all([createQuote(input), createQuote(input)]);
    expect([first.alreadyExisted, second.alreadyExisted].sort()).toEqual([false, true]);
    expect(first.quote.id).toBe(second.quote.id);
    expect(await prisma.quote.count()).toBe(1);
    expect(await prisma.contactLead.count({ where: { email: input.contact.email } })).toBe(1);
    expect(await prisma.jobOutbox.count({ where: { aggregateType: 'CONTACT_LEAD' } })).toBe(1);
  });

  test('getQuoteByPublicToken resolves the raw token and never leaks cost/margin', async () => {
    if (!dbAvailable) return;
    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id);
    const created = await createQuote({
      idempotencyKey: randomUUID(),
      source: 'PUBLIC_SIMULATOR',
      studentId: student.id,
      examSession: 2027,
      budget: 700,
      strategy: 'BEST_BALANCE',
      scenario,
    });

    const lookup = await getQuoteByPublicToken(created.rawToken!);
    expect(lookup.quote?.id).toBe(created.quote.id);

    const json = JSON.stringify(lookup.quote).toLowerCase();
    for (const forbidden of ['teachercost', 'margin', 'grossmargin', 'internalfloor']) {
      expect(json).not.toContain(forbidden);
    }
  });

  test('getQuoteByPublicToken returns NOT_FOUND for a garbage token, never throws', async () => {
    if (!dbAvailable) return;
    const lookup = await getQuoteByPublicToken('this-token-does-not-exist');
    expect(lookup.quote).toBeNull();
    expect(lookup.reason).toBe('NOT_FOUND');
  });

  test('transitionQuoteStatus enforces the transition graph server-side (on a CARTE_VALIDATED_DEFINITIVE quote)', async () => {
    if (!dbAvailable) return;
    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id);
    const created = await createQuote({
      idempotencyKey: randomUUID(),
      source: 'STAFF_WORKSPACE',
      studentId: student.id,
      examSession: 2027,
      budget: 700,
      strategy: 'BEST_BALANCE',
      scenario,
    });
    await markQuoteComplete(created.quote.id);

    const sent = await transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'DEVIS_ENVOYE' });
    expect(sent.status).toBe('DEVIS_ENVOYE');
    expect(sent.sentAt).not.toBeNull();

    await expect(
      transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'BILAN_A_FAIRE' }),
    ).rejects.toThrow(/Invalid quote status transition/);
  });

  test('markQuoteConsultedIfSent is atomic and never overwrites A_RAPPELER (on a CARTE_VALIDATED_DEFINITIVE quote)', async () => {
    if (!dbAvailable) return;
    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id);
    const created = await createQuote({
      idempotencyKey: randomUUID(),
      source: 'STAFF_WORKSPACE',
      studentId: student.id,
      examSession: 2027,
      budget: 700,
      strategy: 'BEST_BALANCE',
      scenario,
    });
    await markQuoteComplete(created.quote.id);

    await transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'DEVIS_ENVOYE' });
    expect(await markQuoteConsultedIfSent(created.quote.id)).toBeInstanceOf(Date);

    const consulted = await prisma.quote.findUniqueOrThrow({ where: { id: created.quote.id } });
    expect(consulted.status).toBe('DEVIS_CONSULTE');
    expect(consulted.consultedAt).not.toBeNull();

    await transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'A_RAPPELER' });
    expect(await markQuoteConsultedIfSent(created.quote.id)).toBeNull();

    const stillFollowUp = await prisma.quote.findUniqueOrThrow({ where: { id: created.quote.id } });
    expect(stillFollowUp.status).toBe('A_RAPPELER');
  });

  // ── Lot 5 correctif de sécurité §1/§2/§3 — emission guard, real DB ──

  describe('emission guard (regulatoryMaturity) — fail-closed, DB-level', () => {
    test('ancien devis (créé avant la migration, simulé par un INSERT sans regulatoryMaturity explicite) : défaut LEGACY_ESTIMATE_UNVERIFIED', async () => {
      if (!dbAvailable) return;
      const { parentProfile } = await createTestParent();
      const { student } = await createTestStudent(parentProfile.id);
      const created = await createQuote({
        idempotencyKey: randomUUID(),
        source: 'STAFF_WORKSPACE',
        studentId: student.id,
        examSession: 2027,
        budget: 700,
        strategy: 'BEST_BALANCE',
        scenario,
      });
      // Simulates a row that predates this column's introduction: an UPDATE
      // that never touches regulatoryMaturity must leave Postgres's own
      // column default in place, never silently become anything else.
      await prisma.$executeRawUnsafe(`UPDATE quotes SET budget = 701 WHERE id = $1`, created.quote.id);
      const reread = await prisma.quote.findUniqueOrThrow({ where: { id: created.quote.id } });
      expect(reread.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED');
    });

    test('nouveau devis créé depuis le chemin legacy (createQuote, sans profil/carte) : LEGACY_ESTIMATE_UNVERIFIED par défaut', async () => {
      if (!dbAvailable) return;
      const { parentProfile } = await createTestParent();
      const { student } = await createTestStudent(parentProfile.id);
      const created = await createQuote({
        idempotencyKey: randomUUID(),
        source: 'PUBLIC_SIMULATOR',
        studentId: student.id,
        examSession: 2027,
        budget: 700,
        strategy: 'BEST_BALANCE',
        scenario,
      });
      expect(created.quote.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED');
    });

    test('devis complet (profilId + snapshotCarte valide + snapshotRegles + maturité) : envoi et acceptation autorisés', async () => {
      if (!dbAvailable) return;
      const { parentProfile } = await createTestParent();
      const { student } = await createTestStudent(parentProfile.id);
      const created = await createQuote({
        idempotencyKey: randomUUID(),
        source: 'STAFF_WORKSPACE',
        studentId: student.id,
        examSession: 2027,
        budget: 700,
        strategy: 'BEST_BALANCE',
        scenario,
      });
      await markQuoteComplete(created.quote.id);

      const sent = await transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'DEVIS_ENVOYE' });
      expect(sent.status).toBe('DEVIS_ENVOYE');

      const accepted = await transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'ACCEPTE' });
      expect(accepted.status).toBe('ACCEPTE');
    });

    test('devis sans profil (profilId null) : envoi refusé même si le reste est renseigné', async () => {
      if (!dbAvailable) return;
      const { parentProfile } = await createTestParent();
      const { student } = await createTestStudent(parentProfile.id);
      const created = await createQuote({
        idempotencyKey: randomUUID(),
        source: 'STAFF_WORKSPACE',
        studentId: student.id,
        examSession: 2027,
        budget: 700,
        strategy: 'BEST_BALANCE',
        scenario,
      });
      await prisma.quote.update({
        where: { id: created.quote.id },
        data: {
          regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
          snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
          snapshotRegles: { note: 'test' },
          // profilId intentionally left null
        },
      });

      await expect(
        transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'DEVIS_ENVOYE' }),
      ).rejects.toBeInstanceOf(QuoteNotEmittableError);
    });

    test('devis avec carte bloquée (snapshotCarte.emissionAutomatiqueAutorisee=false) : envoi refusé', async () => {
      if (!dbAvailable) return;
      const { parentProfile } = await createTestParent();
      const { student } = await createTestStudent(parentProfile.id);
      const created = await createQuote({
        idempotencyKey: randomUUID(),
        source: 'STAFF_WORKSPACE',
        studentId: student.id,
        examSession: 2027,
        budget: 700,
        strategy: 'BEST_BALANCE',
        scenario,
      });
      await markQuoteComplete(created.quote.id);
      await prisma.quote.update({
        where: { id: created.quote.id },
        data: { snapshotCarte: { emissionAutomatiqueAutorisee: false, necessiteVerificationHumaine: true } },
      });

      await expect(
        transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'DEVIS_ENVOYE' }),
      ).rejects.toBeInstanceOf(QuoteNotEmittableError);
    });

    test('devis nécessitant une revue humaine (necessiteVerificationHumaine=true) : envoi refusé même si emissionAutomatiqueAutorisee=true', async () => {
      if (!dbAvailable) return;
      const { parentProfile } = await createTestParent();
      const { student } = await createTestStudent(parentProfile.id);
      const created = await createQuote({
        idempotencyKey: randomUUID(),
        source: 'STAFF_WORKSPACE',
        studentId: student.id,
        examSession: 2027,
        budget: 700,
        strategy: 'BEST_BALANCE',
        scenario,
      });
      await markQuoteComplete(created.quote.id);
      await prisma.quote.update({
        where: { id: created.quote.id },
        data: { snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: true } },
      });

      await expect(
        transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'DEVIS_ENVOYE' }),
      ).rejects.toBeInstanceOf(QuoteNotEmittableError);
    });

    test('acceptation refusée pour un devis provisoire déjà DEVIS_ENVOYE (simulant un devis envoyé avant ce correctif)', async () => {
      if (!dbAvailable) return;
      const { parentProfile } = await createTestParent();
      const { student } = await createTestStudent(parentProfile.id);
      const created = await createQuote({
        idempotencyKey: randomUUID(),
        source: 'PUBLIC_SIMULATOR',
        studentId: student.id,
        examSession: 2027,
        budget: 700,
        strategy: 'BEST_BALANCE',
        scenario,
      });
      // Bypasses transitionQuoteStatus deliberately — simulates a quote sent
      // before this guard existed, still legacy-maturity, sitting in
      // DEVIS_ENVOYE. The real-world attack surface is exactly this: a
      // family trying to accept such a quote today via /api/quotes/[id]/accept.
      await prisma.quote.update({ where: { id: created.quote.id }, data: { status: 'DEVIS_ENVOYE' } });

      await expect(
        transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'ACCEPTE' }),
      ).rejects.toBeInstanceOf(QuoteNotEmittableError);
    });

    test('sérialisation : regulatoryMaturity survit à un aller-retour JSON.stringify/parse', async () => {
      if (!dbAvailable) return;
      const { parentProfile } = await createTestParent();
      const { student } = await createTestStudent(parentProfile.id);
      const created = await createQuote({
        idempotencyKey: randomUUID(),
        source: 'PUBLIC_SIMULATOR',
        studentId: student.id,
        examSession: 2027,
        budget: 700,
        strategy: 'BEST_BALANCE',
        scenario,
      });
      const roundTripped = JSON.parse(JSON.stringify(created.quote));
      expect(roundTripped.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED');
    });

    test('lecture publique (getQuoteByPublicToken) expose regulatoryMaturity — nécessaire à la bannière de confinement', async () => {
      if (!dbAvailable) return;
      const { parentProfile } = await createTestParent();
      const { student } = await createTestStudent(parentProfile.id);
      const created = await createQuote({
        idempotencyKey: randomUUID(),
        source: 'PUBLIC_SIMULATOR',
        studentId: student.id,
        examSession: 2027,
        budget: 700,
        strategy: 'BEST_BALANCE',
        scenario,
      });
      const lookup = await getQuoteByPublicToken(created.rawToken!);
      expect(lookup.quote?.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED');
    });
  });
});
