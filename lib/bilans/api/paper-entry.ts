import { randomBytes } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

import { resolvePrismaSubject } from './create-attempt';
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
import { assertStudentPackLevel } from './student-pack-level';
import { assertAttemptComplete, enqueueScoreJob } from './submission-core';
import { assertStaffActor, type StaffActor } from '../saisie-papier/access';
import { buildPaperEntryAnswers } from '../saisie-papier/entry';

/**
 * Saisie papier d'un bilan déjà passé.
 *
 * La route ne calcule rien et ne connaît pas le scoring. Elle écrit un attempt
 * comme la passation en ligne l'écrit, avec les mêmes invariants partagés
 * (`assertAttemptComplete`, `enqueueScoreJob`), et laisse le worker
 * déterministe faire exactement le même travail. La seule différence tient
 * dans les faits eux-mêmes, et elle est inscrite dans la ligne : provenance
 * SAISIE_PAPIER, saisisseur, date de saisie.
 */

const PAPER_ENTRY_ROUTE = 'POST:/api/bilans/saisie-papier';

const confidenceSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  // La certitude est demandée pour chaque item — les copies la portent
  // normalement — mais une case peut manquer sur une copie donnée. `null` dit
  // « absente de la copie ». Le champ reste obligatoire dans le corps de la
  // requête : c'est une omission déclarée, pas une omission silencieuse.
  z.null(),
]);

const requestSchema = z.object({
  studentId: z.string().min(1),
  packSlug: z.string().min(1),
  answers: z.array(z.object({
    itemId: z.string().min(1),
    optionId: z.string().min(1),
    confidence: confidenceSchema,
  }).strict()).min(1),
}).strict();

type PaperEntryDatabase = IdempotencyDatabase & Readonly<{
  student: PrismaClient['student'];
}>;

export type PaperEntryDependencies = Readonly<{
  prisma: PaperEntryDatabase;
  authenticate: () => Promise<Session | null>;
  resolvePack: PackResolver;
  now: () => Date;
  generateSeed: () => string;
}>;

type AttemptDelegate = Readonly<{
  create(args: Readonly<{ data: Readonly<Record<string, unknown>> }>): Promise<Readonly<{
    id: string;
    status: string;
  }>>;
  updateMany(args: unknown): Promise<Readonly<{ count: number }>>;
}>;

type JobOutboxDelegate = Readonly<{ create(args: unknown): Promise<unknown> }>;

function attemptDelegate(transaction: CanonicalTransaction): AttemptDelegate {
  const delegate = transaction.canonicalAssessmentAttempt;
  if (
    typeof delegate !== 'object' || delegate === null
    || !('create' in delegate) || !('updateMany' in delegate)
  ) {
    throw new Error('Canonical attempt delegate unavailable');
  }
  return delegate as AttemptDelegate;
}

function outboxDelegate(transaction: CanonicalTransaction): Readonly<{ jobOutbox: JobOutboxDelegate }> {
  const delegate = transaction.jobOutbox;
  if (typeof delegate !== 'object' || delegate === null || !('create' in delegate)) {
    throw new Error('Canonical job outbox delegate unavailable');
  }
  return { jobOutbox: delegate as JobOutboxDelegate };
}

function scoringProvenance(engine: string): Readonly<{ id: string; version: string }> {
  const marker = engine.lastIndexOf('.v');
  if (marker === -1) throw CanonicalApiError.incompatible('PACK_SCORING_INVALID');
  if (marker < 1 || marker === engine.length - 2) throw CanonicalApiError.incompatible('PACK_SCORING_INVALID');
  return { id: engine.slice(0, marker), version: engine.slice(marker + 2) };
}

async function requestBody(request: NextRequest): Promise<z.infer<typeof requestSchema>> {
  try {
    return requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof CanonicalApiError) throw error;
    throw CanonicalApiError.badRequest();
  }
}

type PaperEntryStudent = Readonly<{ id: string; gradeLevel: unknown }>;

async function resolveEnteredStudent(
  database: PaperEntryDatabase,
  studentId: string,
): Promise<PaperEntryStudent> {
  const student = await database.student.findUnique({
    where: { id: studentId },
    select: { id: true, gradeLevel: true },
  });
  if (student === null) throw CanonicalApiError.notFound();
  return student;
}

