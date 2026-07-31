import 'server-only';

import { z } from 'zod';

import { sha256Canonical } from '@/lib/llm/openrouter/hash';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const StableBenchmarkRunIdentitySchema = z.object({
  repositorySha: z.string().regex(/^[a-f0-9]{40}$/),
  benchmarkPolicyChecksum: Sha256Schema,
  transportPolicyChecksum: Sha256Schema,
  datasetChecksum: Sha256Schema,
  promptChecksum: Sha256Schema,
  draftSchemaChecksum: Sha256Schema,
  finalSchemaChecksum: Sha256Schema,
  randomizationSeed: z.string().min(8).max(200),
}).strict();

const BenchmarkRunIdentityInputSchema = StableBenchmarkRunIdentitySchema.extend({
  createdAt: z.string().datetime({ offset: true }),
}).strict();

export type BenchmarkRunIdentity = Readonly<z.infer<
  typeof BenchmarkRunIdentityInputSchema
> & {
  runId: string;
}>;

export function createBenchmarkRunIdentity(
  input: z.input<typeof BenchmarkRunIdentityInputSchema>,
): BenchmarkRunIdentity {
  const parsed = BenchmarkRunIdentityInputSchema.safeParse(input);
  if (!parsed.success) throw new Error('BENCHMARK_RUN_IDENTITY_INVALID');
  const { createdAt, ...stable } = parsed.data;
  return Object.freeze({
    runId: sha256Canonical(stable),
    ...stable,
    createdAt,
  });
}
