import 'server-only';

import { sha256Canonical } from '@/lib/llm/openrouter/hash';

type ReviewInput = Readonly<{
  fixtureId: string;
  model: string;
  report: unknown;
  provider?: string | null;
  generationId?: string | null;
  costMicrosUsd?: number | null;
  latencyMs?: number | null;
}>;

const LABELS = ['MODEL_A', 'MODEL_B', 'MODEL_C'] as const;

export const REVIEW_FORM_SCHEMA = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'nexus://bilans/review-form-v1',
  title: 'Bilan OpenRouter blind human review form',
  type: 'object',
  additionalProperties: false,
  required: ['reviewerId', 'reviewedAt', 'reviews'],
  properties: {
    reviewerId: { type: 'string', minLength: 1, maxLength: 120 },
    reviewedAt: { type: 'string', format: 'date-time' },
    reviews: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fixtureId', 'candidateLabel', 'scores', 'decision'],
        properties: {
          fixtureId: { type: 'string' },
          candidateLabel: { enum: LABELS },
          scores: {
            type: 'object',
            additionalProperties: false,
            required: [
              'fideliteAuxFaits',
              'clarte',
              'qualiteDuFrancais',
              'concision',
              'actionnabilite',
              'tonParent',
            ],
            properties: Object.fromEntries([
              'fideliteAuxFaits',
              'clarte',
              'qualiteDuFrancais',
              'concision',
              'actionnabilite',
              'tonParent',
            ].map((field) => [field, {
              type: 'integer', minimum: 1, maximum: 5,
            }])),
          },
          decision: {
            enum: ['ACCEPT', 'ACCEPT_WITH_MINOR_EDIT', 'REJECT'],
          },
        },
      },
    },
  },
} as const);

export const REVIEW_FORM_TEMPLATE = Object.freeze({
  schemaVersion: 'bilan-human-review-form-v1',
  reviewerId: '',
  reviewedAt: '',
  reviews: Object.freeze([]),
});

export const REVIEW_INSTRUCTIONS = [
  '# Revue humaine aveugle — benchmark parent',
  '',
  'Au moins deux reviewers indépendants doivent remplir chacun une copie du formulaire.',
  'Noter chaque candidat de 1 à 5 sur fidélité, clarté, qualité du français,',
  'concision, actionnabilité et ton parent, puis choisir une décision.',
  'Ne pas chercher à identifier le modèle. Ne pas partager les formulaires entre',
  'reviewers avant leur clôture. Signaler toute donnée personnelle, affirmation',
  'non étayée ou incohérence avec les faits synthétiques.',
].join('\n');

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
    });
    keyEntries.push(...candidates.map((candidate, index) => ({
      fixtureId,
      label: LABELS[index],
      model: candidate.model,
      provider: candidate.provider ?? null,
      generationId: candidate.generationId ?? null,
      costMicrosUsd: candidate.costMicrosUsd ?? null,
      latencyMs: candidate.latencyMs ?? null,
    })));
  }
  return Object.freeze({
    reviewerPackage: Object.freeze({
      reviewPacket: Object.freeze({
        schemaVersion: 'bilan-human-review-packet-v2',
        status: 'HUMAN_REVIEW_PENDING' as const,
        audience: 'PARENT' as const,
        minimumReviewerCount: 2,
        entries: Object.freeze(reviewEntries),
      }),
      reviewFormSchema: REVIEW_FORM_SCHEMA,
      reviewFormTemplate: REVIEW_FORM_TEMPLATE,
      reviewInstructions: REVIEW_INSTRUCTIONS,
    }),
    ownerSealedModelKey: Object.freeze({
      schemaVersion: 'bilan-human-review-model-key-v2',
      sealedUntilReviewComplete: true,
      entries: Object.freeze(keyEntries),
    }),
  });
}
