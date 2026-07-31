/** @jest-environment node */

import {
  createBenchmarkRunIdentity,
} from '@/lib/bilans/benchmark/run-identity';

const stableInput = {
  repositorySha: 'a'.repeat(40),
  benchmarkPolicyChecksum: 'b'.repeat(64),
  transportPolicyChecksum: 'c'.repeat(64),
  datasetChecksum: 'd'.repeat(64),
  promptChecksum: 'e'.repeat(64),
  draftSchemaChecksum: 'f'.repeat(64),
  finalSchemaChecksum: '0'.repeat(64),
  randomizationSeed: 'parent-benchmark-2026-07-31-v1',
} as const;

describe('benchmark run identity', () => {
  it('derives the run id only from stable campaign fields', () => {
    const first = createBenchmarkRunIdentity({
      ...stableInput,
      createdAt: '2026-07-31T10:00:00.000Z',
    });
    const second = createBenchmarkRunIdentity({
      ...stableInput,
      createdAt: '2026-07-31T10:05:00.000Z',
    });

    expect(first.runId).toMatch(/^[a-f0-9]{64}$/);
    expect(second.runId).toBe(first.runId);
    expect(second.createdAt).not.toBe(first.createdAt);
  });

  it.each([
    'repositorySha',
    'benchmarkPolicyChecksum',
    'transportPolicyChecksum',
    'datasetChecksum',
    'promptChecksum',
    'draftSchemaChecksum',
    'finalSchemaChecksum',
    'randomizationSeed',
  ] as const)('changes the run id when %s changes', (field) => {
    const baseline = createBenchmarkRunIdentity({
      ...stableInput,
      createdAt: '2026-07-31T10:00:00.000Z',
    });
    const changedValue = field === 'repositorySha'
      ? '1'.repeat(40)
      : field === 'randomizationSeed'
        ? 'parent-benchmark-2026-07-31-v2'
        : '1'.repeat(64);
    const changed = createBenchmarkRunIdentity({
      ...stableInput,
      [field]: changedValue,
      createdAt: '2026-07-31T10:00:00.000Z',
    });

    expect(changed.runId).not.toBe(baseline.runId);
  });

  it('rejects fake repository SHAs and malformed checksums', () => {
    expect(() => createBenchmarkRunIdentity({
      ...stableInput,
      repositorySha: 'fixture-sha',
      createdAt: '2026-07-31T10:00:00.000Z',
    })).toThrow('BENCHMARK_RUN_IDENTITY_INVALID');
    expect(() => createBenchmarkRunIdentity({
      ...stableInput,
      datasetChecksum: 'not-a-checksum',
      createdAt: '2026-07-31T10:00:00.000Z',
    })).toThrow('BENCHMARK_RUN_IDENTITY_INVALID');
  });
});
