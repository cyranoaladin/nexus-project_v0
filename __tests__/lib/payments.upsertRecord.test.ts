import { PrismaClient } from '@prisma/client';
import { upsertPaymentRecord } from '@/lib/payments';

const prisma = new PrismaClient();

describe('upsertPaymentRecord', () => {
  const provider = 'test_provider';
  const externalId = 'idempotent-key-1';
  const userId = 'user-1';
  const packId = 1;

  beforeAll(async () => {
    // Clean test rows if exist
    await prisma.$executeRawUnsafe(
      'DELETE FROM "payment_records" WHERE provider = $1 AND "externalId" = $2',
      provider,
      externalId,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates on first call and updates on second call (idempotent)', async () => {
    const r1 = await upsertPaymentRecord(prisma, {
      provider,
      externalId,
      userId,
      packId,
      amountTnd: 100,
      status: 'created',
    });
    expect(r1.provider).toBe(provider);
    expect(r1.externalId).toBe(externalId);
    expect(r1.amountTnd).toBe(100);

    const r2 = await upsertPaymentRecord(prisma, {
      provider,
      externalId,
      userId,
      packId,
      amountTnd: 150,
      status: 'pending',
    });
    expect(r2.id).toBe(r1.id);
    expect(r2.amountTnd).toBe(150);
    expect(r2.status).toBe('pending');

    const count = await prisma.paymentRecord.count({
      where: { provider, externalId },
    });
    expect(count).toBe(1);
  });

  it('handles concurrent upserts without creating duplicates', async () => {
    const key = 'idempotent-key-2';
    await prisma.$executeRawUnsafe(
      'DELETE FROM "payment_records" WHERE provider = $1 AND "externalId" = $2',
      provider,
      key,
    );

    const [a, b] = await Promise.all([
      upsertPaymentRecord(prisma, { provider, externalId: key, userId, packId, amountTnd: 10, status: 'created' }),
      upsertPaymentRecord(prisma, { provider, externalId: key, userId, packId, amountTnd: 20, status: 'pending' }),
    ]);

    expect(a.id).toBeDefined();
    expect(b.id).toBe(a.id);

    const rows = await prisma.paymentRecord.findMany({ where: { provider, externalId: key } });
    expect(rows).toHaveLength(1);
    expect(rows[0].amountTnd === 10 || rows[0].amountTnd === 20).toBe(true);
  });
});

