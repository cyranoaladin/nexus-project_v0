/** @jest-environment node */

import {
  buildBlindHumanReviewPackage,
} from '@/lib/bilans/benchmark/human-review';

const syntheticResults = ['luna', 'terra', 'sonnet'].map((model, index) => ({
  fixtureId: 'synthetic-simple-01',
  model,
  report: {
    title: `Synthèse ${index + 1}`,
    summary: 'Contenu exclusivement synthétique.',
  },
}));

describe('blind benchmark review package', () => {
  it('separates model identities from the reviewer packet', () => {
    const output = buildBlindHumanReviewPackage(
      syntheticResults,
      'benchmark-review-seed-v1',
    );
    const packet = JSON.stringify(output.reviewPacket);
    expect(packet).not.toMatch(/luna|terra|sonnet|openai|anthropic/i);
    expect(output.reviewPacket.status).toBe('HUMAN_REVIEW_PENDING');
    expect(output.reviewPacket.entries[0].candidates.map(({ label }) => label))
      .toEqual(expect.arrayContaining(['MODEL_A', 'MODEL_B', 'MODEL_C']));
    expect(output.modelKey.entries).toHaveLength(3);
    expect(output.reviewPacket.entries[0].scores).toEqual([]);
  });
});
