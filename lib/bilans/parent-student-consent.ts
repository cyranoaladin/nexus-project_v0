import { Prisma } from '@prisma/client';

const ACTIVE_STATES = ['PENDING_PARENT_CONSENT', 'VERIFIED'] as const;

type ParentStudentConsentTransaction = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | 'parentProfile' | 'parentStudentLink'
>;

type ConsentInput = Readonly<{
  transaction: ParentStudentConsentTransaction;
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

export class ParentStudentConsentError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'CONSENT_NOT_PENDING') {
    super(code);
    this.name = 'ParentStudentConsentError';
  }
}

async function lockOwnedStudent(input: ConsentInput): Promise<LockedStudent> {
  const parent = await input.transaction.parentProfile.findUnique({
    where: { userId: input.parentUserId },
    select: { id: true },
  });
  if (parent === null) throw new ParentStudentConsentError('NOT_FOUND');

  const rows = await input.transaction.$queryRaw<LockedStudent[]>(Prisma.sql`
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

async function expireElapsedLinks(input: ConsentInput): Promise<void> {
  await input.transaction.parentStudentLink.updateMany({
    where: {
      studentId: input.studentId,
      state: { in: [...ACTIVE_STATES] },
      expiresAt: { lte: input.now },
    },
    data: { state: 'EXPIRED' },
  });
}

async function revokeFormerParents(input: ConsentInput): Promise<void> {
  await input.transaction.parentStudentLink.updateMany({
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

function activeLinkWhere(input: ConsentInput) {
  return {
    parentUserId: input.parentUserId,
    studentId: input.studentId,
    state: { in: [...ACTIVE_STATES] },
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: input.now } },
    ],
  } satisfies Prisma.ParentStudentLinkWhereInput;
}

async function synchronizeOwnership(input: ConsentInput): Promise<void> {
  await lockOwnedStudent(input);
  await expireElapsedLinks(input);
  await revokeFormerParents(input);
}

export async function preparePendingParentStudentLink(input: ConsentInput): Promise<ConsentLink> {
  await synchronizeOwnership(input);

  const existing = await input.transaction.parentStudentLink.findFirst({
    where: activeLinkWhere(input),
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: { id: true, state: true, consentedAt: true, verifiedAt: true },
  });
  if (existing !== null) return existing;

  return input.transaction.parentStudentLink.create({
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

export async function verifyParentStudentConsent(input: ConsentInput): Promise<ConsentLink> {
  await synchronizeOwnership(input);

  const verified = await input.transaction.parentStudentLink.findFirst({
    where: {
      ...activeLinkWhere(input),
      state: 'VERIFIED',
    },
    orderBy: [{ verifiedAt: 'desc' }, { id: 'asc' }],
    select: { id: true, state: true, consentedAt: true, verifiedAt: true },
  });
  if (verified !== null) return verified;

  const pending = await input.transaction.parentStudentLink.findFirst({
    where: {
      ...activeLinkWhere(input),
      state: 'PENDING_PARENT_CONSENT',
    },
    orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (pending === null) throw new ParentStudentConsentError('CONSENT_NOT_PENDING');

  const transition = await input.transaction.parentStudentLink.updateMany({
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
  if (transition.count !== 1) throw new ParentStudentConsentError('CONSENT_NOT_PENDING');

  return {
    id: pending.id,
    state: 'VERIFIED',
    consentedAt: input.now,
    verifiedAt: input.now,
  };
}

export async function getParentStudentConsentStatus(input: ConsentInput): Promise<{
  state: ConsentLink['state'] | 'MISSING';
}> {
  await synchronizeOwnership(input);
  const link = await input.transaction.parentStudentLink.findFirst({
    where: {
      parentUserId: input.parentUserId,
      studentId: input.studentId,
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    select: { state: true },
  });
  return { state: link?.state ?? 'MISSING' };
}
