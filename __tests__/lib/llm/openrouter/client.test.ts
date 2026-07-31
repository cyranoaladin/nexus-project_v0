/** @jest-environment node */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import fixture from '@/content/bilans/model-policies/openrouter-capability-baseline-v1.1.json';
import {
  buildCapabilitySnapshots,
  verifyModelPolicyCapabilities,
} from '@/lib/llm/openrouter/capabilities';
import {
  OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
  OpenRouterContractTestSchema,
} from '@/lib/llm/openrouter/contracts';
import {
  OpenRouterClient,
  type OpenRouterClientDependencies,
} from '@/lib/llm/openrouter/client';
import { parseOpenRouterConfig } from '@/lib/llm/openrouter/config';
import { sha256Canonical } from '@/lib/llm/openrouter/hash';
import type {
  OpenRouterRequestBody,
} from '@/lib/llm/openrouter/types';
import {
  BILAN_MODEL_POLICY_CONFIG_VERSION,
} from '@/lib/llm/openrouter/policy';

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  body: OpenRouterRequestBody,
) => void | Promise<void>;

const API_KEY = 'synthetic-test-key';
const SOFTWARE_SHA = 'e'.repeat(40);

const validResponse = (model = 'anthropic/claude-sonnet-5') => ({
  id: 'chatcmpl-synthetic',
  model,
  provider: 'synthetic-provider',
  choices: [{
    message: {
      role: 'assistant',
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
    total_tokens: 20,
    cost: 0.001234,
  },
});

async function listen(handler: Handler) {
  const requests: OpenRouterRequestBody[] = [];
  const requestHeaders: IncomingMessage['headers'][] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as OpenRouterRequestBody;
    requests.push(body);
    requestHeaders.push(request.headers);
    await handler(request, response, body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}/api/v1`,
    requests,
    requestHeaders,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())),
  };
}

function proof(catalog: unknown = fixture) {
  const fetchedAt = new Date().toISOString();
  const verifiedAt = fetchedAt;
  return verifyModelPolicyCapabilities(
    buildCapabilitySnapshots(catalog, {
      fetchedAt,
    }),
    {
      verifiedAt,
      expiresAt: new Date(
        Date.parse(verifiedAt) + (24 * 60 * 60 * 1_000),
      ).toISOString(),
      apiKey: API_KEY,
      preflightSoftwareSha: SOFTWARE_SHA,
      catalogChecksum: sha256Canonical(catalog),
    },
  );
}

function config(baseUrl: string, overrides: Record<string, string> = {}) {
  return parseOpenRouterConfig({
    NODE_ENV: 'test',
    BILAN_REPORT_GENERATION_MODE: 'OPENROUTER_REQUIRED',
    OPENROUTER_API_KEY: API_KEY,
    OPENROUTER_BASE_URL: baseUrl,
    BILAN_OPENROUTER_PRIMARY_MODEL: 'anthropic/claude-sonnet-5',
    BILAN_OPENROUTER_FALLBACK_MODELS: '["openai/gpt-5.6-terra"]',
    BILAN_OPENROUTER_MODEL_POLICY_VERSION: BILAN_MODEL_POLICY_CONFIG_VERSION,
    BILAN_OPENROUTER_TIMEOUT_MS: '100',
    BILAN_OPENROUTER_MAX_ATTEMPTS: '3',
    BILAN_OPENROUTER_MAX_OUTPUT_TOKENS: '2048',
    BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT: '0.30',
    BILAN_OPENROUTER_MAX_COST_USD_PER_ASSESSMENT: '0.75',
    BILAN_OPENROUTER_DAILY_BUDGET_USD: '15',
    ...overrides,
  });
}

function createClient(
  baseUrl: string,
  overrides: Record<string, string> = {},
  dependencies: OpenRouterClientDependencies = {},
) {
  return new OpenRouterClient(config(baseUrl, overrides), {
    preflightSoftwareSha: SOFTWARE_SHA,
    ...dependencies,
  });
}

const contractRequest = {
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

describe('OpenRouter client', () => {
  it('sends the exact v1.1 payload without sampling, tools or opaque model fallback', async () => {
    const fake = await listen((_request, response) =>
      json(response, 200, validResponse(), {
        'x-generation-id': 'gen-synthetic-1',
      }));
    try {
      const result = await createClient(fake.baseUrl).complete(
        contractRequest,
      );
      expect(result.data.status).toBe('ok');
      expect(result.provenance).toMatchObject({
        requestedModel: 'anthropic/claude-sonnet-5',
        returnedModel: 'anthropic/claude-sonnet-5',
        canonicalSlug: 'anthropic/claude-sonnet-5-20260630',
        outputTokenParameter: 'max_tokens',
        generationId: 'gen-synthetic-1',
        finishReason: 'stop',
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
        costMicrosUsd: 1234,
        attemptNumber: 1,
        policyId: 'bilan-model-policy',
        policyVersion: '1.1',
      });

      expect(fake.requests).toHaveLength(1);
      expect(fake.requestHeaders[0]).toMatchObject({
        authorization: 'Bearer synthetic-test-key',
        'content-type': 'application/json',
        'http-referer': 'https://nexusreussite.academy',
        'x-title': 'Nexus Réussite - Bilans pédagogiques',
      });
      expect(fake.requests[0]).toEqual({
        model: 'anthropic/claude-sonnet-5',
        messages: contractRequest.messages,
        max_tokens: 2048,
        reasoning: { effort: 'low', exclude: true },
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'openrouter_contract_test',
            strict: true,
            schema: OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
          },
        },
        provider: {
          require_parameters: true,
          data_collection: 'deny',
          zdr: true,
        },
        stream: false,
      });
      expect(fake.requests[0]).not.toHaveProperty('temperature');
      expect(fake.requests[0]).not.toHaveProperty('top_p');
      expect(fake.requests[0]).not.toHaveProperty('seed');
      expect(fake.requests[0]).not.toHaveProperty('tools');
      expect(fake.requests[0]).not.toHaveProperty('plugins');
      expect(fake.requests[0]).not.toHaveProperty('models');
    } finally {
      await fake.close();
    }
  });

  it('uses an application-controlled fallback only after a retryable failure', async () => {
    const fake = await listen((_request, response, body) => {
      if (body.model === 'anthropic/claude-sonnet-5') {
        return json(response, 503, { error: { code: 503 } });
      }
      return json(response, 200, validResponse('openai/gpt-5.6-terra'), {
        'x-generation-id': 'gen-fallback',
      });
    });
    try {
      const client = createClient(fake.baseUrl, {}, {
        sleep: async () => undefined,
        random: () => 0,
      });
      const result = await client.complete(contractRequest);

      expect(fake.requests.map(({ model }) => model)).toEqual([
        'anthropic/claude-sonnet-5',
        'openai/gpt-5.6-terra',
      ]);
      expect(fake.requests[0]).toHaveProperty('max_tokens', 2_048);
      expect(fake.requests[0]).not.toHaveProperty('max_completion_tokens');
      expect(fake.requests[1]).toHaveProperty(
        'max_completion_tokens',
        2_048,
      );
      expect(fake.requests[1]).not.toHaveProperty('max_tokens');
      expect(result.provenance.requestedModel).toBe('openai/gpt-5.6-terra');
      expect(result.provenance.outputTokenParameter).toBe(
        'max_completion_tokens',
      );
      expect(result.provenance.attemptNumber).toBe(2);
    } finally {
      await fake.close();
    }
  });

  it.each([
    [400, 'OPENROUTER_INVALID_REQUEST', false],
    [401, 'OPENROUTER_INVALID_CREDENTIALS', false],
    [402, 'OPENROUTER_INSUFFICIENT_CREDITS', false],
    [403, 'OPENROUTER_POLICY_REJECTED', false],
    [408, 'OPENROUTER_TIMEOUT', true],
    [429, 'OPENROUTER_RATE_LIMITED', true],
    [502, 'OPENROUTER_PROVIDER_UNAVAILABLE', true],
    [503, 'OPENROUTER_PROVIDER_UNAVAILABLE', true],
  ])('maps HTTP %s to %s', async (status, code, retryable) => {
    const fake = await listen((_request, response) =>
      json(response, status, { error: { code: status, message: 'redacted upstream' } }));
    try {
      await expect(
        createClient(fake.baseUrl, {}, {
          sleep: async () => undefined,
          random: () => 0,
        }).complete(contractRequest),
      ).rejects.toMatchObject({ code, retryable });
      expect(fake.requests).toHaveLength(retryable ? 3 : 1);
    } finally {
      await fake.close();
    }
  });

  it('maps an empty 401 response before attempting JSON parsing', async () => {
    const fake = await listen((_request, response) => {
      response.writeHead(401);
      response.end();
    });
    try {
      await expect(
        createClient(fake.baseUrl).complete(contractRequest),
      ).rejects.toMatchObject({
        code: 'OPENROUTER_INVALID_CREDENTIALS',
        retryable: false,
      });
    } finally {
      await fake.close();
    }
  });

  it('uses the fallback for a retryable non-JSON provider response', async () => {
    let requestCount = 0;
    const fake = await listen((_request, response) => {
      requestCount += 1;
      if (requestCount === 1) {
        response.writeHead(503, {
          'content-type': 'text/html',
          'retry-after': '0',
        });
        response.end('<html>temporary upstream outage</html>');
        return;
      }
      json(response, 200, validResponse('openai/gpt-5.6-terra'), {
        'x-generation-id': 'gen-after-non-json-503',
      });
    });
    try {
      const result = await createClient(fake.baseUrl, {}, {
        sleep: async () => undefined,
        random: () => 0,
      }).complete(contractRequest);

      expect(fake.requests.map(({ model }) => model)).toEqual([
        'anthropic/claude-sonnet-5',
        'openai/gpt-5.6-terra',
      ]);
      expect(result.provenance.generationId).toBe(
        'gen-after-non-json-503',
      );
    } finally {
      await fake.close();
    }
  });

  it('respects Retry-After before the next bounded attempt', async () => {
    const sleep = jest.fn(async () => undefined);
    let requestCount = 0;
    const fake = await listen((_request, response) => {
      requestCount += 1;
      if (requestCount === 1) {
        return json(response, 429, { error: { code: 429 } }, {
          'retry-after': '2',
        });
      }
      return json(response, 200, validResponse('openai/gpt-5.6-terra'), {
        'x-generation-id': 'gen-after-retry',
      });
    });
    try {
      await createClient(fake.baseUrl, {}, {
        sleep,
        random: () => 0,
      }).complete(contractRequest);
      expect(sleep).toHaveBeenCalledWith(2_000);
    } finally {
      await fake.close();
    }
  });

  it('caps an excessive Retry-After before retrying', async () => {
    const sleep = jest.fn(async () => undefined);
    let requestCount = 0;
    const fake = await listen((_request, response) => {
      requestCount += 1;
      if (requestCount === 1) {
        return json(response, 429, { error: { code: 429 } }, {
          'retry-after': '86400',
        });
      }
      return json(response, 200, validResponse('openai/gpt-5.6-terra'), {
        'x-generation-id': 'gen-after-capped-retry',
      });
    });
    try {
      await createClient(fake.baseUrl, {}, {
        sleep,
        random: () => 0,
      }).complete(contractRequest);
      expect(sleep).toHaveBeenCalledWith(30_000);
    } finally {
      await fake.close();
    }
  });

  it.each([
    ['invalid JSON', (_response: ServerResponse) => {
      _response.writeHead(200, {
        'content-type': 'application/json',
        'x-generation-id': 'gen-invalid-json',
      });
      _response.end('{');
    }, 'OPENROUTER_INVALID_RESPONSE'],
    ['empty body', (response: ServerResponse) => {
      response.writeHead(200, { 'x-generation-id': 'gen-empty' });
      response.end('');
    }, 'OPENROUTER_INVALID_RESPONSE'],
    ['schema failure', (response: ServerResponse) =>
      json(response, 200, {
        ...validResponse(),
        choices: [{
          message: { role: 'assistant', content: '{"status":"not-ok"}' },
          finish_reason: 'stop',
        }],
      }, { 'x-generation-id': 'gen-schema' }), 'OPENROUTER_SCHEMA_FAILURE'],
    ['finish error', (response: ServerResponse) =>
      json(response, 200, {
        ...validResponse(),
        choices: [{
          message: { role: 'assistant', content: '' },
          finish_reason: 'error',
        }],
      }, { 'x-generation-id': 'gen-finish-error' }), 'OPENROUTER_INCOMPLETE_RESPONSE'],
    ['missing generation id', (response: ServerResponse) =>
      json(response, 200, validResponse()), 'OPENROUTER_INVALID_RESPONSE'],
    ['missing usage', (response: ServerResponse) => {
      const { usage: _usage, ...payload } = validResponse();
      json(response, 200, payload, { 'x-generation-id': 'gen-no-usage' });
    }, 'OPENROUTER_INVALID_RESPONSE'],
    ['inconsistent token total', (response: ServerResponse) =>
      json(response, 200, {
        ...validResponse(),
        usage: {
          prompt_tokens: 12,
          completion_tokens: 8,
          total_tokens: 999,
          cost: 0.001234,
        },
      }, { 'x-generation-id': 'gen-token-mismatch' }), 'OPENROUTER_INVALID_RESPONSE'],
  ])('fails closed on %s', async (_label, respond, code) => {
    const fake = await listen((_request, response) => respond(response));
    try {
      await expect(
        createClient(fake.baseUrl).complete(contractRequest),
      ).rejects.toMatchObject({ code });
    } finally {
      await fake.close();
    }
  });

  it('fails on timeout without leaking request content', async () => {
    const fake = await listen(async () =>
      new Promise<void>((resolve) => setTimeout(resolve, 250)));
    const consoleSpies = [
      jest.spyOn(console, 'log').mockImplementation(),
      jest.spyOn(console, 'info').mockImplementation(),
      jest.spyOn(console, 'warn').mockImplementation(),
      jest.spyOn(console, 'error').mockImplementation(),
    ];
    try {
      await expect(
        createClient(
          fake.baseUrl,
          { BILAN_OPENROUTER_TIMEOUT_MS: '20' },
          { sleep: async () => undefined, random: () => 0 },
        ).complete(contractRequest),
      ).rejects.toMatchObject({ code: 'OPENROUTER_TIMEOUT' });
      for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of consoleSpies) spy.mockRestore();
      await fake.close();
    }
  });

  it('rejects an oversized response before buffering its body', async () => {
    const fake = await listen((_request, response) => {
      response.writeHead(200, {
        'content-length': String((4 * 1024 * 1024) + 1),
        'x-generation-id': 'gen-oversized',
      });
      response.end();
    });
    try {
      await expect(
        createClient(fake.baseUrl).complete(contractRequest),
      ).rejects.toMatchObject({ code: 'OPENROUTER_INVALID_RESPONSE' });
    } finally {
      await fake.close();
    }
  });

  it('rejects stale and implausibly future preflight proofs', async () => {
    const currentTime = Date.parse('2026-07-30T12:00:00.000Z');
    const staleRequest = {
      ...contractRequest,
      preflightProof: {
        ...contractRequest.preflightProof,
        verifiedAt: '2026-07-29T11:59:59.999Z',
      },
    };
    const futureRequest = {
      ...contractRequest,
      preflightProof: {
        ...contractRequest.preflightProof,
        verifiedAt: '2026-07-30T12:05:00.001Z',
      },
    };
    const fake = await listen((_request, response) =>
      json(response, 200, validResponse(), {
        'x-generation-id': 'must-not-be-called',
      }));
    const client = createClient(fake.baseUrl, {}, {
      now: () => currentTime,
    });
    try {
      await expect(client.complete(staleRequest)).rejects.toMatchObject({
        code: 'OPENROUTER_POLICY_REJECTED',
      });
      await expect(client.complete(futureRequest)).rejects.toMatchObject({
        code: 'OPENROUTER_POLICY_REJECTED',
      });
      expect(fake.requests).toHaveLength(0);
    } finally {
      await fake.close();
    }
  });

  it('rejects an over-budget response and a returned model mismatch', async () => {
    const overBudget = await listen((_request, response) =>
      json(response, 200, {
        ...validResponse(),
        usage: {
          prompt_tokens: 12,
          completion_tokens: 8,
          total_tokens: 20,
          cost: 0.75,
        },
      }, { 'x-generation-id': 'gen-expensive' }));
    try {
      await expect(
        createClient(overBudget.baseUrl).complete(contractRequest),
      ).rejects.toMatchObject({ code: 'OPENROUTER_BUDGET_EXCEEDED' });
    } finally {
      await overBudget.close();
    }

    const mismatched = await listen((_request, response) =>
      json(response, 200, validResponse('unapproved/model'), {
        'x-generation-id': 'gen-wrong-model',
      }));
    try {
      await expect(
        createClient(mismatched.baseUrl).complete(contractRequest),
      ).rejects.toMatchObject({ code: 'OPENROUTER_POLICY_REJECTED' });
    } finally {
      await mismatched.close();
    }
  });

  it('performs no retry after a non-retryable error', async () => {
    const fake = await listen((_request, response) =>
      json(response, 401, { error: { code: 401 } }));
    try {
      await expect(
        createClient(fake.baseUrl).complete(contractRequest),
      ).rejects.toMatchObject({ code: 'OPENROUTER_INVALID_CREDENTIALS' });
      expect(fake.requests).toHaveLength(1);
    } finally {
      await fake.close();
    }
  });

  it('treats a 200 error envelope as an error without retrying invalid requests', async () => {
    const fake = await listen((_request, response) =>
      json(response, 200, {
        error: { code: 400, message: 'redacted upstream' },
      }));
    try {
      await expect(
        createClient(fake.baseUrl).complete(contractRequest),
      ).rejects.toMatchObject({
        code: 'OPENROUTER_INVALID_REQUEST',
        retryable: false,
      });
      expect(fake.requests).toHaveLength(1);
    } finally {
      await fake.close();
    }
  });

  it('refuses an output token limit larger than the capability snapshot', async () => {
    const limitedCatalog = structuredClone(fixture);
    limitedCatalog.data[0].top_provider.max_completion_tokens = 1_000;
    const limitedRequest = {
      ...contractRequest,
      preflightProof: proof(limitedCatalog),
    };
    const fake = await listen((_request, response) =>
      json(response, 200, validResponse(), {
        'x-generation-id': 'must-not-be-called',
      }));
    try {
      await expect(
        createClient(fake.baseUrl).complete(limitedRequest),
      ).rejects.toMatchObject({
        code: 'OPENROUTER_POLICY_REJECTED',
        retryable: false,
      });
      expect(fake.requests).toHaveLength(0);
    } finally {
      await fake.close();
    }
  });
});
