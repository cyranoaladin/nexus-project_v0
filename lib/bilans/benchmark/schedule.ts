import 'server-only';

import { sha256Canonical } from '@/lib/llm/openrouter/hash';

export type BenchmarkScheduleEntry = Readonly<{
  sequence: number;
  fixtureId: string;
  modelId: string;
  position: 0 | 1 | 2;
  sampleIndex: 0;
  attemptKey: string;
}>;

function deterministicOrder(
  values: readonly string[],
  seed: string,
  namespace: string,
): string[] {
  return [...values].sort((left, right) => {
    const leftHash = sha256Canonical({ seed, namespace, value: left });
    const rightHash = sha256Canonical({ seed, namespace, value: right });
    return leftHash.localeCompare(rightHash) || left.localeCompare(right);
  });
}

export function buildBalancedBenchmarkSchedule(
  input: Readonly<{
    runId: string;
    randomizationSeed: string;
    fixtureIds: readonly string[];
    modelIds: readonly string[];
  }>,
): readonly BenchmarkScheduleEntry[] {
  if (
    !/^[a-f0-9]{64}$/.test(input.runId)
    || input.randomizationSeed.length < 4
    || input.fixtureIds.length !== 12
    || new Set(input.fixtureIds).size !== 12
    || input.modelIds.length !== 3
    || new Set(input.modelIds).size !== 3
  ) {
    throw new Error('BENCHMARK_SCHEDULE_INVALID');
  }
  const fixtures = deterministicOrder(
    input.fixtureIds,
    input.randomizationSeed,
    'fixtures',
  );
  const models = deterministicOrder(
    input.modelIds,
    input.randomizationSeed,
    'models',
  );
  const entries: BenchmarkScheduleEntry[] = [];
  fixtures.forEach((fixtureId, fixtureIndex) => {
    const rotation = fixtureIndex % models.length;
    for (let position = 0; position < models.length; position += 1) {
      const modelId = models[(position + rotation) % models.length];
      entries.push(Object.freeze({
        sequence: entries.length + 1,
        fixtureId,
        modelId,
        position: position as 0 | 1 | 2,
        sampleIndex: 0,
        attemptKey:
          `benchmark:${input.runId}:${fixtureId}:${modelId}:0`,
      }));
    }
  });
  return Object.freeze(entries);
}
