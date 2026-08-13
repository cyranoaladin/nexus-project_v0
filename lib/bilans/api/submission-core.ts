import type { Prisma } from '@prisma/client';

import { CanonicalApiError } from './errors';
import type { EnabledBilanPack } from './pack-access';

/**
 * Invariants partagés par toutes les soumissions d'un attempt, quelle qu'en
 * soit la provenance. La passation en ligne et la saisie papier appellent
 * exactement ces fonctions : c'est ce qui garantit qu'il n'existe pas deux
 * définitions de « copie complète » ni deux façons de déclencher le scoring.
 */

type SubmittedAnswers = Readonly<Record<string, Readonly<{
  optionId?: unknown;
  confidence?: unknown;
}>>>;

function submissionAnswers(value: unknown): SubmittedAnswers {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as SubmittedAnswers;
}

/**
 * Une copie est complète quand chaque item du pack porte une option valide.
 *
 * La certitude, elle, n'est pas exigée : `null` est accepté au même titre que
 * 1 à 4. La passation en ligne ne peut de toute façon pas produire ce cas — sa
 * validation d'entrée (PATCH answers) impose une certitude sur toute réponse
 * sélectionnée — donc élargir ici ne change rien pour elle. Refuser `null`
 * reviendrait à obliger le staff à inventer une certitude que la copie papier
 * ne porte pas.
 */
export function assertAttemptComplete(answers: unknown, enabled: EnabledBilanPack): void {
  const stored = submissionAnswers(answers);
  for (const item of enabled.pack.questionnaire.items) {
    const answer = stored[item.id];
    // Chaque item doit être PRÉSENT : une non-réponse est déclarée
    // (`optionId: null`, sans certitude — le moteur la profile NON_TRAITE),
    // jamais omise silencieusement.
    if (answer === undefined) throw CanonicalApiError.incompatible('ATTEMPT_INCOMPLETE');
    const blankDeclared = answer.optionId === null && answer.confidence === null;
    if (blankDeclared) continue;
    if (
      typeof answer.optionId !== 'string'
      || !item.options.some(({ id }) => id === answer.optionId)
      || !(answer.confidence === null || [1, 2, 3, 4].includes(answer.confidence as number))
    ) throw CanonicalApiError.incompatible('ATTEMPT_INCOMPLETE');
  }
}

type ScoreJobOutbox = Readonly<{
  jobOutbox: Readonly<{ create(args: Readonly<{ data: Prisma.JobOutboxCreateInput }>): Promise<unknown> }>;
}>;

/** Unique point d'entrée du scoring déterministe : le job SCORE_ATTEMPT. */
export async function enqueueScoreJob(
  transaction: ScoreJobOutbox,
  input: Readonly<{ attemptId: string; packSlug: string; packVersion: number }>,
): Promise<void> {
  await transaction.jobOutbox.create({
    data: {
      jobType: 'SCORE_ATTEMPT',
      aggregateType: 'CanonicalAssessmentAttempt',
      aggregateId: input.attemptId,
      sourceEventKey: `${input.attemptId}.submitted`,
      idempotencyKey: `${input.attemptId}.score`,
      payload: {
        attemptId: input.attemptId,
        packSlug: input.packSlug,
        packVersion: input.packVersion,
      },
    },
  });
}
