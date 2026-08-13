import { createHash } from 'node:crypto';

import type { BilanPack } from '../catalog/load-pack';
import { score as computeFacts } from '../facts/compute-facts';
import { buildFactSheet, type FactSheet } from '../facts/fact-sheet';
import type { Confidence, ScoringAnswer, ScoringInput, ScoringItem } from '../facts/types';
import {
  buildDeterministicReports,
  type DeterministicBilanReportBundle,
} from '../render/report';
import type { RenderIdentity } from '../render/render-identity';
import { buildPreRentreeStageLabel } from '../render/stage-label';
import { validateDeterministicReports } from './structural-validation';

type StoredAnswer = Readonly<{ optionId: string; confidence: 1 | 2 | 3 | 4 | null }>;
type WorkerStage = 'SCORING' | 'RENDER' | 'STRUCTURE';

export type WorkerScoringInput = Readonly<{
  attemptId: string;
  startedAt: Date;
  submittedAt: Date;
  answers: unknown;
  pack: BilanPack;
}>;

export type WorkerScoringDependencies = Readonly<{
  computeFacts?: typeof computeFacts;
  buildFactSheet?: typeof buildFactSheet;
  buildReports?: typeof buildDeterministicReports;
  validateReports?: typeof validateDeterministicReports;
  onStage?: (stage: WorkerStage) => void;
}>;

export type WorkerScoringResult = Readonly<{
  facts: ReturnType<typeof computeFacts>;
  factSheet: FactSheet;
  reports: DeterministicBilanReportBundle;
  scoringInput: ScoringInput;
}>;

function answerRecord(value: unknown): Readonly<Record<string, StoredAnswer>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A86_ANSWERS_INVALID');
  }
  return value as Readonly<Record<string, StoredAnswer>>;
}

/**
 * `null` est une certitude non déclarée, pas une donnée corrompue.
 *
 * Le moteur de faits le prévoit depuis toujours -- `Confidence = 1|2|3|4|null`
 * -- et le traite comme une absence de confiance. Seul cet adaptateur le
 * refusait, parce que la passation en ligne ne peut pas le produire. Une copie
 * papier, elle, n'a pas toujours la case cochée : la seule autre issue serait
 * d'inventer une valeur, ce qui fausserait la calibration de l'élève.
 * `undefined` ou toute autre valeur reste une erreur.
 */
function confidence(value: unknown): Confidence {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === null) return value;
  throw new Error('A86_CONFIDENCE_INVALID');
}

function buildInputs(input: WorkerScoringInput): Readonly<{
  facts: ScoringInput;
}> {
  const answers = answerRecord(input.answers);
  const elapsedTotal = Math.max(0, input.submittedAt.getTime() - input.startedAt.getTime());
  const elapsedPerItem = Math.floor(elapsedTotal / input.pack.questionnaire.items.length);
  const items: ScoringItem[] = [];
  const scoringAnswers: ScoringAnswer[] = [];
  for (const item of input.pack.questionnaire.items) {
    const stored = answers[item.id];
    // L'item DOIT figurer dans la passation (jamais d'omission silencieuse).
    if (stored === undefined) throw new Error('A86_ANSWER_MISSING');
    const correct = item.options.find(({ isCorrect }) => isCorrect);
    if (correct === undefined) throw new Error('A86_ANSWER_OPTION_INVALID');

    // « Sans réponse » DÉCLARÉE (optionId null, sans certitude) : état de saisie
    // légitime (grille + API l'acceptent, cf. assertAttemptComplete). Le moteur
    // la profile NON_TRAITE. Avant ce correctif, le worker la rejetait
    // (A86_ANSWER_MISSING) alors que la saisie l'avait acceptée — une copie
    // avec « Sans réponse » restait sans bilan (13/08/2026).
    if (stored.optionId === null) {
      if (stored.confidence !== null) throw new Error('A86_ANSWER_OPTION_INVALID');
      items.push({
        id: item.id,
        nodeCpsId: item.nodeCpsId,
        type: 'QCM_SIMPLE',
        difficulty: item.difficulty,
        answerKey: { kind: 'QCM_SIMPLE', correct: correct.id },
        targetTimeSec: item.targetTimeSec,
      });
      scoringAnswers.push({
        itemId: item.id,
        rawAnswer: null,
        confidence: null,
        elapsedMs: elapsedPerItem,
      });
      continue;
    }

    if (typeof stored.optionId !== 'string') throw new Error('A86_ANSWER_MISSING');
    const selected = item.options.find(({ id }) => id === stored.optionId);
    if (selected === undefined) throw new Error('A86_ANSWER_OPTION_INVALID');
    const declaredConfidence = confidence(stored.confidence);
    items.push({
      id: item.id,
      nodeCpsId: item.nodeCpsId,
      type: 'QCM_SIMPLE',
      difficulty: item.difficulty,
      answerKey: { kind: 'QCM_SIMPLE', correct: correct.id },
      targetTimeSec: item.targetTimeSec,
    });
    scoringAnswers.push({
      itemId: item.id,
      rawAnswer: stored.optionId,
      confidence: declaredConfidence,
      elapsedMs: elapsedPerItem,
    });
  }

  return Object.freeze({
    facts: Object.freeze({
      items: Object.freeze(items),
      answers: Object.freeze(scoringAnswers),
      targetDurationMin: input.pack.questionnaire.targetDurationMin,
    }),
  });
}

function studentAlias(attemptId: string): string {
  const digest = createHash('sha256').update(attemptId).digest().subarray(0, 12);
  const suffix = [...digest].map((byte) => String.fromCharCode(65 + (byte % 26))).join('');
  return `ELEVE_${suffix}`;
}

export function buildWorkerScoring(
  input: WorkerScoringInput,
  dependencies: WorkerScoringDependencies = {},
): WorkerScoringResult {
  const prepared = buildInputs(input);
  dependencies.onStage?.('SCORING');
  const facts = (dependencies.computeFacts ?? computeFacts)(prepared.facts);
  const factSheet = (dependencies.buildFactSheet ?? buildFactSheet)(input.pack, {
    result: facts,
    student: { alias: studentAlias(input.attemptId), level: input.pack.level },
  });
  dependencies.onStage?.('RENDER');
  const renderIdentity: RenderIdentity = Object.freeze({
    displayName: factSheet.student.alias,
    level: input.pack.level,
    subject: input.pack.subject,
    date: input.submittedAt.toISOString().slice(0, 10),
    stageLabel: buildPreRentreeStageLabel(input.pack.level, input.pack.subject),
  });
  const reports = (dependencies.buildReports ?? buildDeterministicReports)(factSheet, renderIdentity);
  dependencies.onStage?.('STRUCTURE');
  (dependencies.validateReports ?? validateDeterministicReports)(factSheet, reports);
  return Object.freeze({ facts, factSheet, reports, scoringInput: prepared.facts });
}
