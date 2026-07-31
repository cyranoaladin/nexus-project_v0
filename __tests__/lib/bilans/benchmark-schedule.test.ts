/** @jest-environment node */

import {
  buildBalancedBenchmarkSchedule,
} from '@/lib/bilans/benchmark/schedule';

const models = [
  'openai/gpt-5.6-luna',
  'openai/gpt-5.6-terra',
  'anthropic/claude-sonnet-5',
] as const;
const fixtureIds = Array.from(
  { length: 12 },
  (_, index) => `synthetic-${String(index + 1).padStart(2, '0')}`,
);

describe('balanced benchmark schedule', () => {
  it('persists 36 deterministic combinations with a 4/4/4 Latin square', () => {
    const input = {
      runId: 'a'.repeat(64),
      randomizationSeed: 'balanced-parent-seed-v1',
      fixtureIds,
      modelIds: models,
    } as const;
    const first = buildBalancedBenchmarkSchedule(input);
    const second = buildBalancedBenchmarkSchedule(input);

    expect(second).toEqual(first);
    expect(first).toHaveLength(36);
    expect(new Set(first.map(({ attemptKey }) => attemptKey)).size).toBe(36);
    expect(new Set(first.map(({ fixtureId, modelId }) =>
      `${fixtureId}:${modelId}`)).size).toBe(36);

    for (const modelId of models) {
      expect([0, 1, 2].map((position) => first.filter((entry) =>
        entry.modelId === modelId && entry.position === position).length))
        .toEqual([4, 4, 4]);
    }
    expect(first.every(({ attemptKey, fixtureId, modelId }) =>
      attemptKey === `benchmark:${input.runId}:${fixtureId}:${modelId}:0`))
      .toBe(true);
  });

  it('changes ordering, not coverage, when the seed changes', () => {
    const first = buildBalancedBenchmarkSchedule({
      runId: 'a'.repeat(64),
      randomizationSeed: 'seed-one',
      fixtureIds,
      modelIds: models,
    });
    const second = buildBalancedBenchmarkSchedule({
      runId: 'b'.repeat(64),
      randomizationSeed: 'seed-two',
      fixtureIds,
      modelIds: models,
    });

    expect(second.map(({ fixtureId, modelId }) => `${fixtureId}:${modelId}`))
      .not.toEqual(first.map(({ fixtureId, modelId }) => `${fixtureId}:${modelId}`));
    expect(new Set(second.map(({ fixtureId, modelId }) =>
      `${fixtureId}:${modelId}`))).toEqual(new Set(first.map(
      ({ fixtureId, modelId }) => `${fixtureId}:${modelId}`,
    )));
  });

  it('rejects incomplete or duplicated campaign dimensions', () => {
    expect(() => buildBalancedBenchmarkSchedule({
      runId: 'a'.repeat(64),
      randomizationSeed: 'seed',
      fixtureIds: fixtureIds.slice(0, 11),
      modelIds: models,
    })).toThrow('BENCHMARK_SCHEDULE_INVALID');
    expect(() => buildBalancedBenchmarkSchedule({
      runId: 'a'.repeat(64),
      randomizationSeed: 'seed',
      fixtureIds,
      modelIds: [models[0], models[0], models[2]],
    })).toThrow('BENCHMARK_SCHEDULE_INVALID');
  });
});
