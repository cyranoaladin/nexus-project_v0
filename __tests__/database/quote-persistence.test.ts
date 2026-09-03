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
  getQuoteById,
  markQuoteConsultedIfSent,
  transitionQuoteStatus,
} from '@/lib/quotes/persistence.server';
import { ALWAYS_INCLUDED_PRIORITY_SCORE } from '@/lib/quotes/schemas';
import type { QuoteScenario } from '@/lib/quotes/schemas';

const prisma = testPrisma;

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

  test('transitionQuoteStatus enforces the transition graph server-side', async () => {
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

    const sent = await transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'DEVIS_ENVOYE' });
    expect(sent.status).toBe('DEVIS_ENVOYE');
    expect(sent.sentAt).not.toBeNull();

    await expect(
      transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'BILAN_A_FAIRE' }),
    ).rejects.toThrow(/Invalid quote status transition/);
  });

  test('markQuoteConsultedIfSent is atomic and never overwrites A_RAPPELER', async () => {
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

  test('createQuote persists the candidat-individuel fields (profilId/snapshotCarte/snapshotRegles/parcours/deposit/lastInstallmentAmount/regulatoryMaturity/paymentPolicy) when provided — the EXISTING engine extended, not a second one', async () => {
    if (!dbAvailable) return;
    const lead = await prisma.contactLead.create({
      data: { name: 'Amira Ben Salah', email: `amira.${randomUUID()}@example.com`, status: 'NEW' },
    });
    const profil = await prisma.profilCandidat.create({
      data: {
        contactLeadId: lead.id,
        level: 'TERMINALE',
        examSession: 2027,
        modalite: 'A',
        specialite1: 'MATHEMATIQUES',
        specialite2: 'NSI',
        createdByUserId: 'staff-1',
      },
    });

    const result = await createQuote({
      idempotencyKey: randomUUID(),
      source: 'STAFF_WORKSPACE',
      contactLeadId: lead.id,
      examSession: 2027,
      budget: 700,
      strategy: 'BEST_BALANCE',
      scenario,
      createdByUserId: 'staff-1',
      profilId: profil.id,
      snapshotCarte: { epreuves: [] },
      snapshotRegles: { parcoursPrincipal: 'P1_LIBRE_2ANS_MODALITE_A' },
      parcours: 'P1_LIBRE_2ANS_MODALITE_A',
      deposit: 0,
      lastInstallmentAmount: 620,
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
      paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
    });

    expect(result.quote.profilId).toBe(profil.id);
    expect(result.quote.snapshotCarte).toEqual({ epreuves: [] });
    expect(result.quote.parcours).toBe('P1_LIBRE_2ANS_MODALITE_A');
    expect(result.quote.deposit).toBe(0);
    expect(result.quote.lastInstallmentAmount).toBe(620);
    expect(result.quote.regulatoryMaturity).toBe('CARTE_VALIDATED_DEFINITIVE');
    expect(result.quote.paymentPolicy).toBe('ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS');
  });

  test('createQuote defaults regulatoryMaturity to LEGACY_ESTIMATE_UNVERIFIED and leaves the candidat-individuel fields null for a non-candidat-individuel (public simulator) quote — never a leaked default from another quote', async () => {
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

    expect(result.quote.profilId).toBeNull();
    expect(result.quote.parcours).toBeNull();
    expect(result.quote.deposit).toBeNull();
    expect(result.quote.regulatoryMaturity).toBe('LEGACY_ESTIMATE_UNVERIFIED');
    expect(result.quote.paymentPolicy).toBeNull();
  });

  test('getQuoteById returns the quote with lines and its linked ContactLead/Student, or null when unknown — never throws on a routine lookup miss', async () => {
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
      createdByUserId: 'staff-1',
    });

    const fetched = await getQuoteById(created.quote.id);
    expect(fetched?.id).toBe(created.quote.id);
    expect(fetched?.lines).toHaveLength(scenario.lines.length);
    expect(fetched?.student?.id).toBe(student.id);

    expect(await getQuoteById('nonexistent-id')).toBeNull();
  });

});
