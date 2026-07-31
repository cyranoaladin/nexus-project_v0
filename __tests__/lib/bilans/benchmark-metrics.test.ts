/** @jest-environment node */

import { calculateBenchmarkMetrics } from '@/lib/bilans/benchmark/metrics';

describe('computed benchmark metrics', () => {
  it('derives rates, costs, providers and finish reasons from actual outcomes', () => {
    const metrics = calculateBenchmarkMetrics({
      results: [{
        model: 'luna',
        provenance: {
          provider: 'Azure',
          finishReason: 'stop',
          costMicrosUsd: 100,
          latencyMs: 10,
        },
      }, {
        model: 'luna',
        provenance: {
          provider: 'Azure',
          finishReason: 'stop',
          costMicrosUsd: 300,
          latencyMs: 30,
        },
      }],
      failures: [{
        model: 'luna',
        category: 'QUALITY_FAILURE',
        validationStage: 'SCHEMA',
        responseReceived: true,
        knownCostMicrosUsd: 50,
        safeAttempt: {
          provider: 'Other',
          finishReason: 'stop',
          latencyMs: 20,
        },
        normalizedErrorCode: 'OPENROUTER_SCHEMA_FAILURE',
      }, {
        model: 'terra',
        category: 'TRANSPORT_FAILURE',
        validationStage: 'TRANSPORT',
        responseReceived: false,
        knownCostMicrosUsd: null,
        safeAttempt: null,
        normalizedErrorCode: 'OPENROUTER_TIMEOUT',
      }],
      reservedUnknownCostMicrosUsd: 9_000,
    });

    expect(metrics).toMatchObject({
      attemptedCallCount: 4,
      responseReceivedCount: 3,
      transportFailureCount: 1,
      schemaValidCount: 2,
      schemaFailureCount: 1,
      validReportCount: 2,
      totalKnownCostMicrosUsd: 450,
      reservedUnknownCostMicrosUsd: 9_000,
      p50LatencyMs: 20,
      p95LatencyMs: 30,
      providerDistribution: { Azure: 2, Other: 1 },
      finishReasonDistribution: { stop: 3 },
      humanUnsupportedClaimCount: 'PENDING',
    });
    expect(metrics.byModel.find(({ model }) => model === 'luna'))
      .toMatchObject({ attemptedCallCount: 3, schemaValidCount: 2 });
  });

  it('does not fabricate perfect rates for an empty sample', () => {
    const metrics = calculateBenchmarkMetrics({
      results: [],
      failures: [],
      reservedUnknownCostMicrosUsd: 0,
    });
    expect(metrics.schemaValidityRate).toBeNull();
    expect(metrics.validReportCount).toBe(0);
    expect(metrics.humanUnsupportedClaimCount).toBe('PENDING');
  });
});
