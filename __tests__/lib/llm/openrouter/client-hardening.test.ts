/** @jest-environment node */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import fixture from '@/content/bilans/model-policies/openrouter-capability-baseline-v1.1.json';
import {
  buildCapabilitySnapshots,
  verifyModelPolicyCapabilities,
} from '@/lib/llm/openrouter/capabilities';
import {
  MAX_MODEL_CATALOG_BYTES,
  OpenRouterClient,
} from '@/lib/llm/openrouter/client';
import { parseOpenRouterConfig } from '@/lib/llm/openrouter/config';
import {
  OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
  OpenRouterContractTestSchema,
} from '@/lib/llm/openrouter/contracts';
import { OpenRouterError } from '@/lib/llm/openrouter/errors';
import { sha256Canonical } from '@/lib/llm/openrouter/hash';
import type { OpenRouterRequestBody } from '@/lib/llm/openrouter/types';

const API_KEY = 'synthetic-client-key';
const SOFTWARE_SHA = 'c'.repeat(40);
const FIXED_NOW = Date.parse('2026-07-30T12:00:30.000Z');

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  body: OpenRouterRequestBody | null,
  requestNumber: number,
) => void | Promise<void>;

async function listen(handler: Handler) {
  const requests: OpenRouterRequestBody[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString('utf8');
    const body = text === '' ? null : JSON.parse(text) as OpenRouterRequestBody;
    if (body) requests.push(body);
    await handler(request, response, body, requests.length);
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

function validResponse(model: string, cost: string | number = '0.001234') {
  return {
    model,
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
      prompt_tokens: 12,
      completion_tokens: 8,
      completion_tokens_details: {
        reasoning_tokens: 3,
      },
      total_tokens: 20,
      cost,
    },
  };
}

function config(baseUrl: string, timeoutMs = '100') {
  return parseOpenRouterConfig({
    NODE_ENV: 'test',
    BILAN_REPORT_GENERATION_MODE: 'OPENROUTER_REQUIRED',
    OPENROUTER_API_KEY: API_KEY,
    OPENROUTER_BASE_URL: baseUrl,
    BILAN_OPENROUTER_PRIMARY_MODEL: 'anthropic/claude-sonnet-5',
    BILAN_OPENROUTER_FALLBACK_MODELS: '["openai/gpt-5.6-terra"]',
    BILAN_OPENROUTER_MODEL_POLICY_VERSION: 'bilan-model-policy-v1.1',
    BILAN_OPENROUTER_TIMEOUT_MS: timeoutMs,
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
      fetchedAt: '2026-07-30T12:00:00.000Z',
    }),
    {
      verifiedAt: '2026-07-30T12:00:30.000Z',
      expiresAt: '2026-07-31T12:00:30.000Z',
      apiKey: API_KEY,
      preflightSoftwareSha: SOFTWARE_SHA,
      catalogChecksum: sha256Canonical(fixture),
    },
  );
}

const completionInput = {
  messages: [
    { role: 'system' as const, content: 'synthetic system contract' },
    { role: 'user' as const, content: 'synthetic-no-pii' },
  ],
  schemaName: 'openrouter_contract_test',
  schemaVersion: 'openrouter-contract-test-v1',
  jsonSchema: OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
  validator: OpenRouterContractTestSchema,
  preflightProof: proof(),
};

function client(baseUrl: string, timeoutMs = '100') {
  return new OpenRouterClient(config(baseUrl, timeoutMs), {
    sleep: async () => undefined,
    random: () => 0,
    now: () => FIXED_NOW,
    preflightSoftwareSha: SOFTWARE_SHA,
  });
}

