/**
 * DB integration tests for FAMILY_VISIBILITY_INVARIANTS (mission P0-B) —
 * real Postgres, real onDelete: SetNull cascades. Proves that a published
 * candidat-individuel quote stops being family-visible the moment its
 * Responsable (ContactLead) or Élève (Student) is detached, or its
 * ProfilCandidat is re-pointed at a different identity — and that the
 * legacy/public-simulator path (profilId null) is completely untouched.
 */
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { randomUUID } from 'crypto';
import { testPrisma, setupTestDatabase, createTestParent, createTestStudent, canConnectToTestDb } from '../setup/test-database';
import { createQuote } from '@/lib/quotes/persistence.server';
import { getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
import { ALWAYS_INCLUDED_PRIORITY_SCORE } from '@/lib/quotes/schemas';
import type { QuoteScenario } from '@/lib/quotes/schemas';

const prisma = testPrisma;

const scenario: QuoteScenario = {
  tier: 'RECOMMANDE',
  paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
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
  ],
  notRecommended: [],
  monthlyTotal: 150,
  grandTotal: 1500,
  months: 10,
  matchedOfferId: null,
  deposit: 375,
  lastInstallmentAmount: 150,
};

/** A ready-to-view candidat-individuel quote: CARTE_VALIDATED_DEFINITIVE, DEVIS_ENVOYE, with a real contactLead/student/profil identity chain. */
async function createPublishedCandidateQuote() {
  const { parentProfile } = await createTestParent();
  const { student } = await createTestStudent(parentProfile.id);
  const contactLead = await prisma.contactLead.create({
    data: { name: 'Famille Test', email: `family.${randomUUID()}@nexus-test.com` },
  });
  const profil = await prisma.profilCandidat.create({
    data: {
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'PHYSIQUE_CHIMIE',
      contactLeadId: contactLead.id,
      studentId: student.id,
    },
  });

  const created = await createQuote({
    idempotencyKey: randomUUID(),
    source: 'STAFF_WORKSPACE',
    contactLeadId: contactLead.id,
    studentId: student.id,
    profilId: profil.id,
    examSession: 2027,
    budget: 700,
    strategy: 'BEST_BALANCE',
    scenario,
    snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
    snapshotRegles: { note: 'test fixture — P0-B' },
  });
  await prisma.quote.update({
    where: { id: created.quote.id },
    data: { regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE', status: 'DEVIS_ENVOYE', sentAt: new Date() },
  });

  return { quoteId: created.quote.id, rawToken: created.rawToken!, contactLeadId: contactLead.id, studentId: student.id, profilId: profil.id };
}

describe('FAMILY_VISIBILITY_INVARIANTS (P0-B)', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('FAMILY_VISIBILITY_INVARIANTS tests require a reachable PostgreSQL test database — DATABASE_TEST_MODE=REQUIRED, never a silent skip');
    }
  }, 10000);

  beforeEach(async () => {
    await setupTestDatabase();
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  }, 30000);

  test('healthy published quote: family view PASS', async () => {
    const { rawToken, quoteId } = await createPublishedCandidateQuote();
    const { quote } = await getQuoteForFamilyView(rawToken);
    expect(quote).not.toBeNull();
    expect(quote!.id).toBe(quoteId);
  });

  test('published quote + contactLead detached (row deleted, FK SetNull) -> NOT_FOUND', async () => {
    const { rawToken, contactLeadId } = await createPublishedCandidateQuote();
    await prisma.contactLead.delete({ where: { id: contactLeadId } });

    const { quote, reason } = await getQuoteForFamilyView(rawToken);
    expect(quote).toBeNull();
    expect(reason).toBe('NOT_FOUND');
  });

  test('published quote + student detached (row deleted, FK SetNull) -> NOT_FOUND', async () => {
    const { rawToken, studentId } = await createPublishedCandidateQuote();
    // Cascade delete of the User row is what actually removes the Student
    // (Student.userId -> User onDelete: Cascade) — deleting the student
    // directly here is enough to exercise Quote.student's own SetNull.
    await prisma.student.delete({ where: { id: studentId } });

    const { quote, reason } = await getQuoteForFamilyView(rawToken);
    expect(quote).toBeNull();
    expect(reason).toBe('NOT_FOUND');
  });

  test('ProfilCandidat re-pointed at a different student after Quote creation -> NOT_FOUND (Quote.studentId diverges from profil.studentId)', async () => {
    const { rawToken, profilId } = await createPublishedCandidateQuote();
    const { parentProfile: otherParent } = await createTestParent();
    const { student: otherStudent } = await createTestStudent(otherParent.id);
    await prisma.profilCandidat.update({ where: { id: profilId }, data: { studentId: otherStudent.id } });

    const { quote, reason } = await getQuoteForFamilyView(rawToken);
    expect(quote).toBeNull();
    expect(reason).toBe('NOT_FOUND');
  });

  test('an expired token still returns NOT_FOUND-equivalent (EXPIRED), unaffected by identity checks', async () => {
    const { rawToken, quoteId } = await createPublishedCandidateQuote();
    await prisma.quote.update({ where: { id: quoteId }, data: { publicTokenExpiresAt: new Date(Date.now() - 1000) } });

    const { quote, reason } = await getQuoteForFamilyView(rawToken);
    expect(quote).toBeNull();
    expect(reason).toBe('EXPIRED');
  });

  test('non-regression: a legacy/public-simulator quote (profilId null, no studentId) is family-visible exactly as before', async () => {
    const created = await createQuote({
      idempotencyKey: randomUUID(),
      source: 'PUBLIC_SIMULATOR',
      examSession: 2027,
      budget: 500,
      strategy: 'BEST_BALANCE',
      scenario,
    });
    await prisma.quote.update({ where: { id: created.quote.id }, data: { status: 'DEVIS_ENVOYE', sentAt: new Date() } });

    const { quote } = await getQuoteForFamilyView(created.rawToken!);
    expect(quote).not.toBeNull();
    expect(quote!.id).toBe(created.quote.id);
  });
});
