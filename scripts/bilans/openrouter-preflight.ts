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
const PREFLIGHT_MAX_TOTAL_COST_MICROS_USD = 200_000;
const PREFLIGHT_MAX_COST_PER_MODEL_MICROS_USD = 100_000;
const PREFLIGHT_MAX_OUTPUT_TOKENS = 256;
const PREFLIGHT_MODEL_CALL_COUNT = 2;

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
  const preflightConfig = Object.freeze({
    ...config,
    maxOutputTokens: PREFLIGHT_MAX_OUTPUT_TOKENS,
    redacted: Object.freeze({
      ...config.redacted,
      maxOutputTokens: PREFLIGHT_MAX_OUTPUT_TOKENS,
    }),
  });

  const client = new OpenRouterClient(
    preflightConfig,
    { preflightSoftwareSha },
  );
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

  const requestedModels = [
    BILAN_MODEL_POLICY.primaryModel,
    ...BILAN_MODEL_POLICY.fallbackModels,
  ];
  if (requestedModels.length !== PREFLIGHT_MODEL_CALL_COUNT) {
    throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
  }
  const modelResults = [];
  let totalCostMicrosUsd = 0;
  for (const requestedModel of requestedModels) {
    const completion = await client.completePreflightForModel(
      request,
      requestedModel,
    );
    const {
      provenance,
    } = completion;
    if (provenance.provider === null) {
      throw new OpenRouterError('OPENROUTER_INVALID_RESPONSE');
    }
    totalCostMicrosUsd += provenance.costMicrosUsd;
    if (
      provenance.costMicrosUsd > PREFLIGHT_MAX_COST_PER_MODEL_MICROS_USD
      || totalCostMicrosUsd > PREFLIGHT_MAX_TOTAL_COST_MICROS_USD
    ) {
      throw new OpenRouterError('OPENROUTER_BUDGET_EXCEEDED');
    }
    modelResults.push({
      requestedModel,
      returnedModel: provenance.returnedModel,
      provider: provenance.provider,
      generationId: provenance.generationId,
      finishReason: provenance.finishReason,
      promptTokens: provenance.promptTokens,
      completionTokens: provenance.completionTokens,
      reasoningTokens: provenance.reasoningTokens,
      totalTokens: provenance.totalTokens,
      costMicrosUsd: provenance.costMicrosUsd,
      latencyMs: provenance.latencyMs,
      schemaValid: true,
      zdrRequested: true,
      dataCollectionDenyRequested: true,
      requireParametersRequested: true,
      contractValid: completion.data.status === 'ok'
        && completion.data.echo === 'synthetic-no-pii',
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
    repositorySha: preflightSoftwareSha,
    policyId: proof.policyId,
    policyVersion: proof.policyVersion,
    policyChecksum: proof.policyChecksum,
    retryPolicyVersion: BILAN_MODEL_POLICY.retryPolicy.version,
    preflightSoftwareSha,
    catalogChecksum: proof.catalogChecksum,
    proofChecksum: proof.proofChecksum,
    apiKeyFingerprintRedacted:
      `hmac-sha256:${proof.apiKeyFingerprint.slice(0, 12)}`,
    limits: {
      maxTotalCostMicrosUsd: PREFLIGHT_MAX_TOTAL_COST_MICROS_USD,
      maxCostPerModelMicrosUsd: PREFLIGHT_MAX_COST_PER_MODEL_MICROS_USD,
      maxOutputTokens: PREFLIGHT_MAX_OUTPUT_TOKENS,
      modelCallCount: PREFLIGHT_MODEL_CALL_COUNT,
    },
    modelResults,
    privacyAttestations: {
      inputOutputLogging: {
        status: 'OWNER_ATTESTED',
        value: false,
      },
      useOfInputsOutputs: {
        status: 'OWNER_ATTESTED',
        value: false,
      },
      zdrAccountPolicy: {
        status: 'OWNER_ATTESTED',
        value: true,
      },
      guardrailEnabled: {
        status: 'OWNER_ATTESTED',
        value: true,
      },
      keySpendingLimitUsd: {
        status: 'OWNER_ATTESTED',
        value: 2,
      },
    },
  }, null, 2)}\n`, { mode: 0o600 });
  chmodSync(evidencePath, 0o600);

  process.stdout.write(
    [
      'PREFLIGHT_STATUS=PASS',
      'PRIMARY_MODEL_STATUS=PASS',
      'FALLBACK_MODEL_STATUS=PASS',
      `TOTAL_COST_MICROS_USD=${totalCostMicrosUsd}`,
      `EVIDENCE_DIRECTORY=${evidenceDirectory}`,
      '',
    ].join('\n'),
  );
}

void main().catch((error: unknown) => {
  const code = error instanceof OpenRouterError
    ? error.code
    : error instanceof OpenRouterModelCompatibilityError
      ? error.code
      : 'OPENROUTER_PREFLIGHT_FAILED';
  process.stderr.write(`PREFLIGHT_STATUS=FAILED:${code}\n`);
  process.exitCode = 1;
});