describe('OpenRouter C1.1 hardened transport', () => {
  it('omits every deprecated or forbidden request parameter', async () => {
    const fake = await listen((_request, response, body) => {
      json(response, 200, validResponse(body!.model), {
        'x-generation-id': 'gen-primary',
      });
    });
    try {
      const result = await client(fake.baseUrl).complete(completionInput);
      expect(result.attempts).toHaveLength(1);
      expect(result.provenance).toMatchObject({
        provider: 'synthetic-provider',
        reasoningTokens: 3,
      });
      expect(result.attempts[0]).toMatchObject({
        provider: 'synthetic-provider',
        reasoningTokens: 3,
      });
      expect(fake.requests[0]).not.toHaveProperty('usage');
      expect(fake.requests[0]).not.toHaveProperty('temperature');
      expect(fake.requests[0]).not.toHaveProperty('top_p');
      expect(fake.requests[0]).not.toHaveProperty('seed');
      expect(fake.requests[0]).not.toHaveProperty('tools');
      expect(fake.requests[0]).not.toHaveProperty('plugins');
    } finally {
      await fake.close();
    }
  });

  it('uses the exact versioned attempt plan and returns failed attempts', async () => {
    const fake = await listen((_request, response, body, requestNumber) => {
      if (requestNumber < 3) {
        json(response, 503, { error: { code: 'temporarily_unavailable' } });
        return;
      }
      json(response, 200, validResponse(body!.model), {
        'x-generation-id': 'gen-third',
      });
    });
    try {
      const result = await client(fake.baseUrl).complete(completionInput);
      expect(fake.requests.map(({ model }) => model)).toEqual([
        'anthropic/claude-sonnet-5',
        'openai/gpt-5.6-terra',
        'openai/gpt-5.6-terra',
      ]);
      expect(result.attempts.map((attempt) => ({
        number: attempt.attemptNumber,
        model: attempt.requestedModel,
        outcome: attempt.outcome,
        code: attempt.normalizedErrorCode,
      }))).toEqual([
        {
          number: 1,
          model: 'anthropic/claude-sonnet-5',
          outcome: 'FAILED',
          code: 'OPENROUTER_PROVIDER_UNAVAILABLE',
        },
        {
          number: 2,
          model: 'openai/gpt-5.6-terra',
          outcome: 'FAILED',
          code: 'OPENROUTER_PROVIDER_UNAVAILABLE',
        },
        {
          number: 3,
          model: 'openai/gpt-5.6-terra',
          outcome: 'SUCCEEDED',
          code: null,
        },
      ]);
      expect(result.provenance.attemptNumber).toBe(3);
    } finally {
      await fake.close();
    }
  });

  it('preserves all safe attempt metadata when every attempt fails', async () => {
    const fake = await listen((_request, response) => {
      json(response, 503, { error: { code: 'temporarily_unavailable' } });
    });
    try {
      const error = await client(fake.baseUrl).complete(completionInput)
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(OpenRouterError);
      expect(error).toMatchObject({
        code: 'OPENROUTER_PROVIDER_UNAVAILABLE',
        attempts: [
          { attemptNumber: 1, outcome: 'FAILED' },
          { attemptNumber: 2, outcome: 'FAILED' },
          { attemptNumber: 3, outcome: 'FAILED' },
        ],
      });
      expect(JSON.stringify(error)).not.toContain('synthetic system contract');
      expect(JSON.stringify(error)).not.toContain(API_KEY);
    } finally {
      await fake.close();
    }
  });

  it('does not retry a non-retryable invalid request', async () => {
    const fake = await listen((_request, response) => {
      json(response, 400, {
        error: {
          code: 'invalid_request',
          message: 'raw provider detail must be discarded',
          metadata: { private: 'discard-me' },
        },
      });
    });
    try {
      const error = await client(fake.baseUrl).complete(completionInput)
        .catch((caught: unknown) => caught);
      expect(error).toMatchObject({
        code: 'OPENROUTER_INVALID_REQUEST',
        retryable: false,
        attempts: [{ attemptNumber: 1 }],
      });
      expect(JSON.stringify(error)).not.toContain('raw provider detail');
      expect(JSON.stringify(error)).not.toContain('discard-me');
      expect(fake.requests).toHaveLength(1);
    } finally {
      await fake.close();
    }
  });

  it('distinguishes a generic 503 from an explicit no-compliant-provider error', async () => {
    const generic = await listen((_request, response) => {
      json(response, 503, { error: { code: 'temporary_outage' } });
    });
    try {
      await expect(client(generic.baseUrl).complete(completionInput)).rejects
        .toMatchObject({ code: 'OPENROUTER_PROVIDER_UNAVAILABLE' });
    } finally {
      await generic.close();
    }

    const explicit = await listen((_request, response) => {
      json(response, 503, {
        error: { code: 'NO_COMPLIANT_PROVIDER' },
      });
    });
    try {
      await expect(client(explicit.baseUrl).complete(completionInput)).rejects
        .toMatchObject({ code: 'OPENROUTER_NO_COMPLIANT_PROVIDER' });
    } finally {
      await explicit.close();
    }
  });

  it('maps only allowlisted provider codes without retaining raw fields', async () => {
    const fake = await listen((_request, response) => {
      json(response, 402, {
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: 'provider account detail',
        },
      });
    });
    try {
      const error = await client(fake.baseUrl).complete(completionInput)
        .catch((caught: unknown) => caught);
      expect(error).toMatchObject({
        code: 'OPENROUTER_INSUFFICIENT_CREDITS',
        retryable: false,
      });
      expect(JSON.stringify(error)).not.toContain('provider account detail');
    } finally {
      await fake.close();
    }
  });

  it.each([
    [400, 'NO_COMPLIANT_PROVIDER', 'OPENROUTER_INVALID_REQUEST'],
    [401, 'RATE_LIMITED', 'OPENROUTER_INVALID_CREDENTIALS'],
    [402, 'RATE_LIMITED', 'OPENROUTER_INSUFFICIENT_CREDITS'],
    [403, 'NO_COMPLIANT_PROVIDER', 'OPENROUTER_POLICY_REJECTED'],
  ])(
    'keeps non-retryable HTTP %i authoritative over provider code %s',
    async (status, providerCode, expectedCode) => {
      const fake = await listen((_request, response) => {
        json(response, status, { error: { code: providerCode } });
      });
      try {
        const error = await client(fake.baseUrl).complete(completionInput)
          .catch((caught: unknown) => caught);
        expect(error).toMatchObject({
          code: expectedCode,
          retryable: false,
          attempts: [{ attemptNumber: 1 }],
        });
        expect(fake.requests).toHaveLength(1);
      } finally {
        await fake.close();
      }
    },
  );

  it.each(['length', 'error', 'content_filter', 'cancelled', null, 'unknown'])(
    'rejects non-stop finish_reason=%s',
    async (finishReason) => {
      const fake = await listen((_request, response, body) => {
        const payload = validResponse(body!.model);
        payload.choices[0].finish_reason = finishReason as string;
        json(response, 200, payload, {
          'x-generation-id': 'gen-incomplete',
        });
      });
      try {
        await expect(client(fake.baseUrl).complete(completionInput)).rejects
          .toMatchObject({
            code: 'OPENROUTER_INCOMPLETE_RESPONSE',
            retryable: false,
          });
      } finally {
        await fake.close();
      }
    },
  );

  it('enforces the audience budget in integer micro-USD', async () => {
    const fake = await listen((_request, response, body) => {
      json(response, 200, validResponse(body!.model, '0.300001'), {
        'x-generation-id': 'gen-over-budget',
      });
    });
    try {
      await expect(client(fake.baseUrl).complete(completionInput)).rejects
        .toMatchObject({ code: 'OPENROUTER_BUDGET_EXCEEDED' });
    } finally {
      await fake.close();
    }
  });

  it('rounds sub-micro provider cost upward without accepting exponent config', async () => {
    const fake = await listen((_request, response, body) => {
      json(response, 200, validResponse(body!.model, 1e-7), {
        'x-generation-id': 'gen-sub-micro',
      });
    });
    try {
      const result = await client(fake.baseUrl).complete(completionInput);
      expect(result.provenance.costMicrosUsd).toBe(1);
    } finally {
      await fake.close();
    }
  });

  it('rejects a numeric provider cost infinitesimally above the budget', async () => {
    const fake = await listen((_request, response, body) => {
      json(response, 200, validResponse(body!.model, 0.3000000000004), {
        'x-generation-id': 'gen-fractionally-over-budget',
      });
    });
    try {
      await expect(client(fake.baseUrl).complete(completionInput)).rejects
        .toMatchObject({ code: 'OPENROUTER_BUDGET_EXCEEDED' });
    } finally {
      await fake.close();
    }
  });

  it('keeps known partial cost and nulls unknown usage in failed attempts', async () => {
    const partial = await listen((_request, response, body) => {
      const payload = validResponse(body!.model);
      payload.choices[0].finish_reason = 'length';
      json(response, 200, payload, {
        'x-generation-id': 'gen-partial-cost',
      });
    });
    try {
      const error = await client(partial.baseUrl).complete(completionInput)
        .catch((caught: unknown) => caught) as OpenRouterError;
      expect(error.attempts[0]).toMatchObject({
        costMicrosUsd: 1_234,
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
        finishReason: 'length',
      });
    } finally {
      await partial.close();
    }

    const noUsage = await listen((_request, response, body) => {
      const { usage: _usage, ...payload } = validResponse(body!.model);
      json(response, 200, payload, {
        'x-generation-id': 'gen-no-usage',
      });
    });
    try {
      const error = await client(noUsage.baseUrl).complete(completionInput)
        .catch((caught: unknown) => caught) as OpenRouterError;
      expect(error.attempts[0]).toMatchObject({
        costMicrosUsd: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      });
    } finally {
      await noUsage.close();
    }
  });

  it('uses a dedicated bounded limit for the model catalog', async () => {
    const fake = await listen((request, response) => {
      expect(request.url).toBe('/api/v1/models');
      response.writeHead(200, {
        'content-length': String(MAX_MODEL_CATALOG_BYTES + 1),
      });
      response.end();
    });
    try {
      await expect(client(fake.baseUrl, '5000').fetchModelCatalog()).rejects
        .toMatchObject({ code: 'OPENROUTER_INVALID_RESPONSE' });
    } finally {
      await fake.close();
    }
  });

  it('rejects a chunked model catalog exceeding its dedicated limit', async () => {
    const fake = await listen((request, response) => {
      expect(request.url).toBe('/api/v1/models');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(Buffer.alloc(MAX_MODEL_CATALOG_BYTES + 1, 0x20));
    });
    try {
      await expect(client(fake.baseUrl, '5000').fetchModelCatalog()).rejects
        .toMatchObject({ code: 'OPENROUTER_INVALID_RESPONSE' });
    } finally {
      await fake.close();
    }
  });

  it('captures a safe generation id from a failed provider response', async () => {
    const fake = await listen((_request, response) => {
      json(
        response,
        503,
        { error: { code: 'temporary_outage' } },
        { 'x-generation-id': 'gen-failed-safe' },
      );
    });
    try {
      const error = await client(fake.baseUrl).complete(completionInput)
        .catch((caught: unknown) => caught) as OpenRouterError;
      expect(error.attempts).toHaveLength(3);
      expect(error.attempts.every(
        ({ generationId }) => generationId === 'gen-failed-safe',
      )).toBe(true);
    } finally {
      await fake.close();
    }
  });
});
