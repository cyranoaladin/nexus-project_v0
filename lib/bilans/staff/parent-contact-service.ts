import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

import {
  buildParentActivationEmail,
  createParentActivationToken,
  normalizeParentEmail,
} from '@/lib/auth/parent-activation';
import { createParentStudentConsentContext } from '@/lib/bilans/parent-student-consent';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { prisma } from '@/lib/prisma';

type ParentContactActor = Readonly<{ userId: string; role: string }>;
type ParentContactAction = ParentContactActor & Readonly<{ revisionId: string; email: string }>;

type ConsentSynchronizer = (
  transaction: Prisma.TransactionClient,
  input: Readonly<{ parentUserId: string; studentId: string; now: Date }>,
) => Promise<unknown>;

type ParentContactDatabase = Pick<PrismaClient, '$transaction'>;

export type ParentContactDependencies = Readonly<{
  prisma: ParentContactDatabase;
  now: () => Date;
  synchronizeConsent: ConsentSynchronizer;
}>;

const defaultDependencies: ParentContactDependencies = {
  prisma,
  now: () => new Date(),
  synchronizeConsent: (transaction, input) => (
    createParentStudentConsentContext(transaction).preparePending(input)
  ),
};

export class ParentContactError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ParentContactError';
  }
}

function assertAssistante(actor: ParentContactActor): string {
  if (actor.role !== 'ASSISTANTE' || !actor.userId.trim()) throw new ParentContactError('NOT_FOUND');
  return actor.userId;
}

function validatedEmail(value: string): string {
  const parsed = z.string().trim().email().max(160).safeParse(value);
  if (!parsed.success) throw new ParentContactError('PARENT_EMAIL_INVALID');
  return normalizeParentEmail(parsed.data);
}

function displayName(firstName: string | null, lastName: string | null): string {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Parent';
}

export type ParentContactCompletionResult = Readonly<{
  parentUserId: string;
  attachedExisting: boolean;
  activationQueued: boolean;
}>;

export async function completePaperEntryParentEmail(
  action: ParentContactAction,
  overrides: Partial<ParentContactDependencies> = {},
): Promise<ParentContactCompletionResult> {
  assertAssistante(action);
  const email = validatedEmail(action.email);
  const dependencies = { ...defaultDependencies, ...overrides };
  const now = dependencies.now();

  const result = await dependencies.prisma.$transaction(async (transaction) => {
    const revision = await transaction.reportRevision.findUnique({
      where: { id: action.revisionId },
      select: {
        reportArtifact: {
          select: {
            student: {
              select: {
                id: true,
                parent: {
                  select: {
                    id: true,
                    children: {
                      select: {
                        id: true,
                        user: { select: { firstName: true } },
                      },
                      orderBy: { createdAt: 'asc' },
                    },
                    user: {
                      select: {
                        id: true,
                        role: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        activatedAt: true,
                        mergedIntoUserId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const sourceProfile = revision?.reportArtifact.student.parent;
    const sourceParent = sourceProfile?.user;
    if (sourceProfile === undefined || sourceParent === undefined || sourceParent.role !== 'PARENT') {
      throw new ParentContactError('NOT_FOUND');
    }
    if (sourceParent.mergedIntoUserId !== null && sourceParent.mergedIntoUserId !== undefined) {
      throw new ParentContactError('PARENT_ACCOUNT_ALREADY_MERGED');
    }
    if (sourceParent.email !== null) throw new ParentContactError('PARENT_EMAIL_ALREADY_SET');

    const existing = await transaction.user.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
        activatedAt: true,
        parentProfile: { select: { id: true } },
      },
    });
    if (existing !== null && existing.role !== 'PARENT') {
      throw new ParentContactError('PARENT_EMAIL_ROLE_CONFLICT');
    }

    let parentUserId = sourceParent.id;
    let attachedExisting = false;
    let activationQueued = false;
    let activation: ReturnType<typeof createParentActivationToken> | null = null;

    if (existing === null) {
      activation = createParentActivationToken(now);
      await transaction.user.update({
        where: { id: sourceParent.id },
        data: {
          email,
          activationToken: activation.tokenHash,
          activationExpiry: activation.expiresAt,
          password: null,
          activatedAt: null,
          sessionVersion: { increment: 1 },
        },
      });
      activationQueued = true;
    } else {
      parentUserId = existing.id;
      attachedExisting = true;
      const targetProfileId = existing.parentProfile?.id
        ?? (await transaction.parentProfile.create({ data: { userId: existing.id } })).id;
      const moved = await transaction.student.updateMany({
        where: { parentId: sourceProfile.id },
        data: { parentId: targetProfileId },
      });
      if (moved.count !== sourceProfile.children.length) throw new ParentContactError('PARENT_ATTACH_CONFLICT');
      for (const child of sourceProfile.children) {
        await dependencies.synchronizeConsent(transaction, {
          parentUserId: existing.id,
          studentId: child.id,
          now,
        });
      }
      await transaction.user.update({
        where: { id: sourceParent.id },
        data: {
          mergedIntoUserId: existing.id,
          mergedAt: now,
          password: null,
          activatedAt: null,
          activationToken: null,
          activationExpiry: null,
          sessionVersion: { increment: 1 },
        },
      });
      if (existing.activatedAt === null) {
        activation = createParentActivationToken(now);
        await transaction.user.update({
          where: { id: existing.id },
          data: {
            activationToken: activation.tokenHash,
            activationExpiry: activation.expiresAt,
            sessionVersion: { increment: 1 },
          },
        });
        activationQueued = true;
      }
    }

    if (activation !== null) {
      const message = buildParentActivationEmail({
        parentName: displayName(sourceParent.firstName, sourceParent.lastName),
        childFirstName: sourceProfile.children[0]?.user?.firstName ?? 'votre enfant',
        rawToken: activation.rawToken,
      });
      await enqueueEmailIntent(transaction, {
        aggregateId: parentUserId,
        messageType: 'PARENT_ACTIVATION',
        dedupeKey: activation.tokenHash,
        to: email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    }

    return Object.freeze({ parentUserId, attachedExisting, activationQueued });
  });

  if (result.activationQueued) kickEmailOutboxDrain();
  return result;
}
