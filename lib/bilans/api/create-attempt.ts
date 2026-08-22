import { randomBytes } from 'node:crypto';

import type { PrismaClient, Subject } from '@prisma/client';
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
import { assertStudentPackLevel } from './student-pack-level';

export { resolvePrismaGradeLevel } from './student-pack-level';

const CREATE_ROUTE = 'POST:/api/bilans/attempts';
const EXPIRY_GRACE_MINUTES = 5;

const requestSchema = z.object({ packSlug: z.string().min(1) }).strict();

const SUBJECTS: Readonly<Record<string, Subject>> = {
  MATHS: 'MATHEMATIQUES',
  MATHEMATIQUES: 'MATHEMATIQUES',
  // Le domaine Prisma historique ne distingue pas l'option complémentaire.
  // L'identité fine reste portée par assessmentPackId/curriculumId et par le pack.
  MATHS_COMPLEMENTAIRES: 'MATHEMATIQUES',
  MATHS_EXPERTES: 'MATHS_EXPERTES',
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

export function resolvePrismaSubject(subject: string): Subject {
  const mapped = SUBJECTS[subject];
  if (mapped === undefined) throw CanonicalApiError.incompatible(`PACK_SUBJECT_UNMAPPED:${subject}`);
  return mapped;
}

type CreateAttemptDatabase = PrismaClient | (IdempotencyDatabase & Readonly<Record<string, unknown>>);

type CreateAttemptDependencies = Readonly<{
  prisma: CreateAttemptDatabase;
  authenticate: () => Promise<Session | null>;
  resolvePack: PackResolver;
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
  // Explicit -1 check first (lastIndexOf's not-found sentinel) rather than
  // folding it into `marker < 1` -- behaviorally identical, but makes the
  // "not found" case unambiguous on its own instead of relying on -1 also
  // satisfying a length comparison.
  if (marker === -1) throw CanonicalApiError.incompatible('PACK_SCORING_INVALID');
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
      const enabled = assertAttemptPackEnabled(
        { assessmentPackId: input.packSlug },
        dependencies.resolvePack,
      );
      const gradeLevel = assertStudentPackLevel(student.gradeLevel, enabled.pack.level);

      const key = parseIdempotencyKey(request.headers.get('idempotency-key'));
      const startedAt = dependencies.now();
      const expiresAt = new Date(
        startedAt.getTime()
          + (enabled.pack.questionnaire.targetDurationMin + EXPIRY_GRACE_MINUTES) * 60_000,
      );
      const subject = resolvePrismaSubject(enabled.pack.subject);
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
              // Posée à la création, jamais par un UPDATE : cette route sert
              // la session d'un élève, donc une passation en ligne. La valeur
              // est écrite explicitement plutôt que laissée au DEFAULT — la
              // provenance d'une donnée se déclare, elle ne se déduit pas.
              provenance: 'EN_LIGNE',
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
