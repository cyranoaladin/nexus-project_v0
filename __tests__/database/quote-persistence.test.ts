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
import { createQuote, getQuoteByPublicToken, transitionQuoteStatus, reviseQuote } from '@/lib/quotes/persistence.server';
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

  test('reviseQuote mutates in place before send, but creates a new row after send (never silently changes what the family already saw)', async () => {
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

    const editedScenario: QuoteScenario = { ...scenario, monthlyTotal: 900, grandTotal: 9000 };

    // Before send: in-place edit, same id.
    const editedInPlace = await reviseQuote({ quoteId: created.quote.id, scenario: editedScenario, actorUserId: 'staff-1' });
    expect(editedInPlace.id).toBe(created.quote.id);
    expect(editedInPlace.monthlyTotal).toBe(900);

    // After send: a new revision row, original untouched.
    await transitionQuoteStatus({ quoteId: created.quote.id, toStatus: 'DEVIS_ENVOYE' });
    const revised = await reviseQuote({
      quoteId: created.quote.id,
      scenario: { ...scenario, monthlyTotal: 1000, grandTotal: 10000 },
      actorUserId: 'staff-1',
    });

    expect(revised.id).not.toBe(created.quote.id);
    expect(revised.previousRevisionId).toBe(created.quote.id);
    expect(revised.revisionNumber).toBe(2);
    expect(revised.status).toBe('ESTIMATION');

    const original = await prisma.quote.findUniqueOrThrow({ where: { id: created.quote.id } });
    expect(original.monthlyTotal).toBe(900); // untouched by the revision
    expect(original.status).toBe('DEVIS_ENVOYE');
  });
});
