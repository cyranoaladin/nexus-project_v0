const DEFAULT_ITERATIONS = 20;
const DEFAULT_P95_LIMIT_MS = 500;

type BenchmarkResult = {
  route: string;
  iterations: number;
  p95Milliseconds: number;
  maximumMilliseconds: number;
};

function percentile(values: readonly number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function benchmarkRoute(baseUrl: URL, route: string, iterations: number): Promise<BenchmarkResult> {
  const durations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    const response = await fetch(new URL(route, baseUrl), { cache: 'no-store' });
    if (!response.ok) throw new Error(`${route} a répondu HTTP ${response.status}`);
    await response.arrayBuffer();
    durations.push(performance.now() - startedAt);
  }
  return {
    route,
    iterations,
    p95Milliseconds: percentile(durations, 0.95),
    maximumMilliseconds: Math.max(...durations),
  };
}

async function main(): Promise<void> {
  const rawBaseUrl = process.env.BENCHMARK_BASE_URL;
  if (!rawBaseUrl) throw new Error('BENCHMARK_BASE_URL doit cibler un serveur jetable déjà démarré.');
  const baseUrl = new URL(rawBaseUrl);
  const iterations = Number(process.env.BENCHMARK_ITERATIONS ?? DEFAULT_ITERATIONS);
  const limit = Number(process.env.BENCHMARK_P95_LIMIT_MS ?? DEFAULT_P95_LIMIT_MS);
  if (!Number.isInteger(iterations) || iterations < 1 || !Number.isFinite(limit) || limit <= 0) {
    throw new Error('Configuration de benchmark invalide.');
  }

  const results = await Promise.all([
    benchmarkRoute(baseUrl, '/api/health', iterations),
    benchmarkRoute(baseUrl, '/', iterations),
  ]);
  process.stdout.write(`${JSON.stringify({ limitP95Milliseconds: limit, results }, null, 2)}\n`);
  if (results.some((result) => result.p95Milliseconds > limit)) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Benchmark interrompu'}\n`);
  process.exitCode = 1;
});
