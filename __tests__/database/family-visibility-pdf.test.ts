/**
 * DB integration test — FAMILY_VISIBILITY_INVARIANTS (P0-B) on the public
 * PDF surface (app/api/quotes/public/[token]/pdf/route.ts). Before this
 * fix, a Quote whose contactLeadId/studentId was null (detached, or never
 * set) fell through to a `'Non renseigné'` placeholder and still rendered
 * a PDF — this proves the route now fails closed (404) instead, real
 * Postgres, real onDelete: SetNull cascade, real PDF rendering path.
 */
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { testPrisma, setupTestDatabase, createTestParent, createTestStudent, canConnectToTestDb } from '../setup/test-database';
import { createQuote } from '@/lib/quotes/persistence.server';
import { GET as pdfPublicGET } from '@/app/api/quotes/public/[token]/pdf/route';
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
    snapshotRegles: { note: 'test fixture — P0-B pdf' },
  });
  await prisma.quote.update({
    where: { id: created.quote.id },
    data: { regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE', status: 'DEVIS_ENVOYE', sentAt: new Date() },
  });

  return { quoteId: created.quote.id, rawToken: created.rawToken!, contactLeadId: contactLead.id };
}

function pdfReq(token: string) {
  return new NextRequest(`http://localhost/api/quotes/public/${token}/pdf`);
}

describe('FAMILY_VISIBILITY_INVARIANTS on the public PDF route (P0-B)', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('public PDF FAMILY_VISIBILITY_INVARIANTS tests require a reachable PostgreSQL test database — DATABASE_TEST_MODE=REQUIRED, never a silent skip');
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

  test('healthy published quote: public PDF route returns a real PDF', async () => {
    const { rawToken } = await createPublishedCandidateQuote();
    const res = await pdfPublicGET(pdfReq(rawToken), { params: Promise.resolve({ token: rawToken }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });

  test('published quote + contactLead detached -> public PDF route fails closed (404), never a "Non renseigné" placeholder PDF', async () => {
    const { rawToken, contactLeadId } = await createPublishedCandidateQuote();
    await prisma.contactLead.delete({ where: { id: contactLeadId } });

    const res = await pdfPublicGET(pdfReq(rawToken), { params: Promise.resolve({ token: rawToken }) });
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).not.toBe('application/pdf');
  });
});
