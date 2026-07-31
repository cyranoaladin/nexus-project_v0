/** @jest-environment node */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import syntheticFixture from '@/content/bilans/benchmarks/synthetic-v1/synthetic-simple-01.json';
import {
  AI_ASSISTANCE_DISCLOSURE,
  ParentReportDraftSchema,
  REPORT_PARENT_DRAFT_JSON_SCHEMA,
  buildParentLlmPayload,
} from '@/lib/bilans/benchmark/report-contracts';
import {
  runSyntheticParentBenchmark,
} from '@/lib/bilans/benchmark/runner';
import {
  buildLocalFirstReportContext,
} from '@/lib/bilans/local-first/contracts';
import {
  buildBenchmarkCapabilityProof,
} from '@/lib/llm/openrouter/benchmark-capabilities';
import { OpenRouterClient } from '@/lib/llm/openrouter/client';
import { parseOpenRouterConfig } from '@/lib/llm/openrouter/config';
import {
  OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
  OpenRouterContractTestSchema,
} from '@/lib/llm/openrouter/contracts';
import {
  BILAN_MODEL_POLICY_CONFIG_VERSION,
} from '@/lib/llm/openrouter/policy';

const API_KEY = 'synthetic-benchmark-key';
const SOFTWARE_SHA = 'b'.repeat(40);
const catalog = {
  data: [
    {
      id: 'openai/gpt-5.6-luna',
      canonical_slug: 'openai/gpt-5.6-luna-20260709',
      context_length: 128000,
      supported_parameters: [
        'response_format',
        'structured_outputs',
        'max_completion_tokens',
        'reasoning',
      ],
      top_provider: { max_completion_tokens: 32768 },
      reasoning: { supported_efforts: ['low'] },
    },
    {
      id: 'openai/gpt-5.6-terra',
      canonical_slug: 'openai/gpt-5.6-terra',
      context_length: 128000,
      supported_parameters: [
        'response_format',
        'structured_outputs',
        'max_completion_tokens',
        'reasoning',
      ],
      top_provider: { max_completion_tokens: 32768 },
      reasoning: { supported_efforts: ['low'] },
    },
    {
      id: 'anthropic/claude-sonnet-5',
      canonical_slug: 'anthropic/claude-sonnet-5',
      context_length: 200000,
      supported_parameters: [
        'response_format',
        'structured_outputs',
        'max_tokens',
        'reasoning',
      ],
      top_provider: { max_completion_tokens: 32768 },
      reasoning: { supported_efforts: ['low'] },
    },
  ],
};

function config(baseUrl: string) {
  return parseOpenRouterConfig({
    NODE_ENV: 'test',
    BILAN_REPORT_GENERATION_MODE: 'OPENROUTER_REQUIRED',
    OPENROUTER_API_KEY: API_KEY,
    OPENROUTER_BASE_URL: baseUrl,
    BILAN_OPENROUTER_MODEL_POLICY_VERSION:
      BILAN_MODEL_POLICY_CONFIG_VERSION,
    BILAN_OPENROUTER_MAX_ATTEMPTS: '3',
    BILAN_OPENROUTER_MAX_OUTPUT_TOKENS: '2048',
    BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT: '0.30',
    BILAN_OPENROUTER_MAX_COST_USD_PER_ASSESSMENT: '0.75',
    BILAN_OPENROUTER_DAILY_BUDGET_USD: '15',
  });
}

function proof() {
  const now = new Date().toISOString();
  return buildBenchmarkCapabilityProof(catalog, {
    apiKey: API_KEY,
    softwareSha: SOFTWARE_SHA,
    fetchedAt: now,
    verifiedAt: now,
    expiresAt: new Date(Date.parse(now) + 3_600_000).toISOString(),
  });
}

