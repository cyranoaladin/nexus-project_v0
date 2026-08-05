/**
 * Live proof that REAL_LLM_GENERATION works: ONE real OpenRouter call per
 * agent, against a fixture FactSheet (no student data, nothing written to
 * any database). Gated behind an explicit flag so it never runs by accident
 * in CI or in a normal test pass — this call costs money and hits a real
 * network endpoint.
 *
 * Usage:
 *   npx tsx scripts/bilans/prove-real-llm-generation.ts --yes-call-real-openrouter
 *
 * Requires OPENROUTER_API_KEY in the environment or in a local .env.local
 * file at the repo root (loaded here directly; the key is never logged).
 */
import fs from 'node:fs';
import path from 'node:path';

import { resolveEnabledPack } from '../../lib/bilans/api/pack-access';
import { createPseudonymizedFactSheet } from '../../lib/bilans/local-first/contracts';
import { BilanLlmGateway } from '../../lib/bilans/llm/gateway';
import { resolveOpenRouterConfig } from '../../lib/bilans/llm/config';
import { OpenRouterBilanTransport } from '../../lib/bilans/llm/openrouter-transport';
import { SECONDE_ENTRY_RECIPE_FACT_SHEETS } from '../../__tests__/bilans/fixtures/recipe-fact-sheets';

function loadDotEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^"(.*)"$/, '$1');
    }
  }
}

async function main(): Promise<number> {
  if (!process.argv.includes('--yes-call-real-openrouter')) {
    console.error('Refusing to call OpenRouter without --yes-call-real-openrouter (this makes real, billed network calls).');
    return 2;
  }

  loadDotEnvLocal();

  const enabled = resolveEnabledPack('entree-seconde-maths-v1');
  if (enabled === null) {
    console.error('Pack entree-seconde-maths-v1 is not enabled (missing feature flag or unsigned) — refusing to run.');
    return 2;
  }
  const pack = enabled.validatedPack;

  const config = resolveOpenRouterConfig();
  const transport = new OpenRouterBilanTransport(config, {
    logger: {
      info: (event) => console.info(JSON.stringify(event)),
      error: (event) => console.error(JSON.stringify(event)),
    },
  });
  const gateway = new BilanLlmGateway(transport);

  const factSheetValue = SECONDE_ENTRY_RECIPE_FACT_SHEETS[0];
  const factSheetSnapshotBefore = JSON.stringify(factSheetValue);
  const factSheet = createPseudonymizedFactSheet(factSheetValue);

  const startedAt = Date.now();
  const result = await gateway.run(factSheet, pack);
  const durationMs = Date.now() - startedAt;

  const factSheetSnapshotAfter = JSON.stringify(factSheetValue);
  const scoresUntouched = factSheetSnapshotBefore === factSheetSnapshotAfter;

  console.log(JSON.stringify({
    event: 'REAL_LLM_GENERATION_PROOF',
    model: config.model,
    durationMs,
    attempts: result.attempts,
    status: result.status,
    bundleProduced: result.bundle !== null,
    validationFailureCount: result.validationFailures.length,
    validationFailures: result.validationFailures,
    scoresUntouched,
  }, null, 2));

  if (!scoresUntouched) {
    console.error('REAL_LLM_GENERATION=FAIL — the FactSheet input was mutated by the run. This must never happen.');
    return 1;
  }
  if (result.bundle === null) {
    console.error('REAL_LLM_GENERATION=FAIL — no valid bundle produced (see validationFailures above).');
    return 1;
  }

  console.log('REAL_LLM_GENERATION=PASS');
  console.log('Generated bundle (narrative content only, no secrets):');
  console.log(JSON.stringify(result.bundle, null, 2));
  return 0;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    console.error(JSON.stringify({ event: 'REAL_LLM_GENERATION_PROOF_CRASHED', message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
