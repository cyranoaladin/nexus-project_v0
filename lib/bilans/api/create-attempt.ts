import { randomBytes } from 'node:crypto';

import type { GradeLevel, PrismaClient, Subject } from '@prisma/client';
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

const CREATE_ROUTE = 'POST:/api/bilans/attempts';
const EXPIRY_GRACE_MINUTES = 5;

const requestSchema = z.object({ packSlug: z.string().min(1) }).strict();

const SUBJECTS: Readonly<Record<string, Subject>> = {
  MATHS: 'MATHEMATIQUES',
  MATHEMATIQUES: 'MATHEMATIQUES',
  NSI: 'NSI',
  FRANCAIS: 'FRANCAIS',
  PHILOSOPHIE: 'PHILOSOPHIE',
  HISTOIRE_GEO: 'HISTOIRE_GEO',
  ANGLAIS: 'ANGLAIS',
  ESPAGNOL: 'ESPAGNOL',
  PHYSIQUE_CHIMIE: 'PHYSIQUE_CHIMIE',
  SVT: 'SVT',
  SES: 'SES',
};

const LEVELS: Readonly<Record<string, GradeLevel>> = {
  TROISIEME: 'TROISIEME',
  SECONDE: 'SECONDE',
  PREMIERE: 'PREMIERE',
  TERMINALE: 'TERMINALE',
  POSTBAC: 'POSTBAC',
  AUTRE: 'AUTRE',
};

type CreateAttemptDatabase = PrismaClient | (IdempotencyDatabase & Readonly<Record<string, unknown>>);

type CreateAttemptDependencies = Readonly<{
  prisma: CreateAttemptDatabase;
  authenticate: () => Promise<Session | null>;
  resolvePack: (slug: string) => EnabledBilanPack | null;
  now: () => Date;
  generateSeed: () => string;
}>;

type AttemptCreateDelegate = Readonly<{
  create(args: Readonly<{ data: Readonly<Record<string, unknown>> }>): Promise<Readonly<{
    id: string;
    status: string;
    startedAt: Date;
    expiresAt: Date;
  }>>;
}>;

function attemptDelegate(transaction: CanonicalTransaction): AttemptCreateDelegate {
  const delegate = transaction.canonicalAssessmentAttempt;
  if (typeof delegate !== 'object' || delegate === null || !('create' in delegate)) {
    throw new Error('Canonical attempt delegate unavailable');
  }
  return delegate as AttemptCreateDelegate;
}

function scoringProvenance(engine: string): Readonly<{ id: string; version: string }> {
  const marker = engine.lastIndexOf('.v');
  if (marker < 1 || marker === engine.length - 2) throw CanonicalApiError.incompatible('PACK_SCORING_INVALID');
  return { id: engine.slice(0, marker), version: engine.slice(marker + 2) };
}

async function requestBody(request: NextRequest): Promise<z.infer<typeof requestSchema>> {
  try {
    return requestSchema.parse(await request.json());
  } catch {
    throw CanonicalApiError.badRequest();
  }
}

const defaultDependencies: CreateAttemptDependencies = {
  prisma,
  authenticate: auth,
  resolvePack: resolveEnabledPack,
  now: () => new Date(),
  generateSeed: () => randomBytes(32).toString('hex'),
};

export function createCreateAttemptHandler(
  dependencies: CreateAttemptDependencies = defaultDependencies,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    try {
      const input = await requestBody(request);
      const session = await dependencies.authenticate();
      const student = await resolveSessionStudent(session, dependencies.prisma as never);
      const enabled = dependencies.resolvePack(input.packSlug);
      if (enabled === null) throw CanonicalApiError.notFound();

      const key = parseIdempotencyKey(request.headers.get('idempotency-key'));
      const startedAt = dependencies.now();
      const expiresAt = new Date(
        startedAt.getTime()
          + (enabled.pack.questionnaire.targetDurationMin + EXPIRY_GRACE_MINUTES) * 60_000,
      );
      const subject = SUBJECTS[enabled.pack.subject];
      const gradeLevel = LEVELS[enabled.pack.level];
      if (subject === undefined || gradeLevel === undefined) {
        throw CanonicalApiError.incompatible('PACK_PROVENANCE_INVALID');
      }
      const scoring = scoringProvenance(enabled.pack.scoring.engine);

      const result = await executeIdempotently({
        prisma: dependencies.prisma as IdempotencyDatabase,
        userId: session!.user.id,
        route: CREATE_ROUTE,
        key,
        now: startedAt,
        action: async (transaction) => {
          const attempt = await attemptDelegate(transaction).create({
            data: {
              studentId: student.id,
              status: 'DRAFT',
              seed: dependencies.generateSeed(),
              startedAt,
              expiresAt,
              subject,
              gradeLevel,
              answers: {},
              submittedAt: null,
              curriculumId: `${enabled.pack.level.toLowerCase()}.${enabled.pack.subject.toLowerCase()}`,
              curriculumVersion: String(enabled.pack.version),
              assessmentPackId: enabled.pack.slug,
              assessmentPackVersion: String(enabled.pack.version),
              assessmentPackChecksum: enabled.checksum,
              scoringPolicyId: scoring.id,
              scoringPolicyVersion: scoring.version,
            },
          });
          return {
            status: 201,
            body: {
              attemptId: attempt.id,
              status: attempt.status,
              startedAt: attempt.startedAt.toISOString(),
              expiresAt: attempt.expiresAt.toISOString(),
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
