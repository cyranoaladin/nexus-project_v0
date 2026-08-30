jest.unmock('@/lib/prisma');

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { findOrCaptureResponsableLeadInTransaction } from '@/lib/crm/contact-leads';
import { prisma } from '@/lib/prisma';

const PREFIX = 'ci-responsable-lock-';

function safeTestDatabase(): void {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
}

async function cleanup(): Promise<void> {
  const leads = await prisma.contactLead.findMany({
    where: { email: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = leads.map(({ id }) => id);
  if (ids.length > 0) {
    await prisma.jobOutbox.deleteMany({ where: { aggregateId: { in: ids } } });
  }
  await prisma.contactLead.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

describe('responsible ContactLead — real PostgreSQL concurrency', () => {
  beforeAll(async () => {
    safeTestDatabase();
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('serializes concurrent normalized email capture and creates exactly one lead', async () => {
    const email = `${PREFIX}same@example.test`;
    const payload = { name: 'Responsable Synthétique', email, source: 'STAFF_STUDENT_CREATION' };

    const [first, second] = await Promise.all([
      prisma.$transaction((tx) => findOrCaptureResponsableLeadInTransaction(tx, payload)),
      prisma.$transaction((tx) => findOrCaptureResponsableLeadInTransaction(tx, { ...payload, email: email.toUpperCase() })),
    ]);

    expect(first.id).toBe(second.id);
    expect(await prisma.contactLead.count({ where: { email: { equals: email, mode: 'insensitive' } } })).toBe(1);
  });

  it('rolls the governed lead and its outbox intent back with the caller transaction', async () => {
    const email = `${PREFIX}rollback@example.test`;

    await expect(prisma.$transaction(async (tx) => {
      await findOrCaptureResponsableLeadInTransaction(tx, {
        name: 'Responsable Rollback', email, source: 'STAFF_STUDENT_CREATION',
      });
      throw new Error('EXPECTED_TEST_ROLLBACK');
    })).rejects.toThrow('EXPECTED_TEST_ROLLBACK');

    expect(await prisma.contactLead.count({ where: { email } })).toBe(0);
  });
});
