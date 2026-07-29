import 'server-only';

import { createHash, randomUUID } from 'crypto';

import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { attachChildToNewParent } from '@/lib/bilans/requests/attach-child';
import {
  appendBilanRequestEvent,
  type BilanRequestEventClient,
} from '@/lib/bilans/requests/events';
import {
  bilanRequestAdmissionSchema,
  type BilanRequestAdmission,
} from '@/lib/bilans/requests/schemas';
import {
  createBilanFlowSessionToken,
  createBilanMagicLinkToken,
  type BilanFlowSessionToken,
  type BilanTokenMaterial,
} from '@/lib/bilans/requests/tokens';

export const GENERIC_SUCCESS_MESSAGE =
  'Votre demande a bien été enregistrée. Consultez votre email pour poursuivre.' as const;

export const BILAN_REQUEST_CREATED_PUBLIC_RESPONSE = {
  success: true,
  message: GENERIC_SUCCESS_MESSAGE,
  next: 'ASSESSMENT_OR_EMAIL',
} as const;

const DEFAULT_TEAM_NOTIFICATION_ADDRESS = 'pedagogie@nexusreussite.academy';
const IDEMPOTENCY_HASH_PREFIX = 'sha256:';
const idempotencyKeySchema = z.string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const teamNotificationAddressSchema = z.string().trim().email().max(254);

type BilanIntakePrisma = Pick<PrismaClient, '$transaction'>;

type CreateBilanRequestInput = Readonly<{
  prisma: BilanIntakePrisma;
  admission: unknown;
  idempotencyKey: unknown;
  now?: Date;
  production?: boolean;
  notificationRecipientAddress?: string;
}>;

type InternalIntakeEnvelope = Readonly<{
  requestId: string;
  replayed: boolean;
  flowSessionToken: BilanFlowSessionToken | null;
  magicLinkToken: BilanTokenMaterial | null;
}>;

export type CreateBilanRequestResult = Readonly<{
  public: typeof BILAN_REQUEST_CREATED_PUBLIC_RESPONSE;
  internal: InternalIntakeEnvelope;
}>;

function parseIdempotencyKey(value: unknown): string {
  const parsed = idempotencyKeySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Invalid bilan request idempotency key');
  }
  return parsed.data;
}

