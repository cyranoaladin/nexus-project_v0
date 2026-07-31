import {
  chmodSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  buildCapabilitySnapshots,
  createApiKeyFingerprint,
  verifyModelPolicyCapabilities,
} from '../../lib/llm/openrouter/capabilities';
import { OpenRouterClient } from '../../lib/llm/openrouter/client';
import {
  OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
  OpenRouterContractTestSchema,
} from '../../lib/llm/openrouter/contracts';
import { parseOpenRouterConfig } from '../../lib/llm/openrouter/config';
import {
  TERRA_DIAGNOSTIC_VARIANTS,
  classifyTerraDiagnosticRootCause,
  type TerraDiagnosticOutcome,
} from '../../lib/llm/openrouter/diagnostics';
import {
  OpenRouterError,
  OpenRouterModelCompatibilityError,
} from '../../lib/llm/openrouter/errors';
import { sha256Canonical } from '../../lib/llm/openrouter/hash';
import { BILAN_MODEL_POLICY } from '../../lib/llm/openrouter/policy';
import { readPrivateOpenRouterApiKey } from '../../lib/llm/openrouter/preflight-secret';
import { readCleanGitSoftwareSha } from '../../lib/llm/openrouter/preflight-software';
import type {
  OpenRouterDiagnosticResult,
  OpenRouterDiagnosticVariant,
} from '../../lib/llm/openrouter/types';

const PROOF_VALIDITY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const DIAGNOSTIC_MAX_CALLS = 3;
const DIAGNOSTIC_MAX_TOTAL_COST_MICROS_USD = 50_000;
const DIAGNOSTIC_MAX_COST_PER_CALL_MICROS_USD = 20_000;
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

function safeVariantEvidence<T>(
  variant: OpenRouterDiagnosticVariant,
  result: OpenRouterDiagnosticResult<T>,
) {
  const parameterNames = Object.freeze([
    'model',
    'messages',
    variant.outputTokenParameter,
    'reasoning',
    'response_format',
    'provider',
    'stream',
  ]);
  if (result.status === 'PASS') {
    const provenance = result.completion.provenance;
    return Object.freeze({
      variantId: variant.id,
      status: 'PASS',
      payloadParameterNames: parameterNames,
      reasoningEffort: variant.reasoningEffort,
      httpStatus: 200,
      normalizedErrorType: null,
      normalizedErrorCode: null,
      requestedModel: provenance.requestedModel,
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
    });
  }
  const attempt = result.attempt;
  return Object.freeze({
    variantId: variant.id,
    status: 'FAIL',
    payloadParameterNames: parameterNames,
    reasoningEffort: variant.reasoningEffort,
    httpStatus: result.diagnosticError.httpStatus,
    normalizedErrorType: result.diagnosticError.errorType,
    normalizedErrorCode: result.diagnosticError.errorCode,
    retryable: result.diagnosticError.retryable,
    requestedModel: attempt?.requestedModel ?? 'openai/gpt-5.6-terra',
    returnedModel: attempt?.returnedModel ?? null,
    provider: attempt?.provider ?? null,
    generationId: attempt?.generationId ?? null,
    finishReason: attempt?.finishReason ?? null,
    promptTokens: attempt?.promptTokens ?? null,
    completionTokens: attempt?.completionTokens ?? null,
    reasoningTokens: attempt?.reasoningTokens ?? null,
    totalTokens: attempt?.totalTokens ?? null,
    costMicrosUsd: attempt?.costMicrosUsd ?? null,
    latencyMs: attempt?.latencyMs ?? null,
    schemaValid: false,
    zdrRequested: true,
    dataCollectionDenyRequested: true,
    requireParametersRequested: true,
  });
}

