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
import { validateDeterministicReports } from './structural-validation';
import { computeScoringV2 } from '@/lib/diagnostics/score-diagnostic';
import type { ScoringPolicy, ScoringV2Result } from '@/lib/diagnostics/types';
import type { BilanDiagnosticMathsData } from '@/lib/validations';

type StoredAnswer = Readonly<{ optionId: string; confidence: 1 | 2 | 3 | 4 }>;
type WorkerStage = 'SCORING' | 'RENDER' | 'STRUCTURE';

export type WorkerScoringInput = Readonly<{
  attemptId: string;
  startedAt: Date;
  submittedAt: Date;
  answers: unknown;
  pack: BilanPack;
}>;

export type WorkerScoringDependencies = Readonly<{
  computeScoringV2?: typeof computeScoringV2;
  computeFacts?: typeof computeFacts;
  buildFactSheet?: typeof buildFactSheet;
  buildReports?: typeof buildDeterministicReports;
  validateReports?: typeof validateDeterministicReports;
  onStage?: (stage: WorkerStage) => void;
}>;

export type WorkerScoringResult = Readonly<{
  scoringV2: ScoringV2Result;
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

function confidence(value: unknown): Exclude<Confidence, null> {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  throw new Error('A86_CONFIDENCE_INVALID');
}

function buildInputs(input: WorkerScoringInput): Readonly<{
  facts: ScoringInput;
  legacy: BilanDiagnosticMathsData;
  policy: ScoringPolicy;
  nodeDomains: Readonly<Record<string, string>>;
}> {
  const answers = answerRecord(input.answers);
  const elapsedTotal = Math.max(0, input.submittedAt.getTime() - input.startedAt.getTime());
  const elapsedPerItem = Math.floor(elapsedTotal / input.pack.questionnaire.items.length);
  const items: ScoringItem[] = [];
  const scoringAnswers: ScoringAnswer[] = [];
  const competencies: Record<string, Array<{
    skillId: string;
    skillLabel: string;
    status: 'studied';
    mastery: number;
    confidence: number;
    friction: number;
    errorTypes: string[];
    evidence: string;
  }>> = Object.fromEntries(input.pack.scoring.domains.map((domain) => [domain, []]));
  const nodeDomains: Record<string, string> = {};
  let correctCount = 0;
  let confidenceTotal = 0;

  for (const item of input.pack.questionnaire.items) {
    const stored = answers[item.id];
    if (stored === undefined || typeof stored.optionId !== 'string') throw new Error('A86_ANSWER_MISSING');
    const selected = item.options.find(({ id }) => id === stored.optionId);
    const correct = item.options.find(({ isCorrect }) => isCorrect);
    if (selected === undefined || correct === undefined) throw new Error('A86_ANSWER_OPTION_INVALID');
    const declaredConfidence = confidence(stored.confidence);
    if (selected.isCorrect) correctCount += 1;
    confidenceTotal += declaredConfidence;
    nodeDomains[item.nodeCpsId] = item.domainId;
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
    const domain = competencies[item.domainId];
    if (domain === undefined) throw new Error('A86_DOMAIN_INVALID');
    domain.push({
      skillId: item.id,
      skillLabel: item.nodeCpsId,
      status: 'studied',
      mastery: selected.isCorrect ? 4 : 0,
      confidence: declaredConfidence - 1,
      friction: selected.isCorrect ? 0 : 1,
      errorTypes: selected.isCorrect ? [] : ['WRONG_OPTION'],
      evidence: item.id,
    });
  }

  const itemCount = input.pack.questionnaire.items.length;
  const averageConfidence = Math.round(confidenceTotal / itemCount);
  const elapsedMinutes = elapsedTotal / 60_000;
  const legacy = {
    version: String(input.pack.version),
    discipline: 'maths',
    definitionKey: input.pack.slug,
    identity: {
      firstName: 'ELEVE',
      lastName: 'ANONYME',
      email: 'eleve@invalid.test',
      phone: '000000',
    },
    schoolContext: { establishment: 'NON_APPLICABLE' },
    performance: { mathAverage: 'NON_APPLICABLE' },
    chapters: {},
    competencies,
    openQuestions: {},
    examPrep: {
      miniTest: {
        score: Math.round((correctCount / itemCount) * 6),
        timeUsedMinutes: elapsedMinutes,
        completedInTime: elapsedMinutes <= input.pack.questionnaire.targetDurationMin,
      },
      selfRatings: {
        speedNoCalc: averageConfidence,
        calcReliability: averageConfidence,
        redaction: averageConfidence,
        justifications: averageConfidence,
        stress: 0,
      },
      signals: { hardestItems: [], verifiedAnswers: true, feeling: 'ok' },
    },
    methodology: { errorTypes: [] },
    ambition: {},
    freeText: {},
  } as BilanDiagnosticMathsData;
  const domainWeight = 1 / input.pack.scoring.domains.length;

  return Object.freeze({
    facts: Object.freeze({
      items: Object.freeze(items),
      answers: Object.freeze(scoringAnswers),
      targetDurationMin: input.pack.questionnaire.targetDurationMin,
    }),
    legacy,
    policy: Object.freeze({
      domainWeights: Object.fromEntries(input.pack.scoring.domains.map((domain) => [domain, domainWeight])),
      thresholds: {
        confirmed: { readiness: 60, risk: 55 },
        conditional: { readiness: 48, risk: 70 },
      },
    }),
    nodeDomains: Object.freeze(nodeDomains),
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
  const scoringV2 = (dependencies.computeScoringV2 ?? computeScoringV2)(prepared.legacy, prepared.policy);
  const facts = (dependencies.computeFacts ?? computeFacts)(prepared.facts);
  const factSheet = (dependencies.buildFactSheet ?? buildFactSheet)(scoringV2, {
    result: facts,
    bank: {
      slug: input.pack.slug,
      version: input.pack.version,
      domainIds: input.pack.scoring.domains,
    },
    student: { alias: studentAlias(input.attemptId), level: input.pack.level },
    nodeDomains: prepared.nodeDomains,
  });
  dependencies.onStage?.('RENDER');
  const renderIdentity: RenderIdentity = Object.freeze({
    displayName: factSheet.student.alias,
    level: input.pack.level,
    subject: input.pack.subject,
    date: input.submittedAt.toISOString().slice(0, 10),
    stageLabel: input.pack.slug,
  });
  const reports = (dependencies.buildReports ?? buildDeterministicReports)(factSheet, renderIdentity);
  dependencies.onStage?.('STRUCTURE');
  (dependencies.validateReports ?? validateDeterministicReports)(factSheet, reports);
  return Object.freeze({ scoringV2, facts, factSheet, reports, scoringInput: prepared.facts });
}
