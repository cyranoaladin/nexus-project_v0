import { Prisma } from '@prisma/client';

const ACTIVE_STATES = ['PENDING_PARENT_CONSENT', 'VERIFIED'] as const;

type ParentStudentConsentDatabase = Readonly<{
  $transaction<T>(action: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}>;

type ConsentOperationInput = Readonly<{
  parentUserId: string;
  studentId: string;
  now: Date;
}>;

type LockedStudent = Readonly<{
  id: string;
  parentId: string;
}>;

type ConsentLink = Readonly<{
  id: string;
  state: 'PENDING_PARENT_CONSENT' | 'VERIFIED' | 'REVOKED' | 'EXPIRED';
  consentedAt: Date | null;
  verifiedAt: Date | null;
}>;

export type ParentStudentConsentContext = Readonly<{
  transaction: Prisma.TransactionClient;
  preparePending(input: ConsentOperationInput): Promise<ConsentLink>;
  verify(input: ConsentOperationInput): Promise<ConsentLink>;
  getStatus(input: ConsentOperationInput): Promise<{ state: ConsentLink['state'] | 'MISSING' }>;
}>;

export class ParentStudentConsentError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'CONSENT_NOT_PENDING') {
    super(code);
    this.name = 'ParentStudentConsentError';
  }
}

async function lockOwnedStudent(
  transaction: Prisma.TransactionClient,
  input: ConsentOperationInput,
): Promise<LockedStudent> {
  const parent = await transaction.parentProfile.findUnique({
    where: { userId: input.parentUserId },
    select: { id: true },
  });
  if (parent === null) throw new ParentStudentConsentError('NOT_FOUND');

  const rows = await transaction.$queryRaw<LockedStudent[]>(Prisma.sql`
    SELECT "id", "parentId"
    FROM "students"
    WHERE "id" = ${input.studentId}
    FOR UPDATE
  `);
  const student = rows[0];
  if (student === undefined || student.parentId !== parent.id) {
    throw new ParentStudentConsentError('NOT_FOUND');
  }
  return student;
}

async function expireElapsedLinks(
  transaction: Prisma.TransactionClient,
  input: ConsentOperationInput,
): Promise<void> {
  await transaction.parentStudentLink.updateMany({
    where: {
      studentId: input.studentId,
      state: { in: [...ACTIVE_STATES] },
      expiresAt: { lte: input.now },
    },
    data: { state: 'EXPIRED' },
  });
}

async function revokeFormerParents(
  transaction: Prisma.TransactionClient,
  input: ConsentOperationInput,
): Promise<void> {
  await transaction.parentStudentLink.updateMany({
    where: {
      studentId: input.studentId,
      parentUserId: { not: input.parentUserId },
      state: { in: [...ACTIVE_STATES] },
    },
    data: {
      state: 'REVOKED',
      revokedAt: input.now,
      revokedReason: 'LEGACY_PARENT_CHANGED',
    },
  });
}

function activeLinkWhere(input: ConsentOperationInput): Prisma.ParentStudentLinkWhereInput {
  return {
    parentUserId: input.parentUserId,
    studentId: input.studentId,
    state: { in: [...ACTIVE_STATES] },
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: input.now } },
    ],
  };
}

async function synchronizeOwnership(
  transaction: Prisma.TransactionClient,
  input: ConsentOperationInput,
): Promise<void> {
  await lockOwnedStudent(transaction, input);
  await expireElapsedLinks(transaction, input);
  await revokeFormerParents(transaction, input);
}

async function preparePending(
  transaction: Prisma.TransactionClient,
  input: ConsentOperationInput,
): Promise<ConsentLink> {
  await synchronizeOwnership(transaction, input);
  const existing = await transaction.parentStudentLink.findFirst({
    where: activeLinkWhere(input),
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: { id: true, state: true, consentedAt: true, verifiedAt: true },
  });
  if (existing !== null) return existing;

  return transaction.parentStudentLink.create({
    data: {
      parentUserId: input.parentUserId,
      studentId: input.studentId,
      state: 'PENDING_PARENT_CONSENT',
      requestedAt: input.now,
      consentedAt: null,
      verifiedAt: null,
      revokedAt: null,
      revokedReason: null,
    },
    select: { id: true, state: true, consentedAt: true, verifiedAt: true },
  });
}

async function rereadLockedLink(
  transaction: Prisma.TransactionClient,
  input: ConsentOperationInput,
  linkId: string,
): Promise<ConsentLink | null> {
  const rows = await transaction.$queryRaw<ConsentLink[]>(Prisma.sql`
    SELECT "id", "state", "consentedAt", "verifiedAt"
    FROM "canonical_parent_student_links"
    WHERE "id" = ${linkId}
      AND "parentUserId" = ${input.parentUserId}
      AND "studentId" = ${input.studentId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

async function verify(
  transaction: Prisma.TransactionClient,
  input: ConsentOperationInput,
): Promise<ConsentLink> {
  await synchronizeOwnership(transaction, input);
  const alreadyVerified = await transaction.parentStudentLink.findFirst({
    where: { ...activeLinkWhere(input), state: 'VERIFIED' },
    orderBy: [{ verifiedAt: 'desc' }, { id: 'asc' }],
    select: { id: true, state: true, consentedAt: true, verifiedAt: true },
  });
  if (alreadyVerified !== null) return alreadyVerified;

  let pending = await transaction.parentStudentLink.findFirst({
    where: { ...activeLinkWhere(input), state: 'PENDING_PARENT_CONSENT' },
    orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (pending === null) {
    const prepared = await preparePending(transaction, input);
    if (prepared.state === 'VERIFIED') return prepared;
    pending = { id: prepared.id };
  }

  const transition = await transaction.parentStudentLink.updateMany({
    where: {
      id: pending.id,
      parentUserId: input.parentUserId,
      studentId: input.studentId,
      state: 'PENDING_PARENT_CONSENT',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: input.now } },
      ],
    },
    data: {
      state: 'VERIFIED',
      consentedAt: input.now,
      verifiedAt: input.now,
    },
  });
  if (transition.count === 1) {
    return { id: pending.id, state: 'VERIFIED', consentedAt: input.now, verifiedAt: input.now };
  }

  const current = await rereadLockedLink(transaction, input, pending.id);
  if (current?.state === 'VERIFIED') return current;
  throw new ParentStudentConsentError('CONSENT_NOT_PENDING');
}

async function getStatus(
  transaction: Prisma.TransactionClient,
  input: ConsentOperationInput,
): Promise<{ state: ConsentLink['state'] | 'MISSING' }> {
  await synchronizeOwnership(transaction, input);
  const link = await transaction.parentStudentLink.findFirst({
    where: { parentUserId: input.parentUserId, studentId: input.studentId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    select: { state: true },
  });
  return { state: link?.state ?? 'MISSING' };
}

export async function withParentStudentConsentTransaction<T>(
  database: ParentStudentConsentDatabase,
  action: (context: ParentStudentConsentContext) => Promise<T>,
): Promise<T> {
  return database.$transaction(async (transaction) => {
    const context: ParentStudentConsentContext = Object.freeze({
      transaction,
      preparePending: (input) => preparePending(transaction, input),
      verify: (input) => verify(transaction, input),
      getStatus: (input) => getStatus(transaction, input),
    });
    return action(context);
  });
}
