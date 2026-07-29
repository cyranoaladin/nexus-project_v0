import 'server-only';

import { randomBytes, randomUUID } from 'crypto';
import type { GradeLevel, Prisma, Subject } from '@prisma/client';

import {
  appendBilanRequestEvent,
  type BilanRequestEventClient,
} from '@/lib/bilans/requests/events';
import type {
  BilanChildInput,
  BilanVerifiedParentChildCommand,
} from '@/lib/bilans/requests/schemas';

type AttachChildInput = Readonly<{
  parentUserId: string;
  parentProfileId: string;
  child: BilanChildInput;
  level: GradeLevel;
  subject: Subject;
}>;

export type AttachedNewChild = Readonly<{
  studentId: string;
  studentUserId: string;
}>;

function opaqueChildEmail(): string {
  return `child+${randomBytes(12).toString('hex')}@nexus-student.local`;
}

export async function attachChildToNewParent(
  transaction: Prisma.TransactionClient,
  input: AttachChildInput,
): Promise<AttachedNewChild> {
  const studentUser = await transaction.user.create({
    data: {
      email: opaqueChildEmail(),
      role: 'ELEVE',
      firstName: input.child.firstName,
      lastName: input.child.lastName ?? null,
      password: null,
      activatedAt: null,
    },
    select: {
      id: true,
    },
  });

  const student = await transaction.student.create({
    data: {
      parentId: input.parentProfileId,
      userId: studentUser.id,
      grade: input.level,
      gradeLevel: input.level,
      academicTrack: 'EDS_GENERALE',
      specialties: [input.subject],
      school: input.child.schoolName ?? null,
    },
    select: {
      id: true,
    },
  });

  await transaction.parentStudentLink.create({
    data: {
      parentUserId: input.parentUserId,
      studentId: student.id,
      state: 'PENDING_PARENT_CONSENT',
    },
  });

  return {
    studentId: student.id,
    studentUserId: studentUser.id,
  };
}

export class BilanChildAttachmentError extends Error {
  constructor(public readonly code: string) {
    super('Bilan child attachment denied');
    this.name = 'BilanChildAttachmentError';
  }
}

type VerifiedChildPrisma = Readonly<{
  $transaction: (
    callback: (transaction: Prisma.TransactionClient) => Promise<VerifiedChildAttachment>,
    options: Readonly<{ isolationLevel: 'Serializable' }>,
  ) => Promise<VerifiedChildAttachment>;
}>;

type VerifiedChildAttachment = Readonly<{
  attached: boolean;
  studentId: string;
}>;

type AttachChildToVerifiedRequestInput = Readonly<{
  prisma: VerifiedChildPrisma;
  requestId: string;
  parentUserId: string;
  command: BilanVerifiedParentChildCommand;
  existingSessionFlowTokenHash?: string;
  now?: Date;
}>;

function childAttachmentError(code: string): BilanChildAttachmentError {
  return new BilanChildAttachmentError(code);
}

function isRetryableConflict(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2034';
}