describe('OpenRouter synthetic benchmark client', () => {
  it('uses the unique client, exact model transport and no retry', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requests.push(body);
      response.writeHead(200, {
        'content-type': 'application/json',
        'x-generation-id': 'gen-luna-synthetic',
      });
      response.end(JSON.stringify({
        model: 'openai/gpt-5.6-luna',
        provider: 'synthetic-zdr-provider',
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
          prompt_tokens: 8,
          completion_tokens: 6,
          total_tokens: 14,
          cost: '0.000123',
        },
      }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      const client = new OpenRouterClient(
        config(`http://127.0.0.1:${port}/api/v1`),
        { preflightSoftwareSha: SOFTWARE_SHA },
      );
      const completion = await client.completeBenchmarkForModel({
        messages: [
          { role: 'system', content: 'synthetic contract only' },
          { role: 'user', content: 'synthetic-no-pii' },
        ],
        schemaName: 'openrouter_contract_test',
        schemaVersion: 'openrouter-contract-test-v1',
        jsonSchema: OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
        validator: OpenRouterContractTestSchema,
        benchmarkProof: proof(),
      }, 'openai/gpt-5.6-luna');

      expect(completion.provenance).toMatchObject({
        requestedModel: 'openai/gpt-5.6-luna',
        returnedModel: 'openai/gpt-5.6-luna',
        outputTokenParameter: 'max_completion_tokens',
        policyId: 'bilan-model-benchmark-policy',
        policyVersion: '1',
        costMicrosUsd: 123,
      });
      expect(completion.attempts).toHaveLength(1);
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        model: 'openai/gpt-5.6-luna',
        max_completion_tokens: 2048,
        reasoning: { effort: 'low', exclude: true },
        provider: {
          require_parameters: true,
          data_collection: 'deny',
          zdr: true,
        },
        stream: false,
      });
      expect(requests[0]).not.toHaveProperty('max_tokens');
      expect(requests[0]).not.toHaveProperty('temperature');
      expect(requests[0]).not.toHaveProperty('tools');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('rejects proof tampering before network access', async () => {
    const client = new OpenRouterClient(config('http://127.0.0.1:1/api/v1'), {
      preflightSoftwareSha: SOFTWARE_SHA,
    });
    await expect(client.completeBenchmarkForModel({
      messages: [{ role: 'user', content: 'synthetic-no-pii' }],
      schemaName: 'openrouter_contract_test',
      schemaVersion: 'openrouter-contract-test-v1',
      jsonSchema: OPENROUTER_CONTRACT_TEST_JSON_SCHEMA,
      validator: OpenRouterContractTestSchema,
      benchmarkProof: {
        ...proof(),
        policyChecksum: '0'.repeat(64),
      },
    }, 'openai/gpt-5.6-luna')).rejects.toMatchObject({
      code: 'OPENROUTER_POLICY_REJECTED',
    });
  });

  it('runs the benchmark boundary against a local HTTP server', async () => {
    let requestCount = 0;
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requestCount += 1;
      const draft = {
        schemaVersion: 'bilan-report-parent-draft-v1',
        audience: 'PARENT',
        title: 'Bilan synthétique de mathématiques',
        summary:
          'Les acquis observés sont solides et peuvent être entretenus par un travail régulier.',
        strengths: [{
          competencyId: 'cmp:calcul',
          title: 'Calcul numérique',
          explanation:
            'Les procédures sont appliquées avec régularité sur la preuve disponible.',
          evidenceRefs: ['ev:s01:calcul'],
        }],
        priorities: [{
          competencyId: 'cmp:calcul',
          title: 'Entretenir les automatismes',
          explanation:
            'Une pratique courte aidera à conserver la régularité observée.',
          priority: 'LOW',
          evidenceRefs: ['ev:s01:calcul'],
        }],
        actionPlan: [{
          recommendationId: 'rec:s01',
          title: 'Conserver un entraînement régulier',
          rationale: 'Les acquis sont solides sur la preuve disponible.',
          actions: ['Réaliser deux séries courtes chaque semaine.'],
          cadence: 'Deux fois par semaine',
          durationWeeks: 3,
          evidenceRefs: ['ev:s01:calcul'],
        }],
        unmeasuredAreas: [],
        cautionNotes: [
          'Les conclusions restent limitées aux compétences mesurées.',
        ],
        closingMessage: AI_ASSISTANCE_DISCLOSURE,
      };
      response.writeHead(200, {
        'content-type': 'application/json',
        'x-generation-id': `gen-fake-${requestCount}`,
      });
      response.end(JSON.stringify({
        model: body.model,
        provider: 'synthetic-zdr-provider',
        choices: [{
          message: { content: JSON.stringify(draft) },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 80,
          total_tokens: 180,
          cost: '0.000500',
        },
      }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      const client = new OpenRouterClient(
        config(`http://127.0.0.1:${port}/api/v1`),
        { preflightSoftwareSha: SOFTWARE_SHA },
      );
      const context = buildLocalFirstReportContext(
        syntheticFixture,
        'PARENT',
      );
      const benchmarkProof = proof();
      const run = await runSyntheticParentBenchmark({
        contexts: [context],
        models: [
          'openai/gpt-5.6-luna',
          'openai/gpt-5.6-terra',
          'anthropic/claude-sonnet-5',
        ],
        hardStopMicrosUsd: 1_500_000,
        warningMicrosUsd: 1_000_000,
        complete: async ({ model }) => {
          const completion = await client.completeBenchmarkForModel({
            messages: [
              { role: 'system', content: 'Synthetic report contract.' },
              {
                role: 'user',
                content: JSON.stringify(buildParentLlmPayload(context)),
              },
            ],
            schemaName: 'bilan_report_parent_draft_v1',
            schemaVersion: 'bilan-report-parent-draft-v1',
            jsonSchema: REPORT_PARENT_DRAFT_JSON_SCHEMA,
            validator: ParentReportDraftSchema,
            benchmarkProof,
          }, model as Parameters<
            typeof client.completeBenchmarkForModel
          >[1]);
          return {
            data: completion.data,
            provenance: completion.provenance,
          };
        },
      });
      expect(requestCount).toBe(3);
      expect(run.callCount).toBe(3);
      expect(run.totalCostMicrosUsd).toBe(1_500);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
