import { Prisma, type PrismaClient } from '@prisma/client';
import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

import { resolveSessionStudent } from './access';
import { CanonicalApiError } from './errors';
import { canonicalErrorResponse } from './http';
import {
  executeIdempotently,
  parseIdempotencyKey,
  type CanonicalTransaction,
  type IdempotencyDatabase,
} from './idempotency';
import { resolveEnabledPack, type EnabledBilanPack } from './pack-access';

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;
const requestSchema = z.object({ revision: z.number().int().nonnegative() }).strict();

type LockedAttempt = Readonly<{
  id: string;
  studentId: string;
  status: string;
  revision: number;
  expiresAt: Date;
  answers: unknown;
  assessmentPackId: string;
  assessmentPackVersion: string;
}>;

type SubmitTransaction = CanonicalTransaction & Pick<Prisma.TransactionClient,
  '$queryRaw' | 'canonicalAssessmentAttempt' | 'jobOutbox'>;

type SubmitDatabase = IdempotencyDatabase & Readonly<{
  student: PrismaClient['student'];
}>;

type SubmitAttemptDependencies = Readonly<{
  prisma: SubmitDatabase;
  authenticate: () => Promise<Session | null>;
  resolvePack: (slug: string, version?: number) => EnabledBilanPack | null;
  now: () => Date;
}>;

function submissionAnswers(value: unknown): Readonly<Record<string, Readonly<{
  optionId?: unknown;
  confidence?: unknown;
}>>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, Readonly<{ optionId?: unknown; confidence?: unknown }>>;
}

function assertComplete(attempt: LockedAttempt, pack: EnabledBilanPack): void {
  const answers = submissionAnswers(attempt.answers);
  for (const item of pack.pack.questionnaire.items) {
    const answer = answers[item.id];
    if (
      answer === undefined
      || typeof answer.optionId !== 'string'
      || !item.options.some(({ id }) => id === answer.optionId)
      || ![1, 2, 3, 4].includes(answer.confidence as number)
    ) throw CanonicalApiError.incompatible('ATTEMPT_INCOMPLETE');
  }
}

async function requestBody(request: NextRequest): Promise<z.infer<typeof requestSchema>> {
  try {
    return requestSchema.parse(await request.json());
  } catch {
    throw CanonicalApiError.badRequest();
  }
}

function transactionClient(transaction: CanonicalTransaction): SubmitTransaction {
  if (!('$queryRaw' in transaction) || !('canonicalAssessmentAttempt' in transaction) || !('jobOutbox' in transaction)) {
    throw new Error('Canonical submission transaction unavailable');
  }
  return transaction as SubmitTransaction;
}

const defaultDependencies: SubmitAttemptDependencies = {
  prisma: prisma as unknown as SubmitDatabase,
  authenticate: auth,
  resolvePack: resolveEnabledPack,
  now: () => new Date(),
};

export function createSubmitAttemptHandler(
  dependencies: SubmitAttemptDependencies = defaultDependencies,
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  return async (request, context) => {
    try {
      const input = await requestBody(request);
      const session = await dependencies.authenticate();
      const student = await resolveSessionStudent(session, dependencies.prisma as never);
      const key = parseIdempotencyKey(request.headers.get('idempotency-key'));
      const now = dependencies.now();
      const { id } = await context.params;

      const result = await executeIdempotently({
        prisma: dependencies.prisma,
        userId: session!.user.id,
        route: `POST:/api/bilans/attempts/${id}/submit`,
        key,
        now,
        action: async (transaction) => {
          const tx = transactionClient(transaction);
          const rows = await tx.$queryRaw<LockedAttempt[]>(Prisma.sql`
            SELECT
              "id", "studentId", "status", "revision", "expiresAt", "answers",
              "assessmentPackId", "assessmentPackVersion"
            FROM "canonical_assessment_attempts"
            WHERE "id" = ${id} AND "studentId" = ${student.id}
            FOR UPDATE
          `);
          const attempt = rows[0];
          if (attempt === undefined || attempt.status !== 'DRAFT') throw CanonicalApiError.notFound();
          if (attempt.expiresAt <= now) throw CanonicalApiError.conflict('ATTEMPT_EXPIRED');
          if (attempt.revision !== input.revision) {
            throw CanonicalApiError.conflict('REVISION_CONFLICT', { serverRevision: attempt.revision });
          }

          const packVersion = Number(attempt.assessmentPackVersion);
          const enabled = Number.isSafeInteger(packVersion)
            ? dependencies.resolvePack(attempt.assessmentPackId, packVersion)
            : null;
          if (enabled === null) throw CanonicalApiError.notFound();
          assertComplete(attempt, enabled);

          await tx.canonicalAssessmentAttempt.update({
            where: { id: attempt.id },
            data: { status: 'SUBMITTED', submittedAt: now, revision: { increment: 1 } },
          });
          await tx.jobOutbox.create({
            data: {
              jobType: 'SCORE_ATTEMPT',
              aggregateType: 'CanonicalAssessmentAttempt',
              aggregateId: attempt.id,
              sourceEventKey: `${attempt.id}.submitted`,
              idempotencyKey: `${attempt.id}.score`,
              payload: {
                attemptId: attempt.id,
                packSlug: enabled.pack.slug,
                packVersion: enabled.pack.version,
              },
            },
          });

          return {
            status: 200,
            body: {
              attemptId: attempt.id,
              status: 'SUBMITTED' as const,
              submittedAt: now.toISOString(),
              revision: input.revision + 1,
            },
          };
        },
      });

      return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
      return canonicalErrorResponse(error);
    }
  };
}
