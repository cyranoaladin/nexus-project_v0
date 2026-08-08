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
import {
  assertAttemptPackEnabled,
  resolveEnabledPack,
  type PackResolver,
} from './pack-access';
import { assertAttemptComplete, enqueueScoreJob } from './submission-core';

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
  canonicalAssessmentAttempt: PrismaClient['canonicalAssessmentAttempt'];
}>;

type SubmitAttemptDependencies = Readonly<{
  prisma: SubmitDatabase;
  authenticate: () => Promise<Session | null>;
  resolvePack: PackResolver;
  now: () => Date;
}>;

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
      const packIdentity = await dependencies.prisma.canonicalAssessmentAttempt.findFirst({
        where: { id, studentId: student.id },
        select: { assessmentPackId: true, assessmentPackVersion: true },
      });
      if (packIdentity === null) throw CanonicalApiError.notFound();
      const enabled = assertAttemptPackEnabled(packIdentity, dependencies.resolvePack);

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

          assertAttemptComplete(attempt.answers, enabled);

          await tx.canonicalAssessmentAttempt.update({
            where: { id: attempt.id },
            data: { status: 'SUBMITTED', submittedAt: now, revision: { increment: 1 } },
          });
          await enqueueScoreJob(tx, {
            attemptId: attempt.id,
            packSlug: enabled.pack.slug,
            packVersion: enabled.pack.version,
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
