jest.unmock('@/lib/prisma');
const mockAuth = jest.fn();
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { declarePendingBankTransfer, type BankTransferDeclaration } from '@/lib/payments/bank-transfer-declaration';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/payments/bank-transfer/confirm/route';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { cleanupDisposableTestFixture } from '@/__tests__/helpers/real-db-fixture-cleanup';

const prefix = `transfer-${randomUUID()}`;
const parentId = `${prefix}-parent`;
const studentUserIds = [`${prefix}-child-a`, `${prefix}-child-b`];
const studentIds: string[] = [];
const oldMode = process.env.CORE_V2_AUTH_MODE;
let disposableVerified = false;
beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  disposableVerified = true;
  process.env.CORE_V2_AUTH_MODE = 'V1_ONLY';
  await prisma.user.create({ data: { id: parentId, role: 'PARENT', lastName: prefix } });
  const parent = await prisma.parentProfile.create({ data: { userId: parentId } });
  for (const id of studentUserIds) {
    await prisma.user.create({ data: { id, role: 'ELEVE', lastName: prefix } });
    studentIds.push((await prisma.student.create({ data: { userId: id, parentId: parent.id, gradeLevel: 'TERMINALE' } })).id);
  }
  mockAuth.mockResolvedValue({ user: { id: parentId, role: 'PARENT', firstName: 'Synthetic' } });
});
beforeEach(async () => {
  await prisma.notification.deleteMany({ where: { type: 'BANK_TRANSFER_DECLARED', data: { path: ['parentId'], equals: parentId } } });
  await prisma.payment.deleteMany({ where: { userId: parentId } });
});
afterAll(async () => {
  if (disposableVerified) {
    await prisma.notification.deleteMany({ where: { type: 'BANK_TRANSFER_DECLARED', data: { path: ['parentId'], equals: parentId } } });
    await prisma.payment.deleteMany({ where: { userId: parentId } });
    await cleanupDisposableTestFixture(prisma, { userIds: [parentId, ...studentUserIds] });
    await prisma.$disconnect();
  }
  if (oldMode === undefined) delete process.env.CORE_V2_AUTH_MODE; else process.env.CORE_V2_AUTH_MODE = oldMode;
});
function declare(studentId: string | null = studentIds[0]) {
  return POST(new NextRequest('http://localhost/api/payments/bank-transfer/confirm', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'pack', key: 'GRAND_ORAL', studentId, termsAccepted: true, termsVersion: 'synthetic-terms-v2' }),
  }));
}
function historical(metadata: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput, currency = 'TND') {
  return prisma.payment.create({ data: { userId: parentId, type: 'CREDIT_PACK', amount: 750, currency,
    description: 'Pack Grand Oral', method: 'bank_transfer', status: 'PENDING', metadata,
    termsVersion: 'synthetic-terms-v1', termsAcceptedAt: new Date('2026-01-01T00:00:00Z'),
  } });
}
test('same parent and price do not collapse two child beneficiaries', async () => {
  const first = await declare(studentIds[0]);
  const second = await declare(studentIds[1]);
  expect(first.status).toBe(200); expect(second.status).toBe(200);
  const bodies = await Promise.all([first.json(), second.json()]);
  expect(bodies[0].paymentId).not.toBe(bodies[1].paymentId);
  expect(await prisma.payment.count({ where: { userId: parentId } })).toBe(2);
});
test.each([
  ['other item', { itemKey: 'OTHER', itemType: 'pack' }, 'TND'],
  ['other item type', { itemKey: 'GRAND_ORAL', itemType: 'addon' }, 'TND'],
  ['missing beneficiary', { itemKey: 'GRAND_ORAL', itemType: 'pack' }, 'TND'],
  ['other currency', { itemKey: 'GRAND_ORAL', itemType: 'pack' }, 'EUR'],
] as const)('historical %s cannot acquire a new beneficiary by replay', async (_name, metadata, currency) => {
  const old = await historical(metadata, currency);
  const response = await declare();
  expect(response.status).toBe(200);
  expect((await response.json()).paymentId).not.toBe(old.id);
  expect(await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).toEqual(old);
});
test('an identical historical pack preserves every accepted term and metadata byte', async () => {
  const old = await historical({ itemKey: 'GRAND_ORAL', itemType: 'pack', studentId: studentIds[0] });
  const response = await declare();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ paymentId: old.id, alreadyExists: true });
  expect(await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).toEqual(old);
});
test('six concurrent declarations return one pending payment and one staff intent set', async () => {
  const staffCount = await prisma.user.count({ where: { role: { in: ['ADMIN', 'ASSISTANTE'] } } });
  // Make all non-transactional legacy lookups observe the same empty state.
  // A locked transaction uses its own delegate and never enters this barrier.
  const findFirst = prisma.payment.findFirst.bind(prisma.payment);
  let arrivals = 0;
  let release!: () => void;
  const allInitialReads = new Promise<void>(resolve => { release = resolve; });
  const lookup = jest.spyOn(prisma.payment, 'findFirst').mockImplementation(args => {
    const query = findFirst(args);
    const delayed = Promise.resolve(query).then(async result => {
      arrivals += 1;
      if (arrivals === 6) release();
      await allInitialReads;
      return result;
    });
    // Preserve Prisma's fluent relation surface while delaying only await/then.
    return new Proxy(query, {
      get(target, property) {
        return property === 'then' ? delayed.then.bind(delayed) : Reflect.get(target, property, target);
      },
    });
  });
  let responses: Awaited<ReturnType<typeof declare>>[];
  try {
    responses = await Promise.all(Array.from({ length: 6 }, () => declare()));
  } finally {
    lookup.mockRestore();
  }
  expect(responses.map(response => response.status)).toEqual(Array(6).fill(200));
  const bodies = await Promise.all(responses.map(response => response.json()));
  expect(new Set(bodies.map(body => body.paymentId)).size).toBe(1);
  expect(await prisma.payment.count({ where: { userId: parentId } })).toBe(1);
  expect(await prisma.notification.count({ where: { type: 'BANK_TRANSFER_DECLARED', data: { path: ['parentId'], equals: parentId } } })).toBe(staffCount);
});

