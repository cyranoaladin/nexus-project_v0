import 'server-only';

type MetricResult = Readonly<{
  model: string;
  provenance: Readonly<{
    provider: string | null;
    finishReason: string;
    costMicrosUsd: number;
    latencyMs: number;
  }>;
}>;

type MetricFailure = Readonly<{
  model: string;
  category: 'SECURITY_CRITICAL' | 'QUALITY_FAILURE' | 'TRANSPORT_FAILURE';
  validationStage: 'TRANSPORT' | 'SCHEMA' | 'GROUNDING' | 'SECURITY';
  responseReceived: boolean;
  knownCostMicrosUsd: number | null;
  normalizedErrorCode: string;
  safeAttempt: Readonly<{
    provider: string | null;
    finishReason: string | null;
    latencyMs: number | null;
  }> | null;
}>;

function percentile(values: readonly number[], value: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(
    ordered.length - 1,
    Math.ceil((value / 100) * ordered.length) - 1,
  )];
}

function distribution(values: readonly (string | null)[]) {
  const present = values.filter((value): value is string => value !== null);
  return Object.fromEntries(
    [...new Set(present)].sort().map((value) => [
      value,
      present.filter((candidate) => candidate === value).length,
    ]),
  );
}

function calculate(
  results: readonly MetricResult[],
  failures: readonly MetricFailure[],
  reservedUnknownCostMicrosUsd: number,
) {
  const attemptedCallCount = results.length + failures.length;
  const responseReceivedCount = results.length
    + failures.filter(({ responseReceived }) => responseReceived).length;
  const schemaFailureCount = failures.filter(
    ({ validationStage }) => validationStage === 'SCHEMA',
  ).length;
  const schemaValidCount = Math.max(0, responseReceivedCount - schemaFailureCount);
  const groundingFailureCount = failures.filter(
    ({ validationStage }) => validationStage === 'GROUNDING',
  ).length;
  const groundingValidCount = Math.max(0, schemaValidCount - groundingFailureCount);
  const knownCosts = [
    ...results.map(({ provenance }) => provenance.costMicrosUsd),
    ...failures.map(({ knownCostMicrosUsd }) => knownCostMicrosUsd)
      .filter((value): value is number => value !== null),
  ];
  const latencies = [
    ...results.map(({ provenance }) => provenance.latencyMs),
    ...failures.map(({ safeAttempt }) => safeAttempt?.latencyMs ?? null)
      .filter((value): value is number => value !== null),
  ];
  return {
    attemptedCallCount,
    responseReceivedCount,
    transportFailureCount: failures.filter(
      ({ category }) => category === 'TRANSPORT_FAILURE',
    ).length,
    schemaValidCount,
    schemaFailureCount,
    groundingValidCount,
    groundingFailureCount,
    securityFailureCount: failures.filter(
      ({ category }) => category === 'SECURITY_CRITICAL',
    ).length,
    validReportCount: results.length,
    schemaValidityRate: responseReceivedCount === 0
      ? null
      : Math.round((schemaValidCount / responseReceivedCount) * 10_000) / 100,
    meanCostMicrosUsd: knownCosts.length === 0
      ? null
      : Math.round(knownCosts.reduce((sum, value) => sum + value, 0) / knownCosts.length),
    totalKnownCostMicrosUsd: knownCosts.reduce((sum, value) => sum + value, 0),
    reservedUnknownCostMicrosUsd,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    providerDistribution: distribution([
      ...results.map(({ provenance }) => provenance.provider),
      ...failures.map(({ safeAttempt }) => safeAttempt?.provider ?? null),
    ]),
    finishReasonDistribution: distribution([
      ...results.map(({ provenance }) => provenance.finishReason),
      ...failures.map(({ safeAttempt }) => safeAttempt?.finishReason ?? null),
    ]),
    automatedUnsupportedClaimCount: failures.filter(
      ({ normalizedErrorCode }) => normalizedErrorCode === 'UNSUPPORTED_CLAIM',
    ).length,
    humanUnsupportedClaimCount: 'PENDING' as const,
  };
}

export function calculateBenchmarkMetrics(input: Readonly<{
  results: readonly MetricResult[];
  failures: readonly MetricFailure[];
  reservedUnknownCostMicrosUsd: number;
}>) {
  const models = [...new Set([
    ...input.results.map(({ model }) => model),
    ...input.failures.map(({ model }) => model),
  ])].sort();
  return Object.freeze({
    ...calculate(input.results, input.failures, input.reservedUnknownCostMicrosUsd),
    byModel: Object.freeze(models.map((model) => Object.freeze({
      model,
      ...calculate(
        input.results.filter((result) => result.model === model),
        input.failures.filter((failure) => failure.model === model),
        0,
      ),
    }))),
  });
}