function hashIdempotencyKey(value: string): string {
  return `${IDEMPOTENCY_HASH_PREFIX}${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function resolveTeamNotificationAddress(value?: string): string {
  return teamNotificationAddressSchema.parse(
    value ?? process.env.BILAN_TEAM_NOTIFICATION_EMAIL ?? DEFAULT_TEAM_NOTIFICATION_ADDRESS,
  );
}

function isRetryablePrismaConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return error.code === 'P2002' || error.code === 'P2034';
}

function replayResult(requestId: string): CreateBilanRequestResult {
  return {
    public: BILAN_REQUEST_CREATED_PUBLIC_RESPONSE,
    internal: {
      requestId,
      replayed: true,
      flowSessionToken: null,
      magicLinkToken: null,
    },
  };
}

async function createInTransaction(
  prisma: BilanIntakePrisma,
  admission: BilanRequestAdmission,
  submissionHash: string,
  now: Date,
  production: boolean | undefined,
  notificationRecipientAddress: string,
): Promise<CreateBilanRequestResult> {
  return prisma.$transaction(async (transaction) => {
    const existingRequest = await transaction.bilanRequest.findUnique({
      where: {
        submissionHash,
      },
      select: {
        id: true,
      },
    });

    if (existingRequest) {
      return replayResult(existingRequest.id);
    }

    const existingUser = await transaction.user.findFirst({
      where: {
        email: {
          equals: admission.parent.email,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

    let parentUserId: string | null = null;
    let studentId: string | null = null;
    const isExistingAccount = existingUser !== null;

    if (existingUser?.role === 'PARENT') {
      parentUserId = existingUser.id;
    } else if (!existingUser) {
      const parentUser = await transaction.user.create({
        data: {
          email: admission.parent.email,
          password: null,
          role: 'PARENT',
          firstName: admission.parent.firstName,
          lastName: admission.parent.lastName,
          phone: admission.parent.phone,
          activatedAt: null,
        },
        select: {
          id: true,
        },
      });
      parentUserId = parentUser.id;

      const parentProfile = await transaction.parentProfile.create({
        data: {
          userId: parentUser.id,
        },
        select: {
          id: true,
        },
      });

      const attachedChild = await attachChildToNewParent(transaction, {
        parentUserId: parentUser.id,
        parentProfileId: parentProfile.id,
        child: admission.child,
        level: admission.level,
        subject: admission.subject,
      });
      studentId = attachedChild.studentId;
    }

    const request = await transaction.bilanRequest.create({
      data: {
        parentUserId,
        studentId,
        provisionalChildFirstName: isExistingAccount ? admission.child.firstName : null,
        provisionalChildLastName: isExistingAccount
          ? admission.child.lastName ?? null
          : null,
        provisionalChildSchoolName: isExistingAccount
          ? admission.child.schoolName ?? null
          : null,
        subject: admission.subject,
        gradeLevel: admission.level,
        schoolYear: admission.schoolYear,
        mainNeed: admission.mainNeed,
        message: admission.message ?? null,
        acquisitionChannel: 'WEBSITE',
        consent: admission.consent,
        consentVersion: admission.consentVersion,
        consentedAt: now,
        status: 'NEW',
        accountVerificationState: 'VERIFICATION_PENDING',
        submissionHash,
        lastActivityAt: now,
      },
      select: {
        id: true,
      },
    });

    const correlationId = randomUUID();
    await appendBilanRequestEvent(
      transaction as unknown as BilanRequestEventClient,
      {
        requestId: request.id,
        type: 'REQUEST_CREATED',
        actor: 'SYSTEM',
        correlationId,
        payload: {
          acquisitionChannelCode: 'WEBSITE',
          subjectCode: admission.subject,
          gradeCode: admission.level,
        },
      },
      { now },
    );

    const flowSessionToken = createBilanFlowSessionToken({ now, production });
    const magicLinkToken = createBilanMagicLinkToken({ now });

    await transaction.bilanFlowSession.create({
      data: {
        requestId: request.id,
        tokenHash: flowSessionToken.tokenHash,
        expiresAt: flowSessionToken.expiresAt,
      },
    });
    await transaction.bilanMagicLink.create({
      data: {
        requestId: request.id,
        parentUserId,
        tokenHash: magicLinkToken.tokenHash,
        expiresAt: magicLinkToken.expiresAt,
      },
    });
    await transaction.notificationOutbox.create({
      data: {
        eventType: 'BILAN_REQUEST_CREATED',
        sourceEventKey: `bilan-request:${request.id}:created`,
        recipientKey: 'team:pedagogy',
        recipientAddress: notificationRecipientAddress,
        channel: 'EMAIL',
        payload: {
          requestId: request.id,
          templateKey: 'bilan-team-request-created-v1',
          subjectCode: admission.subject,
          gradeCode: admission.level,
        },
        availableAt: now,
      },
    });

    return {
      public: BILAN_REQUEST_CREATED_PUBLIC_RESPONSE,
      internal: {
        requestId: request.id,
        replayed: false,
        flowSessionToken,
        magicLinkToken,
      },
    };
  }, {
    isolationLevel: 'Serializable',
  });
}

export async function createBilanRequestIntake(
  input: CreateBilanRequestInput,
): Promise<CreateBilanRequestResult> {
  const admission = bilanRequestAdmissionSchema.parse(input.admission);
  const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
  const submissionHash = hashIdempotencyKey(idempotencyKey);
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) {
    throw new Error('Invalid bilan request date');
  }
  const notificationRecipientAddress = resolveTeamNotificationAddress(
    input.notificationRecipientAddress,
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await createInTransaction(
        input.prisma,
        admission,
        submissionHash,
        now,
        input.production,
        notificationRecipientAddress,
      );
    } catch (error) {
      if (!isRetryablePrismaConflict(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error('Unreachable bilan request intake state');
}