test.each([
  ['SQL null', Prisma.DbNull], ['JSON null', Prisma.JsonNull], ['non-object JSON', 'invalid-fixture'],
  ['array JSON', []], ['missing student key', { itemKey: 'GRAND_ORAL', itemType: 'pack' }],
] as const)('%s metadata never proves an unassigned declaration identity', async (_name, metadata) => {
  const old = await historical(metadata);
  const response = await declare(null);
  expect(response.status).toBe(200);
  expect((await response.json()).paymentId).not.toBe(old.id);
  expect(await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).toEqual(old);
});

test('explicit JSON null beneficiary is an identity and preserves replay evidence', async () => {
  const old = await historical({ itemKey: 'GRAND_ORAL', itemType: 'pack', studentId: null });
  const response = await declare(null);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ paymentId: old.id, alreadyExists: true });
  expect(await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).toEqual(old);
});

test('notification failure rolls back the real pending payment; retry creates one declaration', async () => {
  const input: BankTransferDeclaration = { parentUserId: parentId, parentName: 'Synthetic', studentId: studentIds[0],
    itemType: 'pack', itemKey: 'GRAND_ORAL', catalog: { amount: 750, description: 'Pack Grand Oral', displayName: 'Pack Grand Oral' },
    termsVersion: 'synthetic-terms', clientIp: 'unknown', immediateExecution: false, now: new Date('2026-10-01T00:00:00Z') };
  // Ensure the failure sink exists without relying on another suite's staff fixture.
  const staffId = `${prefix}-fault-staff`;
  await prisma.user.create({ data: { id: staffId, role: 'ASSISTANTE', lastName: prefix } });
  try {
    const faultyTransaction = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(tx => work({
      ...tx, notification: { ...tx.notification, createMany: () => { throw new Error('SYNTHETIC_NOTIFICATION_FAILURE'); } },
    }));
    await expect(declarePendingBankTransfer(input, faultyTransaction)).rejects.toThrow('SYNTHETIC_NOTIFICATION_FAILURE');
    expect(await prisma.payment.count({ where: { userId: parentId } })).toBe(0);
    expect(await prisma.notification.count({ where: { type: 'BANK_TRANSFER_DECLARED', data: { path: ['parentId'], equals: parentId } } })).toBe(0);
    const first = await declarePendingBankTransfer(input);
    const retry = await declarePendingBankTransfer(input);
    expect(first.alreadyExists).toBe(false); expect(retry).toEqual({ paymentId: first.paymentId, alreadyExists: true });
    expect(await prisma.payment.count({ where: { userId: parentId } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: staffId, type: 'BANK_TRANSFER_DECLARED', data: { path: ['parentId'], equals: parentId } } })).toBe(1);
  } finally {
    await prisma.notification.deleteMany({ where: { userId: staffId } });
    await cleanupDisposableTestFixture(prisma, { userIds: [staffId] });
  }
});

