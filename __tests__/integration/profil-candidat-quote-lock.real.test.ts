jest.unmock('@/lib/prisma');

import { PrismaClient } from '@prisma/client';
import { createQuote } from '@/lib/quotes/persistence.server';
import { updateProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import type { QuoteScenario } from '@/lib/quotes/schemas';
import {
  createTestParent,
  createTestStudent,
  testPrisma,
} from '../setup/test-database';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const disposableDatabase = databaseUrl.includes('127.0.0.1:5434/nexus_disposable_test');
const describeWithDisposablePostgres = disposableDatabase ? describe : describe.skip;

const observer = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const SCENARIO: QuoteScenario = {
  tier: 'RECOMMANDE',
  lines: [{
    subject: 'pilotage',
    label: 'Pilotage Nexus',
    modality: 'PILOTAGE',
    hoursPerMonth: 0,
    unitPriceMonthly: 150,
    priorityScore: Number.MAX_SAFE_INTEGER,
    priorityLabel: 'haute',
    reason: 'Socle',
  }],
  notRecommended: [],
  monthlyTotal: 112,
  grandTotal: 1500,
  months: 10,
  matchedOfferId: null,
  paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
  deposit: 380,
  lastInstallmentAmount: 112,
};

type IdentityFixture = {
  contactLeadId: string;
  studentId: string;
  studentUserId: string;
  parentProfileId: string;
  parentUserId: string;
};

const identityFixtures: IdentityFixture[] = [];

function updatedDraft(profile: { contactLeadId: string | null; studentId: string | null }) {
  return {
    contactLeadId: profile.contactLeadId,
    studentId: profile.studentId,
    publicInput: {
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'PHYSIQUE_CHIMIE',
      changementSpecialite: true,
    },
  };
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function expectTwoConcurrentDatabaseConnections(): Promise<void> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const rows = await observer.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'active'
    `;
    if ((rows[0]?.count ?? 0) >= 2) return;
    await pause(40);
  }
  throw new Error('Expected two concurrent PostgreSQL connections holding/waiting on the profile lock');
}

async function createProfile(id: string) {
  const { parentUser, parentProfile } = await createTestParent();
  const { studentUser, student } = await createTestStudent(parentProfile.id);
  const lead = await testPrisma.contactLead.create({
    data: {
      name: `Responsable ${id}`,
      email: ` ${parentUser.email!.toUpperCase()} `,
    },
  });
  identityFixtures.push({
    contactLeadId: lead.id,
    studentId: student.id,
    studentUserId: studentUser.id,
    parentProfileId: parentProfile.id,
    parentUserId: parentUser.id,
  });
  return observer.profilCandidat.create({
    data: {
      id,
      contactLeadId: lead.id,
      studentId: student.id,
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'PHYSIQUE_CHIMIE',
    },
  });
}

function quoteInput(
  profile: { id: string; updatedAt: Date; contactLeadId: string | null; studentId: string | null },
  idempotencyKey: string,
) {
  if (!profile.contactLeadId || !profile.studentId) throw new Error('Identity fixture is incomplete');
  return {
    idempotencyKey,
    source: 'STAFF_WORKSPACE' as const,
    contactLeadId: profile.contactLeadId,
    studentId: profile.studentId,
    examSession: 2027,
    budget: 150,
    strategy: 'MOST_COMPLETE' as const,
    scenario: SCENARIO,
    profilId: profile.id,
    expectedProfilUpdatedAt: profile.updatedAt,
  };
}

describeWithDisposablePostgres('ProfilCandidat/Quote lock protocol with two real PostgreSQL connections', () => {
  jest.setTimeout(20_000);

  beforeAll(async () => {
    await observer.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_hold_profile_update() RETURNS trigger AS $$
      BEGIN
        IF OLD.id LIKE 'race-patch-%' THEN PERFORM pg_sleep(1.5); END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await observer.$executeRawUnsafe(`
      CREATE TRIGGER test_hold_profile_update_trigger
      BEFORE UPDATE ON profils_candidats
      FOR EACH ROW EXECUTE FUNCTION test_hold_profile_update()
    `);
    await observer.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_hold_quote_insert() RETURNS trigger AS $$
      BEGIN
        IF NEW."profilId" LIKE 'race-quote-%' THEN PERFORM pg_sleep(1.5); END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await observer.$executeRawUnsafe(`
      CREATE TRIGGER test_hold_quote_insert_trigger
      BEFORE INSERT ON quotes
      FOR EACH ROW EXECUTE FUNCTION test_hold_quote_insert()
    `);
  });

  afterEach(async () => {
    await observer.quote.deleteMany({ where: { profilId: { startsWith: 'race-' } } });
    await observer.profilCandidat.deleteMany({ where: { id: { startsWith: 'race-' } } });
    const fixtures = identityFixtures.splice(0);
    await observer.contactLead.deleteMany({ where: { id: { in: fixtures.map((fixture) => fixture.contactLeadId) } } });
    await observer.student.deleteMany({ where: { id: { in: fixtures.map((fixture) => fixture.studentId) } } });
    await observer.user.deleteMany({ where: { id: { in: fixtures.map((fixture) => fixture.studentUserId) } } });
    await observer.parentProfile.deleteMany({ where: { id: { in: fixtures.map((fixture) => fixture.parentProfileId) } } });
    await observer.user.deleteMany({ where: { id: { in: fixtures.map((fixture) => fixture.parentUserId) } } });
  });

  afterAll(async () => {
    await observer.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_hold_profile_update_trigger ON profils_candidats');
    await observer.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_hold_profile_update()');
    await observer.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_hold_quote_insert_trigger ON quotes');
    await observer.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_hold_quote_insert()');
    await observer.$disconnect();
  });

  test('PATCH first commits its new version and a quote built from the stale version is rejected', async () => {
    const profile = await createProfile(`race-patch-${Date.now()}`);

    const patch = updateProfilCandidat(profile.id, updatedDraft(profile));
    await pause(120);
    const quote = createQuote(quoteInput(profile, `race-patch-quote-${Date.now()}`));

    await expectTwoConcurrentDatabaseConnections();
    await expect(patch).resolves.toMatchObject({ ok: true });
    await expect(quote).rejects.toThrow(/profil candidat modifié/i);
    await expect(observer.quote.count({ where: { profilId: profile.id } })).resolves.toBe(0);
  });

  test('Quote first commits its frozen snapshot and the competing PATCH is rejected', async () => {
    const profile = await createProfile(`race-quote-${Date.now()}`);

    const quote = createQuote(quoteInput(profile, `race-quote-create-${Date.now()}`));
    await pause(120);
    const patch = updateProfilCandidat(profile.id, updatedDraft(profile));

    await expectTwoConcurrentDatabaseConnections();
    await expect(quote).resolves.toMatchObject({ alreadyExisted: false });
    await expect(patch).resolves.toEqual({ ok: false, quoteExists: true });
    await expect(observer.quote.count({ where: { profilId: profile.id } })).resolves.toBe(1);
  });
});
