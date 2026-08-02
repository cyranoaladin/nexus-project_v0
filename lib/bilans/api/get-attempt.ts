import type { PrismaClient } from '@prisma/client';
import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { permuteOptionsForDisplay } from '@/lib/bilans/passation/option-permutation';
import { prisma } from '@/lib/prisma';

import { resolveSessionStudent } from './access';
import { CanonicalApiError } from './errors';
import { canonicalErrorResponse } from './http';
import {
  assertAttemptPackEnabled,
  resolveEnabledPack,
  type PackResolver,
} from './pack-access';

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;

type StoredAttempt = Readonly<{
  id: string;
  studentId: string;
  status: string;
  seed: string;
  revision: number;
  expiresAt: Date;
  assessmentPackId: string;
  assessmentPackVersion: string;
  answers: unknown;
}>;

type GetAttemptDatabase = Readonly<{
  student: PrismaClient['student'];
  canonicalAssessmentAttempt: {
    findFirst(args: unknown): Promise<StoredAttempt | null>;
  };
}>;

type GetAttemptDependencies = Readonly<{
  prisma: GetAttemptDatabase;
  authenticate: () => Promise<Session | null>;
  resolvePack: PackResolver;
  now: () => Date;
}>;

type SavedAnswer = Readonly<{ optionId: string | null; confidence: 1 | 2 | 3 | 4 | null }>;

function savedAnswers(value: unknown): Readonly<Record<string, SavedAnswer>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  const parsed: Record<string, SavedAnswer> = {};
  for (const [itemId, candidate] of Object.entries(value)) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const answer = candidate as Record<string, unknown>;
    const optionId = typeof answer.optionId === 'string' ? answer.optionId : null;
    const confidence = [1, 2, 3, 4].includes(answer.confidence as number)
      ? answer.confidence as 1 | 2 | 3 | 4
      : null;
    parsed[itemId] = { optionId, confidence };
  }
  return parsed;
}

function displayTitle(subject: string, level: string): string {
  const subjectLabel = subject === 'MATHS' ? 'Mathématiques' : subject.replaceAll('_', ' ');
  const levelLabel = level.charAt(0) + level.slice(1).toLowerCase();
  return `${subjectLabel} · ${levelLabel}`;
}

const defaultDependencies: GetAttemptDependencies = {
  prisma,
  authenticate: auth,
  resolvePack: resolveEnabledPack,
  now: () => new Date(),
};

export function createGetAttemptHandler(
  dependencies: GetAttemptDependencies = defaultDependencies,
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  return async (_request, context) => {
    try {
      const session = await dependencies.authenticate();
      const student = await resolveSessionStudent(session, dependencies.prisma as never);
      const { id } = await context.params;
      const attempt = await dependencies.prisma.canonicalAssessmentAttempt.findFirst({
        where: { id, studentId: student.id },
        select: {
          id: true,
          studentId: true,
          status: true,
          seed: true,
          revision: true,
          expiresAt: true,
          assessmentPackId: true,
          assessmentPackVersion: true,
          answers: true,
        },
      });

      if (
        attempt === null
        || attempt.status !== 'DRAFT'
        || attempt.expiresAt <= dependencies.now()
      ) throw CanonicalApiError.notFound();

      const enabled = assertAttemptPackEnabled(attempt, dependencies.resolvePack);

      const answers = savedAnswers(attempt.answers);
      const items = enabled.pack.questionnaire.items.map((item) => ({
        id: item.id,
        prompt: item.questionText,
        options: permuteOptionsForDisplay(item.options, attempt.seed, item.id).map((option) => ({
          id: option.id,
          label: option.text,
        })),
        savedAnswer: answers[item.id] ?? { optionId: null, confidence: null },
      }));

      return NextResponse.json({
        attemptId: attempt.id,
        pack: {
          slug: enabled.pack.slug,
          version: enabled.pack.version,
          title: displayTitle(enabled.pack.subject, enabled.pack.level),
        },
        status: 'DRAFT',
        revision: attempt.revision,
        expiresAt: attempt.expiresAt.toISOString(),
        items,
      });
    } catch (error) {
      return canonicalErrorResponse(error);
    }
  };
}
