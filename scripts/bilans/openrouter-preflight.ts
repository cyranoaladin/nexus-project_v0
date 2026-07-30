import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  buildCapabilitySnapshots,
  verifyModelPolicyCapabilities,
} from '../../lib/llm/openrouter/capabilities';
import { OpenRouterClient } from '../../lib/llm/openrouter/client';
import {
  OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
  OpenRouterContractTestSchema,
} from '../../lib/llm/openrouter/contracts';
import { parseOpenRouterConfig } from '../../lib/llm/openrouter/config';
import {
  OpenRouterError,
  OpenRouterModelCompatibilityError,
} from '../../lib/llm/openrouter/errors';
import { BILAN_MODEL_POLICY } from '../../lib/llm/openrouter/policy';

async function main(): Promise<void> {
  const config = parseOpenRouterConfig(process.env);
  const client = new OpenRouterClient(config);
  const catalog = await client.fetchModelCatalog();
  const fetchedAt = new Date().toISOString();
  const proof = verifyModelPolicyCapabilities(
    buildCapabilitySnapshots(catalog, { fetchedAt }),
    { verifiedAt: new Date().toISOString() },
  );

  const request = {
    messages: [
      {
        role: 'system' as const,
        content: 'Return only the strict synthetic contract. Do not use tools or external data.',
      },
      {
        role: 'user' as const,
        content: 'synthetic-no-pii',
      },
    ],
    schemaName: 'openrouter_contract_test',
    schemaVersion: 'openrouter-contract-test-v1',
    jsonSchema: OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
    validator: OpenRouterContractTestSchema,
    preflightProof: proof,
  };

  const results = [];
  for (const requestedModel of [
    BILAN_MODEL_POLICY.primaryModel,
    ...BILAN_MODEL_POLICY.fallbackModels,
  ]) {
    const completion = await client.completePreflightForModel(
      request,
      requestedModel,
    );
    results.push({
      requestedModel,
      contractValid: completion.data.status === 'ok'
        && completion.data.echo === 'synthetic-no-pii',
      provenance: completion.provenance,
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const evidenceDirectory = join(
    homedir(),
    '.local',
    'share',
    'nexus-release-evidence',
    'bilan-openrouter-preflight',
    timestamp,
  );
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  chmodSync(evidenceDirectory, 0o700);
  const evidencePath = join(evidenceDirectory, 'preflight.redacted.json');
  writeFileSync(evidencePath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    syntheticOnly: true,
    dataSubjectCount: 0,
    configuration: config.redacted,
    policy: {
      id: proof.policyId,
      version: proof.policyVersion,
      checksum: proof.policyChecksum,
    },
    capabilities: proof.snapshots,
    results,
  }, null, 2)}\n`, { mode: 0o600 });
  chmodSync(evidencePath, 0o600);

  process.stdout.write(`OpenRouter synthetic preflight passed. Evidence: ${evidencePath}\n`);
}

void main().catch((error: unknown) => {
  const code = error instanceof OpenRouterError
    ? error.code
    : error instanceof OpenRouterModelCompatibilityError
      ? error.code
      : 'OPENROUTER_PREFLIGHT_FAILED';
  process.stderr.write(`OpenRouter synthetic preflight failed: ${code}\n`);
  process.exitCode = 1;
});
