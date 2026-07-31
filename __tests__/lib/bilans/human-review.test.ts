/** @jest-environment node */

import {
  buildBlindHumanReviewPackage,
} from '@/lib/bilans/benchmark/human-review';

const syntheticResults = [
  'openai/gpt-5.6-luna',
  'openai/gpt-5.6-terra',
  'anthropic/claude-sonnet-5',
].map((model, index) => ({
  fixtureId: 'synthetic-simple-01',
  model,
  report: {
    title: `Synthèse ${index + 1}`,
    summary: 'Contenu exclusivement synthétique.',
  },
  provider: 'Azure',
  generationId: `gen-${index + 1}`,
  costMicrosUsd: 100 + index,
  latencyMs: 500 + index,
}));

describe('blind benchmark review package', () => {
  it('physically separates all transport identities from reviewer files', () => {
    const output = buildBlindHumanReviewPackage(
      syntheticResults,
      'benchmark-review-seed-v1',
    );
    const reviewerFiles = JSON.stringify(output.reviewerPackage);

    expect(reviewerFiles).not.toMatch(
      /luna|terra|sonnet|openai|anthropic|azure|generationId|cost|latency|modelKey/i,
    );
    expect(output.reviewerPackage.reviewPacket.status)
      .toBe('HUMAN_REVIEW_PENDING');
    expect(output.reviewerPackage.reviewPacket.minimumReviewerCount).toBe(2);
    expect(output.reviewerPackage.reviewPacket.entries[0].candidates.map(
      ({ label }) => label,
    )).toEqual(expect.arrayContaining(['MODEL_A', 'MODEL_B', 'MODEL_C']));
    expect(output.reviewerPackage.reviewFormTemplate.reviewerId).toBe('');
    expect(output.reviewerPackage.reviewFormTemplate.reviews).toEqual([]);
    expect(output.ownerSealedModelKey.entries).toHaveLength(3);
    expect(output.ownerSealedModelKey.entries[0]).toEqual(expect.objectContaining({
      model: expect.any(String),
      provider: 'Azure',
      generationId: expect.any(String),
      costMicrosUsd: expect.any(Number),
      latencyMs: expect.any(Number),
    }));
  });

  it('provides a strict blank form for each independent reviewer', () => {
    const output = buildBlindHumanReviewPackage(
      syntheticResults,
      'benchmark-review-seed-v1',
    );
    const schema = output.reviewerPackage.reviewFormSchema;

    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['reviewerId', 'reviewedAt', 'reviews'],
    });
    expect(output.reviewerPackage.reviewInstructions).toContain(
      'deux reviewers indépendants',
    );
    expect(output.reviewerPackage.reviewInstructions).not.toContain('Azure');
  });

  it('refuses a fixture without three valid model candidates', () => {
    expect(() => buildBlindHumanReviewPackage(
      syntheticResults.slice(0, 2),
      'benchmark-review-seed-v1',
    )).toThrow('HUMAN_REVIEW_REQUIRES_THREE_MODELS');
  });
});