async function main(): Promise<void> {
  const apiKey = readPrivateOpenRouterApiKey();
  const softwareSha = readCleanGitSoftwareSha();
  const config = parseOpenRouterConfig({
    ...process.env,
    OPENROUTER_API_KEY: apiKey,
  });
  assertOwnerBudgets(config);
  const client = new OpenRouterClient(config, {
    preflightSoftwareSha: softwareSha,
  });
  const catalog = (await client.fetchModelCatalogWithMetadata()).catalog;
  const fetchedAt = new Date().toISOString();
  const verifiedAt = new Date().toISOString();
  const catalogChecksum = sha256Canonical(catalog);
  const proof = verifyModelPolicyCapabilities(
    buildCapabilitySnapshots(catalog, { fetchedAt }),
    {
      verifiedAt,
      expiresAt: new Date(
        Date.parse(verifiedAt) + PROOF_VALIDITY_MILLISECONDS,
      ).toISOString(),
      apiKey,
      preflightSoftwareSha: softwareSha,
      catalogChecksum,
    },
  );
  const request = Object.freeze({
    messages: Object.freeze([
      Object.freeze({
        role: 'system' as const,
        content:
          'Return only the strict synthetic contract. Do not use tools or external data.',
      }),
      Object.freeze({
        role: 'user' as const,
        content: 'synthetic-no-pii',
      }),
    ]),
    schemaName: 'openrouter_contract_test',
    schemaVersion: 'openrouter-contract-test-v1',
    jsonSchema: OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
    validator: OpenRouterContractTestSchema,
    preflightProof: proof,
  });

  const variantResults = [];
  const diagnosticOutcomes: TerraDiagnosticOutcome[] = [];
  let totalCostMicrosUsd = 0;
  let winningVariant: OpenRouterDiagnosticVariant | null = null;
  for (const variant of TERRA_DIAGNOSTIC_VARIANTS) {
    if (
      variantResults.length >= DIAGNOSTIC_MAX_CALLS
      || totalCostMicrosUsd + DIAGNOSTIC_MAX_COST_PER_CALL_MICROS_USD
        > DIAGNOSTIC_MAX_TOTAL_COST_MICROS_USD
    ) {
      throw new OpenRouterError('OPENROUTER_BUDGET_EXCEEDED');
    }
    const result = await client.diagnosePreflightVariant(
      request,
      'openai/gpt-5.6-terra',
      variant,
    );
    const evidence = safeVariantEvidence(variant, result);
    const callCostMicrosUsd = evidence.costMicrosUsd ?? 0;
    totalCostMicrosUsd += callCostMicrosUsd;
    if (
      callCostMicrosUsd > DIAGNOSTIC_MAX_COST_PER_CALL_MICROS_USD
      || totalCostMicrosUsd > DIAGNOSTIC_MAX_TOTAL_COST_MICROS_USD
    ) {
      throw new OpenRouterError('OPENROUTER_BUDGET_EXCEEDED');
    }
    variantResults.push(evidence);
    diagnosticOutcomes.push(result.status === 'PASS'
      ? { variantId: variant.id, status: 'PASS' }
      : {
        variantId: variant.id,
        status: 'FAIL',
        httpStatus: result.diagnosticError.httpStatus,
        errorCode: result.diagnosticError.errorCode === 'unknown_safe_code'
          ? result.diagnosticError.errorType
          : result.diagnosticError.errorCode,
        retryable: result.diagnosticError.retryable,
      });
    if (result.status === 'PASS') {
      winningVariant = variant;
      break;
    }
  }
  const rootCause = classifyTerraDiagnosticRootCause(diagnosticOutcomes);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const evidenceDirectory = join(
    homedir(),
    '.local',
    'share',
    'nexus-release-evidence',
    'bilan-openrouter-terra-diagnostic',
    timestamp,
  );
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  chmodSync(evidenceDirectory, 0o700);
  const evidencePath = join(
    evidenceDirectory,
    'terra-diagnostic.redacted.json',
  );
  writeFileSync(evidencePath, `${JSON.stringify({
    repositorySha: softwareSha,
    softwareSha,
    policyId: BILAN_MODEL_POLICY.id,
    policyVersion: BILAN_MODEL_POLICY.version,
    transportPolicyId: proof.transportPolicyId,
    transportPolicyVersion: proof.transportPolicyVersion,
    transportPolicyChecksum: proof.transportPolicyChecksum,
    catalogChecksum,
    apiKeyFingerprintRedacted:
      `hmac-sha256:${createApiKeyFingerprint(apiKey).slice(0, 12)}`,
    syntheticOnly: true,
    dataSubjectCount: 0,
    rootCause,
    limits: {
      maxCalls: DIAGNOSTIC_MAX_CALLS,
      maxTotalCostMicrosUsd: DIAGNOSTIC_MAX_TOTAL_COST_MICROS_USD,
      maxCostPerCallMicrosUsd: DIAGNOSTIC_MAX_COST_PER_CALL_MICROS_USD,
    },
    variantResults,
  }, null, 2)}\n`, { mode: 0o600 });
  chmodSync(evidencePath, 0o600);

  const status = winningVariant === null
    ? 'BLOCKED_BY_TERRA_REQUEST_CONTRACT'
    : winningVariant.id === 'D3'
      ? 'BLOCKED_BY_FALLBACK_REASONING_COMPATIBILITY'
      : `PASS:${winningVariant.id}`;
  process.stdout.write([
    `TERRA_DIAGNOSTIC_STATUS=${status}`,
    `ROOT_CAUSE=${rootCause}`,
    `TERRA_DIAGNOSTIC_CALL_COUNT=${variantResults.length}`,
    `TERRA_DIAGNOSTIC_TOTAL_COST_MICROS_USD=${totalCostMicrosUsd}`,
    `EVIDENCE_DIRECTORY=${evidenceDirectory}`,
    '',
  ].join('\n'));
  if (winningVariant === null || winningVariant.id === 'D3') {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  const code = error instanceof OpenRouterError
    ? error.code
    : error instanceof OpenRouterModelCompatibilityError
      ? error.code
      : 'OPENROUTER_TERRA_DIAGNOSTIC_FAILED';
  process.stderr.write(`TERRA_DIAGNOSTIC_STATUS=FAILED:${code}\n`);
  process.exitCode = 1;
});