test.each(['student-parent', 'profile-user'] as const)('%s reassignment waits for the declaration ownership transaction', async scope => {
  const otherParentId = `${prefix}-other-${scope}`;
  await prisma.user.create({ data: { id: otherParentId, role: 'PARENT', lastName: prefix } });
  const original = await prisma.parentProfile.findUniqueOrThrow({ where: { userId: parentId } });
  const otherProfile = scope === 'student-parent'
    ? await prisma.parentProfile.create({ data: { userId: otherParentId } }) : null;
  let release!: () => void;
  let locked!: () => void;
  const resume = new Promise<void>(resolve => { release = resolve; });
  const lookupReached = new Promise<void>(resolve => { locked = resolve; });
  const gatedTransaction = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(tx => work({
    ...tx, payment: new Proxy(tx.payment, {
      get(target, property) {
        if (property !== 'findFirst') return Reflect.get(target, property, target);
        return (args: Prisma.PaymentFindFirstArgs) => {
          locked();
          const query = target.findFirst(args);
          const delayed = resume.then(() => query);
          return new Proxy(query, { get(result, field) {
            return field === 'then' ? delayed.then.bind(delayed) : Reflect.get(result, field, result);
          } });
        };
      },
    }),
  }), { timeout: 15_000 });
  const input: BankTransferDeclaration = { parentUserId: parentId, parentName: 'Synthetic', studentId: studentIds[0],
    itemType: 'pack', itemKey: 'GRAND_ORAL', catalog: { amount: 750, description: 'Pack Grand Oral', displayName: 'Pack Grand Oral' },
    termsVersion: 'synthetic-terms', clientIp: 'unknown', immediateExecution: false, now: new Date('2026-10-01T00:00:00Z') };
  const declaration = declarePendingBankTransfer(input, gatedTransaction);
  let mutation: Promise<unknown> | undefined;
  try {
    await lookupReached;
    let disclosePid!: (pid: number) => void;
    const pidKnown = new Promise<number>(resolve => { disclosePid = resolve; });
    mutation = prisma.$transaction(async tx => {
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      disclosePid(backend.pid);
      return scope === 'student-parent'
        ? tx.student.update({ where: { id: studentIds[0] }, data: { parentId: otherProfile!.id } })
        : tx.parentProfile.update({ where: { id: original.id }, data: { userId: otherParentId } });
    });
    const pid = await pidKnown;
    let blocked = false;
    for (let attempt = 0; attempt < 250; attempt += 1) {
      const [lock] = await prisma.$queryRaw<{ blocked: boolean }[]>(Prisma.sql`
        SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid = ${pid} AND NOT granted) AS blocked
      `);
      if (lock.blocked) { blocked = true; break; }
    }
    expect(blocked).toBe(true);
    expect(await prisma.payment.count({ where: { userId: parentId } })).toBe(0);
    release();
    const result = await declaration;
    await mutation;
    expect(result.alreadyExists).toBe(false);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    expect(payment.metadata).toMatchObject({ studentId: studentIds[0] });
    // A subsequent declaration must refuse the now-changed ownership.
    await expect(declarePendingBankTransfer(input)).rejects.toThrow('BANK_TRANSFER_OWNERSHIP_DENIED');
    expect(await prisma.payment.count({ where: { userId: parentId } })).toBe(1);
  } finally {
    release();
    await declaration;
    if (mutation) await mutation;
    await prisma.student.update({ where: { id: studentIds[0] }, data: { parentId: original.id } });
    await prisma.parentProfile.update({ where: { id: original.id }, data: { userId: parentId } });
    await cleanupDisposableTestFixture(prisma, { userIds: [otherParentId] });
  }
});