const defaultDependencies: PaperEntryDependencies = {
  prisma: prisma as unknown as PaperEntryDatabase,
  authenticate: auth,
  resolvePack: resolveEnabledPack,
  now: () => new Date(),
  generateSeed: () => randomBytes(32).toString('hex'),
};

/**
 * L'attempt naît en DRAFT avec ses réponses, puis passe à SUBMITTED dans la
 * même transaction : la transition DRAFT → SUBMITTED est celle que le trigger
 * de cycle de vie valide pour une passation en ligne, et le job SCORE_ATTEMPT
 * est posé par la fonction partagée. Rien ici ne court-circuite le cycle.
 *
 * La provenance et l'audit sont posés par le `create`, donc par un INSERT.
 * Aucun UPDATE ne les touche ensuite — le trigger le refuserait.
 */
async function writePaperAttempt(
  transaction: CanonicalTransaction,
  input: Readonly<{
    actor: StaffActor;
    student: PaperEntryStudent;
    enabled: EnabledBilanPack;
    answers: Record<string, unknown>;
    seed: string;
    now: Date;
  }>,
): Promise<string> {
  const { enabled } = input;
  const attempts = attemptDelegate(transaction);
  const scoring = scoringProvenance(enabled.pack.scoring.engine);
  const gradeLevel = assertStudentPackLevel(input.student.gradeLevel, enabled.pack.level);

  const attempt = await attempts.create({
    data: {
      studentId: input.student.id,
      status: 'DRAFT',
      provenance: 'SAISIE_PAPIER',
      enteredById: input.actor.userId,
      enteredAt: input.now,
      seed: input.seed,
      // La copie est déjà passée : l'attempt n'ouvre aucune fenêtre de
      // passation. Il est soumis immédiatement, dans cette transaction, et
      // n'est donc jamais reprenable comme un brouillon en ligne.
      //
      // LIMITE CONNUE : la durée réelle de composition n'est pas sur la copie.
      // `startedAt` et `submittedAt` valent donc l'instant de la saisie, et le
      // moteur en déduit une durée nulle, ce qui lève le drapeau
      // PASSATION_EXPRESS sur tout bilan saisi. Le score, les profils et la
      // calibration n'en dépendent pas ; seul ce drapeau est trompeur. Le
      // corriger supposerait soit d'inventer une durée, soit de faire entrer
      // la provenance dans le moteur de faits — les deux sont exclus. À
      // arbitrer avec le responsable, hors de ce périmètre.
      startedAt: input.now,
      expiresAt: input.now,
      subject: resolvePrismaSubject(enabled.pack.subject),
      gradeLevel,
      answers: input.answers,
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

  assertAttemptComplete(input.answers, enabled);

  const submitted = await attempts.updateMany({
    where: { id: attempt.id, status: 'DRAFT' },
    data: { status: 'SUBMITTED', submittedAt: input.now, revision: { increment: 1 } },
  });
  if (submitted.count !== 1) throw CanonicalApiError.conflict('ATTEMPT_SUBMIT_FAILED');

  await enqueueScoreJob(outboxDelegate(transaction) as never, {
    attemptId: attempt.id,
    packSlug: enabled.pack.slug,
    packVersion: enabled.pack.version,
  });
  return attempt.id;
}

export function createPaperEntryHandler(
  dependencies: PaperEntryDependencies = defaultDependencies,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    try {
      const input = await requestBody(request);
      const actor = assertStaffActor(await dependencies.authenticate());
      const key = parseIdempotencyKey(request.headers.get('idempotency-key'));
      const now = dependencies.now();

      const student = await resolveEnteredStudent(dependencies.prisma, input.studentId);
      const enabled = assertAttemptPackEnabled({ assessmentPackId: input.packSlug }, dependencies.resolvePack);
      const answers = buildPaperEntryAnswers(enabled, input.answers);
      const seed = dependencies.generateSeed();

      const result = await executeIdempotently({
        prisma: dependencies.prisma,
        userId: actor.userId,
        route: PAPER_ENTRY_ROUTE,
        key,
        now,
        action: async (transaction) => {
          const attemptId = await writePaperAttempt(transaction, {
            actor,
            student,
            enabled,
            answers,
            seed,
            now,
          });
          return {
            status: 201,
            body: {
              attemptId,
              status: 'SUBMITTED' as const,
              provenance: 'SAISIE_PAPIER' as const,
              submittedAt: now.toISOString(),
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
