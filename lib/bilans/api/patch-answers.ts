import type { Prisma, PrismaClient } from '@prisma/client';
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
  type EnabledBilanPack,
  type PackResolver,
} from './pack-access';

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;

const selectedAnswerSchema = z.object({
  itemId: z.string().min(1),
  optionId: z.string().min(1),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
}).strict();

const clearedAnswerSchema = z.object({
  itemId: z.string().min(1),
  optionId: z.null(),
  confidence: z.null(),
}).strict();

const requestSchema = z.object({
  revision: z.number().int().nonnegative(),
  answers: z.array(z.union([selectedAnswerSchema, clearedAnswerSchema])).min(1),
}).strict().superRefine((input, context) => {
  const seen = new Set<string>();
  input.answers.forEach((answer, index) => {
    if (seen.has(answer.itemId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['answers', index, 'itemId'], message: 'Duplicate item' });
    }
    seen.add(answer.itemId);
  });
});

type StoredAttempt = Readonly<{
  id: string;
  studentId: string;
  status: string;
  revision: number;
  expiresAt: Date;
  assessmentPackId: string;
  assessmentPackVersion: string;
  answers: unknown;
}>;

type AttemptDelegate = Readonly<{
  findFirst(args: unknown): Promise<StoredAttempt | null>;
  updateMany(args: unknown): Promise<Readonly<{ count: number }>>;
}>;

type PatchAnswersDatabase = IdempotencyDatabase & Readonly<{
  student: PrismaClient['student'];
}>;

type PatchAnswersDependencies = Readonly<{
  prisma: PatchAnswersDatabase;
  authenticate: () => Promise<Session | null>;
  resolvePack: PackResolver;
  now: () => Date;
}>;

function attemptDelegate(transaction: CanonicalTransaction): AttemptDelegate {
  const delegate = transaction.canonicalAssessmentAttempt;
  if (typeof delegate !== 'object' || delegate === null || !('findFirst' in delegate) || !('updateMany' in delegate)) {
    throw new Error('Canonical attempt delegate unavailable');
  }
  return delegate as AttemptDelegate;
}

function answerRecord(value: unknown): Record<string, Prisma.JsonValue> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...value as Record<string, Prisma.JsonValue> };
}

function assertAnswersBelongToPack(
  input: z.infer<typeof requestSchema>,
  enabled: EnabledBilanPack,
): void {
  const items = new Map(enabled.pack.questionnaire.items.map((item) => [item.id, item]));
  for (const answer of input.answers) {
    const item = items.get(answer.itemId);
    if (item === undefined) throw CanonicalApiError.badRequest('ANSWER_ITEM_INVALID');
    if (answer.optionId !== null && !item.options.some((option) => option.id === answer.optionId)) {
      throw CanonicalApiError.badRequest('ANSWER_OPTION_INVALID');
    }
  }
}

async function requestBody(request: NextRequest): Promise<z.infer<typeof requestSchema>> {
  try {
    return requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof CanonicalApiError) throw error;
    throw CanonicalApiError.badRequest();
  }
}

const defaultDependencies: PatchAnswersDependencies = {
  prisma,
  authenticate: auth,
  resolvePack: resolveEnabledPack,
  now: () => new Date(),
};

export function createPatchAnswersHandler(
  dependencies: PatchAnswersDependencies = defaultDependencies,
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
        route: `PATCH:/api/bilans/attempts/${id}/answers`,
        key,
        now,
        action: async (transaction) => {
          const attempts = attemptDelegate(transaction);
          const attempt = await attempts.findFirst({
            where: { id, studentId: student.id },
            select: {
              id: true,
              studentId: true,
              status: true,
              revision: true,
              expiresAt: true,
              assessmentPackId: true,
              assessmentPackVersion: true,
              answers: true,
            },
          });
          if (attempt === null || attempt.status !== 'DRAFT') throw CanonicalApiError.notFound();
          if (attempt.expiresAt <= now) throw CanonicalApiError.conflict('ATTEMPT_EXPIRED');
          if (attempt.revision !== input.revision) {
            throw CanonicalApiError.conflict('REVISION_CONFLICT', { serverRevision: attempt.revision });
          }

          const enabled = assertAttemptPackEnabled(attempt, dependencies.resolvePack);
          assertAnswersBelongToPack(input, enabled);

          const merged = answerRecord(attempt.answers);
          for (const answer of input.answers) {
            merged[answer.itemId] = { optionId: answer.optionId, confidence: answer.confidence };
          }
          const updated = await attempts.updateMany({
            where: {
              id,
              studentId: student.id,
              status: 'DRAFT',
              revision: input.revision,
              expiresAt: { gt: now },
            },
            data: { answers: merged, revision: { increment: 1 } },
          });
          if (updated.count !== 1) {
            const current = await attempts.findFirst({ where: { id, studentId: student.id }, select: { revision: true } });
            if (current === null) throw CanonicalApiError.notFound();
            throw CanonicalApiError.conflict('REVISION_CONFLICT', { serverRevision: current.revision });
          }

          return {
            status: 200,
            body: { revision: input.revision + 1, savedItemIds: input.answers.map(({ itemId }) => itemId) },
          };
        },
      });

      return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
      return canonicalErrorResponse(error);
    }
  };
}
