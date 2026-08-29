jest.unmock('@/lib/prisma');

import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  issueOrRotateFamilyLink,
  markQuoteConsultedIfSent,
  promoteQuoteToFamilyVisible,
} from '@/lib/quotes/persistence.server';
import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import {
  canConnectToTestDb,
  createTestParent,
  createTestStudent,
  setupTestDatabase,
  testPrisma,
} from '../setup/test-database';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const disposableDatabase = databaseUrl.includes('127.0.0.1:5434/nexus_disposable_test');
const describeWithDisposablePostgres = disposableDatabase ? describe : describe.skip;
const observer = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function pause(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function createReadyQuote(idempotencyPrefix: string) {
  const { parentProfile } = await createTestParent();
  const { student } = await createTestStudent(parentProfile.id);
  const lead = await testPrisma.contactLead.create({
    data: { name: 'Responsable concurrence', email: `${randomUUID()}@example.test` },
  });
  const profil = await testPrisma.profilCandidat.create({
    data: {
      contactLeadId: lead.id,
      studentId: student.id,
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'PHYSIQUE_CHIMIE',
    },
  });
  return testPrisma.quote.create({
    data: {
      publicTokenHash: `initial-${randomUUID()}`,
      publicTokenExpiresAt: new Date('2027-08-29T00:00:00.000Z'),
      idempotencyKey: `${idempotencyPrefix}-${randomUUID()}`,
      status: 'ESTIMATION',
      source: 'STAFF_WORKSPACE',
      contactLeadId: lead.id,
      studentId: student.id,
      profilId: profil.id,
      examSession: 2027,
      pricingVersion: 'test-pricing-v1',
      examPolicyVersion: 'test-exam-v1',
      snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
      snapshotRegles: { margin: { gate: 'MARGIN_OK' }, groupState: { state: 'NOT_APPLICABLE' } },
      budget: 250,
      strategy: 'MOST_COMPLETE',
      monthlyTotal: 250,
      grandTotal: 2500,
      validUntil: new Date('2027-08-29T00:00:00.000Z'),
    },
  });
}

describeWithDisposablePostgres('publication and family-link locks with two real PostgreSQL connections', () => {
  jest.setTimeout(30_000);

  beforeAll(async () => {
    if (!(await canConnectToTestDb())) throw new Error('Disposable PostgreSQL is required for concurrency tests');
  });

  beforeEach(async () => {
    await setupTestDatabase();
    await observer.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_hold_candidate_quote_mutation() RETURNS trigger AS $$
      BEGIN
        IF OLD.status = 'ESTIMATION' AND NEW.status = 'DEVIS_ENVOYE' THEN
          PERFORM pg_sleep(1.0);
        ELSIF OLD.status = 'DEVIS_ENVOYE' AND OLD."publicTokenHash" <> NEW."publicTokenHash" THEN
          PERFORM pg_sleep(1.0);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await observer.$executeRawUnsafe(`
      CREATE TRIGGER test_hold_candidate_quote_mutation_trigger
      BEFORE UPDATE ON quotes
      FOR EACH ROW EXECUTE FUNCTION test_hold_candidate_quote_mutation()
    `);
  });

  afterEach(async () => {
    await observer.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_hold_candidate_quote_mutation_trigger ON quotes');
    await observer.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_hold_candidate_quote_mutation()');
  });

  afterAll(async () => {
    await observer.$disconnect();
  });

  test('concurrent publish calls produce one commercial transition and one audit', async () => {
    const quote = await createReadyQuote('race-publish');

    const first = promoteQuoteToFamilyVisible(quote.id, 'staff-1');
    await pause(100);
    const second = promoteQuoteToFamilyVisible(quote.id, 'staff-2');
    const results = await Promise.all([first, second]);

    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ ok: true, alreadyPromoted: false }),
      expect.objectContaining({ ok: true, alreadyPromoted: true }),
    ]));
    await expect(testPrisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).resolves.toMatchObject({
      status: 'DEVIS_ENVOYE',
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
      sentAt: expect.any(Date),
    });
    await expect(testPrisma.quoteAuditLog.count({
      where: { quoteId: quote.id, action: 'PROMOTED_TO_FAMILY_VISIBLE' },
    })).resolves.toBe(1);
  });

  test('concurrent family-link rotations return one usable link and one explicit version conflict', async () => {
    const quote = await createReadyQuote('race-family-link');
    const published = await promoteQuoteToFamilyVisible(quote.id, 'staff-1');
    if (!published.ok) throw new Error(`Test setup publication failed: ${published.reasons.join(', ')}`);
    const expected = {
      updatedAt: published.quote.updatedAt,
      publicTokenHash: published.quote.publicTokenHash,
    };

    const first = issueOrRotateFamilyLink(quote.id, 'staff-1', expected);
    await pause(100);
    const second = issueOrRotateFamilyLink(quote.id, 'staff-2', expected);
    const results = await Promise.all([first, second]);

    const success = results.find((result) => result.ok);
    expect(success).toMatchObject({ ok: true, action: 'LINK_ISSUED' });
    expect(results).toContainEqual({ ok: false, conflict: true });
    await expect(testPrisma.quoteAuditLog.count({
      where: { quoteId: quote.id, action: { in: ['LINK_ISSUED', 'LINK_ROTATED'] } },
    })).resolves.toBe(1);

    if (!success?.ok) throw new Error('Expected one successful family link');
    const rawToken = new URL(success.familyUrl).pathname.split('/').pop();
    expect(rawToken).toBeTruthy();
    const current = await testPrisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    const { createHash } = await import('crypto');
    expect(createHash('sha256').update(rawToken!).digest('hex')).toBe(current.publicTokenHash);
  });

  test('consultation keeps publication idempotent and still permits a secure link rotation', async () => {
    const quote = await createReadyQuote('consulted-lifecycle');
    const published = await promoteQuoteToFamilyVisible(quote.id, 'staff-1');
    if (!published.ok) throw new Error(`Test setup publication failed: ${published.reasons.join(', ')}`);
    const initialLink = await issueOrRotateFamilyLink(quote.id, 'staff-1', {
      updatedAt: published.quote.updatedAt,
      publicTokenHash: published.quote.publicTokenHash,
    });
    if (!initialLink.ok) throw new Error('Test setup family-link issuance failed');

    await expect(markQuoteConsultedIfSent(quote.id)).resolves.toEqual(expect.any(Date));
    const consulted = await observer.quote.findUniqueOrThrow({ where: { id: quote.id } });

    await expect(promoteQuoteToFamilyVisible(quote.id, 'staff-2')).resolves.toMatchObject({
      ok: true,
      alreadyPromoted: true,
      quote: { status: 'DEVIS_CONSULTE' },
    });
    await expect(testPrisma.quoteAuditLog.count({
      where: { quoteId: quote.id, action: 'PROMOTED_TO_FAMILY_VISIBLE' },
    })).resolves.toBe(1);

    const rotated = await issueOrRotateFamilyLink(quote.id, 'staff-2', {
      updatedAt: consulted.updatedAt,
      publicTokenHash: consulted.publicTokenHash,
    });
    expect(rotated).toMatchObject({ ok: true, action: 'LINK_ROTATED' });
    await expect(observer.quote.findUniqueOrThrow({ where: { id: quote.id } })).resolves.toMatchObject({
      status: 'DEVIS_CONSULTE',
    });
  });

  test('a decimal rattrapage average survives an actual PostgreSQL round trip', async () => {
    const result = await createProfilCandidat({
      publicInput: {
        level: 'TERMINALE',
        examSession: 2027,
        modalite: 'A',
        specialite1: 'MATHEMATIQUES',
        specialite2: 'PHYSIQUE_CHIMIE',
        moyenneRattrapage: 8.5,
      },
    }, 'staff-1');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Test setup profile validation failed');
    const persisted = await observer.profilCandidat.findUniqueOrThrow({ where: { id: result.profil.id } });
    expect(persisted.moyenneRattrapage).toBe(8.5);
  });
});