async function attachVerifiedChildInTransaction(
  transaction: Prisma.TransactionClient,
  input: Omit<AttachChildToVerifiedRequestInput, 'prisma' | 'now'>,
  now: Date,
): Promise<VerifiedChildAttachment> {
  const request = await transaction.bilanRequest.findFirst({
    where: {
      id: input.requestId,
      parentUserId: input.parentUserId,
      accountVerificationState: input.existingSessionFlowTokenHash
        ? { in: ['VERIFICATION_PENDING', 'VERIFIED'] }
        : 'VERIFIED',
      status: { notIn: ['CANCELLED', 'HUMAN_FOLLOWUP_REQUIRED'] },
      parentUser: {
        is: {
          role: 'PARENT',
          activatedAt: { not: null },
        },
      },
      ...(input.existingSessionFlowTokenHash
        ? {
          flowSessions: {
            some: {
              tokenHash: input.existingSessionFlowTokenHash,
              revokedAt: null,
              expiresAt: { gt: now },
            },
          },
        }
        : {}),
    },
    select: {
      id: true,
      parentUserId: true,
      accountVerificationState: true,
      status: true,
      studentId: true,
      gradeLevel: true,
      subject: true,
    },
  });
  if (
    !request
    || request.parentUserId !== input.parentUserId
    || (
      request.accountVerificationState !== 'VERIFIED'
      && !(
        input.existingSessionFlowTokenHash
        && request.accountVerificationState === 'VERIFICATION_PENDING'
      )
    )
    || request.status === 'CANCELLED'
    || request.status === 'HUMAN_FOLLOWUP_REQUIRED'
  ) {
    throw childAttachmentError('BILAN_CHILD_ACCESS_DENIED');
  }

  if (request.accountVerificationState === 'VERIFICATION_PENDING') {
    const flowTokenHash = input.existingSessionFlowTokenHash;
    if (!flowTokenHash) {
      throw childAttachmentError('BILAN_CHILD_ACCESS_DENIED');
    }
    const verified = await transaction.bilanRequest.updateMany({
      where: {
        id: input.requestId,
        parentUserId: input.parentUserId,
        accountVerificationState: 'VERIFICATION_PENDING',
        status: { notIn: ['CANCELLED', 'HUMAN_FOLLOWUP_REQUIRED'] },
        flowSessions: {
          some: {
            tokenHash: flowTokenHash,
            revokedAt: null,
            expiresAt: { gt: now },
          },
        },
      },
      data: {
        accountVerificationState: 'VERIFIED',
        lastActivityAt: now,
      },
    });
    if (verified.count !== 1) {
      throw childAttachmentError('BILAN_REQUEST_OWNERSHIP_CHANGED');
    }
    await appendBilanRequestEvent(
      transaction as unknown as BilanRequestEventClient,
      {
        requestId: input.requestId,
        type: 'ACCOUNT_VERIFIED',
        actor: 'PARENT_FLOW',
        correlationId: randomUUID(),
        payload: { methodCode: 'EXISTING_SESSION' },
      },
      { now },
    );
  }

  let studentId: string;
  let eventType: 'CHILD_SELECTED' | 'CHILD_CREATED';

  if (input.command.action === 'SELECT_EXISTING') {
    const links = await transaction.parentStudentLink.findMany({
      where: {
        parentUserId: input.parentUserId,
        studentId: input.command.studentId,
        state: 'VERIFIED',
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: {
        id: true,
        studentId: true,
      },
      take: 2,
    });
    if (links.length !== 1) {
      throw childAttachmentError(
        links.length > 1
          ? 'BILAN_CHILD_LINK_AMBIGUOUS'
          : 'BILAN_CHILD_ACCESS_DENIED',
      );
    }
    studentId = links[0].studentId;
    eventType = 'CHILD_SELECTED';

    if (
      request.studentId === studentId
      && request.status === 'READY_FOR_ASSESSMENT'
    ) {
      return { attached: false, studentId };
    }
  } else {
    if (request.studentId !== null || request.status !== 'NEW') {
      throw childAttachmentError('BILAN_REQUEST_NOT_MUTABLE');
    }
    const parentProfile = await transaction.parentProfile.findUnique({
      where: { userId: input.parentUserId },
      select: { id: true },
    });
    if (!parentProfile) {
      throw childAttachmentError('BILAN_CHILD_ACCESS_DENIED');
    }
    const studentUser = await transaction.user.create({
      data: {
        email: opaqueChildEmail(),
        role: 'ELEVE',
        firstName: input.command.child.firstName,
        lastName: input.command.child.lastName ?? null,
        password: null,
        activatedAt: null,
      },
      select: { id: true },
    });
    const student = await transaction.student.create({
      data: {
        parentId: parentProfile.id,
        userId: studentUser.id,
        grade: request.gradeLevel,
        gradeLevel: request.gradeLevel,
        academicTrack: 'EDS_GENERALE',
        specialties: [request.subject],
        school: input.command.child.schoolName ?? null,
      },
      select: { id: true },
    });
    await transaction.parentStudentLink.create({
      data: {
        parentUserId: input.parentUserId,
        studentId: student.id,
        state: 'VERIFIED',
        consentedAt: now,
        verifiedAt: now,
      },
      select: { id: true },
    });
    studentId = student.id;
    eventType = 'CHILD_CREATED';
  }

  if (request.studentId !== null || request.status !== 'NEW') {
    throw childAttachmentError('BILAN_REQUEST_NOT_MUTABLE');
  }
  const attached = await transaction.bilanRequest.updateMany({
    where: {
      id: input.requestId,
      parentUserId: input.parentUserId,
      accountVerificationState: 'VERIFIED',
      status: 'NEW',
      studentId: null,
      ...(input.existingSessionFlowTokenHash
        ? {
          flowSessions: {
            some: {
              tokenHash: input.existingSessionFlowTokenHash,
              revokedAt: null,
              expiresAt: { gt: now },
            },
          },
        }
        : {}),
    },
    data: {
      studentId,
      provisionalChildFirstName: null,
      provisionalChildLastName: null,
      provisionalChildSchoolName: null,
      status: 'READY_FOR_ASSESSMENT',
      lastActivityAt: now,
    },
  });
  if (attached.count !== 1) {
    throw childAttachmentError('BILAN_REQUEST_OWNERSHIP_CHANGED');
  }

  await appendBilanRequestEvent(
    transaction as unknown as BilanRequestEventClient,
    {
      requestId: input.requestId,
      type: eventType,
      actor: 'PARENT_FLOW',
      correlationId: randomUUID(),
      payload: { studentId },
    },
    { now },
  );
  return { attached: true, studentId };
}

export async function attachChildToVerifiedRequest(
  input: AttachChildToVerifiedRequestInput,
): Promise<VerifiedChildAttachment> {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) {
    throw childAttachmentError('BILAN_REQUEST_NOT_MUTABLE');
  }
  if (
    input.existingSessionFlowTokenHash !== undefined
    && !/^[a-f0-9]{64}$/.test(input.existingSessionFlowTokenHash)
  ) {
    throw childAttachmentError('BILAN_CHILD_ACCESS_DENIED');
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await input.prisma.$transaction(
        (transaction) => attachVerifiedChildInTransaction(
          transaction,
          {
            requestId: input.requestId,
            parentUserId: input.parentUserId,
            command: input.command,
            existingSessionFlowTokenHash: input.existingSessionFlowTokenHash,
          },
          now,
        ),
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (!isRetryableConflict(error) || attempt === 2) throw error;
    }
  }

  throw childAttachmentError('BILAN_REQUEST_NOT_MUTABLE');
}
