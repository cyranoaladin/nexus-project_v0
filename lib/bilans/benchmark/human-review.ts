import 'server-only';

import { sha256Canonical } from '@/lib/llm/openrouter/hash';

type ReviewInput = Readonly<{
  fixtureId: string;
  model: string;
  report: unknown;
}>;

const LABELS = ['MODEL_A', 'MODEL_B', 'MODEL_C'] as const;

function shuffled<T>(values: readonly T[], seed: string): T[] {
  return [...values].sort((left, right) =>
    sha256Canonical({ seed, value: left }).localeCompare(
      sha256Canonical({ seed, value: right }),
    ));
}

export function buildBlindHumanReviewPackage(
  results: readonly ReviewInput[],
  seed: string,
) {
  const fixtureIds = [...new Set(results.map(({ fixtureId }) => fixtureId))]
    .sort();
  const reviewEntries = [];
  const keyEntries = [];
  for (const fixtureId of fixtureIds) {
    const candidates = shuffled(
      results.filter((result) => result.fixtureId === fixtureId),
      `${seed}:${fixtureId}`,
    );
    if (candidates.length !== LABELS.length) {
      throw new Error('HUMAN_REVIEW_REQUIRES_THREE_MODELS');
    }
    reviewEntries.push({
      fixtureId,
      candidates: candidates.map(({ report }, index) => ({
        label: LABELS[index],
        report,
      })),
      scores: [],
      decision: null,
    });
    keyEntries.push(...candidates.map(({ model }, index) => ({
      fixtureId,
      label: LABELS[index],
      model,
    })));
  }
  return Object.freeze({
    reviewPacket: Object.freeze({
      schemaVersion: 'bilan-human-review-packet-v1',
      status: 'HUMAN_REVIEW_PENDING' as const,
      dimensions: Object.freeze([
        'FIDELITE_AUX_FAITS',
        'CLARTE',
        'QUALITE_DU_FRANCAIS',
        'CONCISION',
        'ACTIONNABILITE',
        'TON_PARENT',
      ]),
      allowedDecisions: Object.freeze([
        'ACCEPT',
        'ACCEPT_WITH_MINOR_EDIT',
        'REJECT',
      ]),
      entries: Object.freeze(reviewEntries),
    }),
    modelKey: Object.freeze({
      schemaVersion: 'bilan-human-review-model-key-v1',
      entries: Object.freeze(keyEntries),
    }),
  });
}
