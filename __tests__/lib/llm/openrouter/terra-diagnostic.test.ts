/** @jest-environment node */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import fixture from '@/content/bilans/model-policies/openrouter-capability-baseline-v1.1.json';
import {
  buildCapabilitySnapshots,
  verifyModelPolicyCapabilities,
} from '@/lib/llm/openrouter/capabilities';
import { OpenRouterClient } from '@/lib/llm/openrouter/client';
import { parseOpenRouterConfig } from '@/lib/llm/openrouter/config';
import {
  OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
  OpenRouterContractTestSchema,
} from '@/lib/llm/openrouter/contracts';
import {
  classifyTerraDiagnosticRootCause,
  normalizeOpenRouterDiagnosticError,
  type OpenRouterDiagnosticVariant,
} from '@/lib/llm/openrouter/diagnostics';
import { sha256Canonical } from '@/lib/llm/openrouter/hash';

const API_KEY = 'synthetic-terra-diagnostic-key';
const SOFTWARE_SHA = 'd'.repeat(40);
const FIXED_NOW = Date.parse('2026-07-31T08:00:30.000Z');

type CapturedBody = Record<string, unknown>;

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  body: CapturedBody,
) => void | Promise<void>;

async function listen(handler: Handler) {
  const requests: CapturedBody[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as CapturedBody;
    requests.push(body);
    await handler(request, response, body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}/api/v1`,
    requests,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())),
  };
}

function json(
  response: ServerResponse,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
) {
  response.writeHead(status, {
    'content-type': 'application/json',
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function config(baseUrl: string) {
  return parseOpenRouterConfig({
    NODE_ENV: 'test',
    BILAN_REPORT_GENERATION_MODE: 'OPENROUTER_REQUIRED',
    OPENROUTER_API_KEY: API_KEY,
    OPENROUTER_BASE_URL: baseUrl,
    BILAN_OPENROUTER_PRIMARY_MODEL: 'anthropic/claude-sonnet-5',
    BILAN_OPENROUTER_FALLBACK_MODELS: '["openai/gpt-5.6-terra"]',
    BILAN_OPENROUTER_MODEL_POLICY_VERSION: 'bilan-model-policy-v1.1',
    BILAN_OPENROUTER_TIMEOUT_MS: '2000',
    BILAN_OPENROUTER_MAX_ATTEMPTS: '3',
    BILAN_OPENROUTER_MAX_OUTPUT_TOKENS: '2048',
    BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT: '0.30',
    BILAN_OPENROUTER_MAX_COST_USD_PER_ASSESSMENT: '0.75',
    BILAN_OPENROUTER_DAILY_BUDGET_USD: '15.00',
  });
}

function proof() {
  return verifyModelPolicyCapabilities(
    buildCapabilitySnapshots(fixture, {
      fetchedAt: '2026-07-31T08:00:00.000Z',
    }),
    {
      verifiedAt: '2026-07-31T08:00:30.000Z',
      expiresAt: '2026-08-01T08:00:30.000Z',
      apiKey: API_KEY,
      preflightSoftwareSha: SOFTWARE_SHA,
      catalogChecksum: sha256Canonical(fixture),
    },
  );
}

const completionInput = {
  messages: [
    { role: 'system' as const, content: 'synthetic diagnostic contract' },
    { role: 'user' as const, content: 'synthetic-no-pii' },
  ],
  schemaName: 'openrouter_contract_test',
  schemaVersion: 'openrouter-contract-test-v1',
  jsonSchema: OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
  validator: OpenRouterContractTestSchema,
  preflightProof: proof(),
};

function client(baseUrl: string) {
  return new OpenRouterClient(config(baseUrl), {
    now: () => FIXED_NOW,
    preflightSoftwareSha: SOFTWARE_SHA,
  });
}

const variants: readonly OpenRouterDiagnosticVariant[] = [
  {
    id: 'D1',
    outputTokenParameter: 'max_tokens',
    maxOutputTokens: 2_048,
    reasoningEffort: 'low',
  },
  {
    id: 'D2',
    outputTokenParameter: 'max_completion_tokens',
    maxOutputTokens: 2_048,
    reasoningEffort: 'low',
  },
  {
    id: 'D3',
    outputTokenParameter: 'max_tokens',
    maxOutputTokens: 2_048,
    reasoningEffort: 'none',
  },
] as const;

describe('OpenRouter Terra diagnostic contract', () => {
  it('keeps a transient predecessor failure inconclusive', () => {
    expect(classifyTerraDiagnosticRootCause([
      {
        variantId: 'D1',
        status: 'FAIL',
        httpStatus: 503,
        errorCode: 'provider_unavailable',
        retryable: true,
      },
      { variantId: 'D2', status: 'PASS' },
    ])).toBe('INCONCLUSIVE_TRANSIENT_FAILURE');
  });

  it('keeps an all-transient diagnostic without a winner inconclusive', () => {
    expect(classifyTerraDiagnosticRootCause([
      {
        variantId: 'D1',
        status: 'FAIL',
        httpStatus: 503,
        errorCode: 'provider_unavailable',
        retryable: true,
      },
      {
        variantId: 'D2',
        status: 'FAIL',
        httpStatus: 429,
        errorCode: 'rate_limit_exceeded',
        retryable: true,
      },
      {
        variantId: 'D3',
        status: 'FAIL',
        httpStatus: 408,
        errorCode: 'provider_unavailable',
        retryable: true,
      },
    ])).toBe('INCONCLUSIVE_TRANSIENT_FAILURE');
  });

  it('requires compatible contract failures before assigning a root cause', () => {
    expect(classifyTerraDiagnosticRootCause([
      {
        variantId: 'D1',
        status: 'FAIL',
        httpStatus: 400,
        errorCode: 'token_limit_exceeded',
        retryable: false,
      },
      { variantId: 'D2', status: 'PASS' },
    ])).toBe('OPENAI_OUTPUT_TOKEN_PARAMETER_ALIAS');
    expect(classifyTerraDiagnosticRootCause([
      { variantId: 'D1', status: 'PASS' },
    ])).toBe('INCONCLUSIVE_PREVIOUS_FAILURE_UNVERIFIED');
    expect(classifyTerraDiagnosticRootCause([
      {
        variantId: 'D1',
        status: 'FAIL',
        httpStatus: 400,
        errorCode: 'invalid_request',
        retryable: false,
      },
      { variantId: 'D2', status: 'PASS' },
    ])).toBe('NOT_OUTPUT_LIMIT_ONLY');
  });

  it.each([
    ['max_tokens_exceeded', 'max_tokens_exceeded'],
    ['TOKEN_LIMIT_EXCEEDED', 'token_limit_exceeded'],
    ['context-length-exceeded', 'context_length_exceeded'],
    ['permission_denied', 'permission_denied'],
    ['authentication', 'authentication'],
    ['payment_required', 'payment_required'],
    ['rate_limit_exceeded', 'rate_limit_exceeded'],
    ['invalid_request', 'invalid_request'],
    ['provider_unavailable', 'provider_unavailable'],
    ['private-provider-message', 'unknown_safe_code'],
    [42, 'unknown_safe_code'],
    [undefined, 'unknown_safe_code'],
  ])('normalizes provider value %s through a strict allowlist', (raw, expected) => {
    expect(normalizeOpenRouterDiagnosticError({
      httpStatus: 400,
      rawErrorType: raw,
      rawErrorCode: raw,
      retryable: false,
      requestVariantId: 'D1',
    })).toEqual({
      httpStatus: 400,
      errorType: expected,
      errorCode: expected,
      retryable: false,
      requestVariantId: 'D1',
    });
  });

  it.each(variants)('sends only the approved $id diagnostic variant', async (variant) => {
    const fake = await listen((_request, response, body) => {
      json(response, 200, {
        model: body.model,
        provider: 'synthetic-provider',
        choices: [{
          message: {
            content: JSON.stringify({
              schemaVersion: 'openrouter-contract-test-v1',
              status: 'ok',
              echo: 'synthetic-no-pii',
            }),
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 4,
          total_tokens: 9,
          cost: '0.0001',
        },
      }, { 'x-generation-id': `gen-${variant.id}` });
    });
    try {
      const result = await client(fake.baseUrl).diagnosePreflightVariant(
        completionInput,
        'openai/gpt-5.6-terra',
        variant,
      );
      expect(result.status).toBe('PASS');
      expect(fake.requests).toHaveLength(1);
      const body = fake.requests[0];
      expect(body.model).toBe('openai/gpt-5.6-terra');
      expect(body.reasoning).toEqual({
        effort: variant.reasoningEffort,
        exclude: true,
      });
      expect(body[variant.outputTokenParameter]).toBe(2_048);
      expect(body).not.toHaveProperty(
        variant.outputTokenParameter === 'max_tokens'
          ? 'max_completion_tokens'
          : 'max_tokens',
      );
      expect(body.provider).toEqual({
        require_parameters: true,
        data_collection: 'deny',
        zdr: true,
      });
      expect(body).not.toHaveProperty('temperature');
      expect(body).not.toHaveProperty('top_p');
      expect(body).not.toHaveProperty('seed');
      expect(body).not.toHaveProperty('tools');
      expect(body).not.toHaveProperty('plugins');
      expect(body).not.toHaveProperty('web_search');
    } finally {
      await fake.close();
    }
  });

  it('returns one safe failed result without retrying or retaining raw fields', async () => {
    const fake = await listen((_request, response) => {
      json(response, 400, {
        error: {
          type: 'max_tokens_exceeded',
          code: 'private-provider-code',
          message: 'sensitive provider message',
          metadata: {
            raw: 'sensitive raw metadata',
          },
        },
      });
    });
    try {
      const result = await client(fake.baseUrl).diagnosePreflightVariant(
        completionInput,
        'openai/gpt-5.6-terra',
        variants[0],
      );
      expect(fake.requests).toHaveLength(1);
      expect(result).toMatchObject({
        status: 'FAIL',
        variantId: 'D1',
        diagnosticError: {
          httpStatus: 400,
          errorType: 'max_tokens_exceeded',
          errorCode: 'unknown_safe_code',
          retryable: false,
          requestVariantId: 'D1',
        },
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('sensitive provider message');
      expect(serialized).not.toContain('sensitive raw metadata');
      expect(serialized).not.toContain('private-provider-code');
      expect(serialized).not.toContain(API_KEY);
    } finally {
      await fake.close();
    }
  });
});
