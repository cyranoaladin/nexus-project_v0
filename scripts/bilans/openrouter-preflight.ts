import {
  chmodSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
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
import { sha256Canonical } from '../../lib/llm/openrouter/hash';
import { BILAN_MODEL_POLICY } from '../../lib/llm/openrouter/policy';
import { readPrivateOpenRouterApiKey } from '../../lib/llm/openrouter/preflight-secret';
import { readCleanGitSoftwareSha } from '../../lib/llm/openrouter/preflight-software';

const PREFLIGHT_VALIDITY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const OWNER_MAX_COST_MICROS_USD_PER_AUDIENCE_REPORT = 300_000;
const OWNER_MAX_COST_MICROS_USD_PER_ASSESSMENT = 750_000;
const OWNER_DAILY_BUDGET_MICROS_USD = 15_000_000;

function assertOwnerBudgets(config: ReturnType<typeof parseOpenRouterConfig>) {
  if (
    config.maxCostMicrosUsdPerAudienceReport
      !== OWNER_MAX_COST_MICROS_USD_PER_AUDIENCE_REPORT
    || config.maxCostMicrosUsdPerAssessment
      !== OWNER_MAX_COST_MICROS_USD_PER_ASSESSMENT
    || config.dailyBudgetMicrosUsd !== OWNER_DAILY_BUDGET_MICROS_USD
  ) {
    throw new OpenRouterError('OPENROUTER_BUDGET_EXCEEDED');
  }
}

async function main(): Promise<void> {
  const apiKey = readPrivateOpenRouterApiKey();
  const preflightSoftwareSha = readCleanGitSoftwareSha();
  const config = parseOpenRouterConfig({
    ...process.env,
    OPENROUTER_API_KEY: apiKey,
  });
  assertOwnerBudgets(config);

  const client = new OpenRouterClient(config, { preflightSoftwareSha });
  const catalogFetch = await client.fetchModelCatalogWithMetadata();
  const catalog = catalogFetch.catalog;
  const fetchedAt = new Date().toISOString();
  const verifiedAt = new Date().toISOString();
  const proof = verifyModelPolicyCapabilities(
    buildCapabilitySnapshots(catalog, { fetchedAt }),
    {
      verifiedAt,
      expiresAt: new Date(
        Date.parse(verifiedAt) + PREFLIGHT_VALIDITY_MILLISECONDS,
      ).toISOString(),
      apiKey,
      preflightSoftwareSha,
      catalogChecksum: sha256Canonical(catalog),
    },
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
      attempts: completion.attempts,
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
    proof,
    catalog: {
      responseBytes: catalogFetch.responseBytes,
      maximumResponseBytes: 32 * 1024 * 1024,
      checksum: proof.catalogChecksum,
    },
    policy: {
      id: proof.policyId,
      version: proof.policyVersion,
      checksum: proof.policyChecksum,
      retryPolicy: BILAN_MODEL_POLICY.retryPolicy,
    },
    capabilities: proof.snapshots,
    results,
    privacyConfiguration: {
      promptLoggingDisabled: 'OWNER_EVIDENCE_REQUIRED',
      completionLoggingDisabled: 'OWNER_EVIDENCE_REQUIRED',
      dataTrainingOptIn: 'OWNER_EVIDENCE_REQUIRED',
      reason: 'No verified account-settings API is part of the provider contract.',
    },
  }, null, 2)}\n`, { mode: 0o600 });
  chmodSync(evidencePath, 0o600);

  process.stdout.write(
    `OpenRouter synthetic preflight passed; privacy evidence remains owner-required. Evidence: ${evidencePath}\n`,
  );
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
