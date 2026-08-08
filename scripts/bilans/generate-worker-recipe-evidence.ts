import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import sourcePack from '@/data/bilans/banks/entree-premiere-maths-v1.json';
import type { BilanPack } from '@/lib/bilans/catalog/load-pack';
import { score as computeFacts } from '@/lib/bilans/facts/compute-facts';
import { buildFactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { Confidence, ScoringAnswer, ScoringItem } from '@/lib/bilans/facts/types';
import { buildDeterministicReports } from '@/lib/bilans/render/report';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import { validateDeterministicReports } from '@/lib/bilans/worker/structural-validation';

const SOURCE_PATH = path.join('data', 'bilans', 'banks', 'entree-premiere-maths-v1.json');
export const WORKER_RECIPE_PATH = path.join(
  'data', 'bilans', 'recipe', 'entree-premiere-maths-v1-worker-chain.json',
);

const PROFILE_PATTERN = [
  'MAITRISE',
  'MAITRISE_FRAGILE',
  'ERREUR_CONFIANTE',
  'LACUNE_CONSCIENTE',
  'NON_TRAITE',
] as const;

type SyntheticAnswer = Readonly<{
  itemId: string;
  selectedOptionId: string | null;
  confidence: Confidence;
}>;

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function generateWorkerRecipeEvidence() {
  const pack = sourcePack as unknown as BilanPack;
  const items: ScoringItem[] = [];
  const answers: ScoringAnswer[] = [];
  const sourceAnswers: SyntheticAnswer[] = [];

  for (const [index, item] of pack.questionnaire.items.entries()) {
    const expectedProfile = PROFILE_PATTERN[index % PROFILE_PATTERN.length];
    const correct = item.options.find(({ isCorrect }) => isCorrect);
    const incorrect = item.options.find(({ isCorrect }) => !isCorrect);
    if (correct === undefined || incorrect === undefined) {
      throw new Error(`Recipe item ${item.id} must expose one correct and one incorrect option`);
    }

    items.push({
      id: item.id,
      nodeCpsId: item.nodeCpsId,
      type: 'QCM_SIMPLE',
      difficulty: item.difficulty,
      answerKey: { kind: 'QCM_SIMPLE', correct: correct.id },
      targetTimeSec: item.targetTimeSec,
    });

    if (expectedProfile === 'NON_TRAITE') {
      sourceAnswers.push(Object.freeze({ itemId: item.id, selectedOptionId: null, confidence: null }));
      continue;
    }

    const success = expectedProfile === 'MAITRISE' || expectedProfile === 'MAITRISE_FRAGILE';
    const confident = expectedProfile === 'MAITRISE' || expectedProfile === 'ERREUR_CONFIANTE';
    const selectedOptionId = success ? correct.id : incorrect.id;
    const declaredConfidence = (confident ? 4 : 1) as 1 | 4;
    sourceAnswers.push(Object.freeze({
      itemId: item.id,
      selectedOptionId,
      confidence: declaredConfidence,
    }));
    answers.push(Object.freeze({
      itemId: item.id,
      rawAnswer: selectedOptionId,
      confidence: declaredConfidence,
      elapsedMs: item.targetTimeSec * 1_000,
    }));
  }

  const facts = computeFacts(Object.freeze({
    items: Object.freeze(items),
    answers: Object.freeze(answers),
    targetDurationMin: pack.questionnaire.targetDurationMin,
    partial: true,
  }));
  const factSheet = buildFactSheet(pack, {
    result: facts,
    student: { alias: 'ELEVE_RECETTE', level: pack.level },
  });
  const reports = buildDeterministicReports(factSheet, Object.freeze({
    displayName: 'ELEVE_RECETTE',
    level: pack.level,
    subject: pack.subject,
    date: '1970-01-01',
    stageLabel: buildPreRentreeStageLabel(pack.level, pack.subject),
  }));
  validateDeterministicReports(factSheet, reports);

  const artifact = Object.freeze({
    schemaVersion: 'nexus-bilan-worker-recipe/v1',
    sourcePack: Object.freeze({
      slug: pack.slug,
      version: pack.version,
      checksum: createHash('sha256').update(readFileSync(SOURCE_PATH)).digest('hex'),
    }),
    pipeline: Object.freeze([
      'rawAnswers', 'computeFacts', 'computeDomainScores', 'buildFactSheet', 'buildDeterministicReports',
    ]),
    syntheticAttempt: Object.freeze({ partial: true, answers: Object.freeze(sourceAnswers) }),
    facts,
    factSheet,
    reports,
  });

  return Object.freeze({ artifact, json: stableJson(artifact) });
}

function main(): void {
  const generated = generateWorkerRecipeEvidence();
  const target = path.resolve(WORKER_RECIPE_PATH);
  if (process.argv.includes('--write')) {
    writeFileSync(target, generated.json, 'utf8');
    return;
  }
  const versioned = readFileSync(target, 'utf8');
  if (versioned !== generated.json) {
    throw new Error(`Worker recipe artifact differs: ${WORKER_RECIPE_PATH}`);
  }
}

if (process.argv[1]?.endsWith('generate-worker-recipe-evidence.ts')) main();
