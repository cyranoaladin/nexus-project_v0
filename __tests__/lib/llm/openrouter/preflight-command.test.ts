/** @jest-environment node */

import { execFile } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import fixture from '@/content/bilans/model-policies/openrouter-capability-baseline-v1.1.json';
import type { OpenRouterRequestBody } from '@/lib/llm/openrouter/types';

const execFileAsync = promisify(execFile);

describe('private OpenRouter preflight command', () => {
  it('uses only synthetic data and writes redacted evidence with private permissions', async () => {
    const home = mkdtempSync(join(tmpdir(), 'nexus-openrouter-preflight-'));
    chmodSync(home, 0o700);
    const secretDirectory = join(home, '.config', 'nexus-secrets');
    mkdirSync(secretDirectory, { recursive: true, mode: 0o700 });
    chmodSync(join(home, '.config'), 0o700);
    chmodSync(secretDirectory, 0o700);
    const keyPath = join(secretDirectory, 'openrouter-api-key');
    writeFileSync(keyPath, 'synthetic-preflight-key\n', { mode: 0o600 });
    chmodSync(keyPath, 0o600);
    const requests: OpenRouterRequestBody[] = [];
    const server = createServer(async (request, response) => {
      if (request.method === 'GET' && request.url === '/api/v1/models') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(fixture));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(
        Buffer.concat(chunks).toString('utf8'),
      ) as OpenRouterRequestBody;
      requests.push(body);
      response.writeHead(200, {
        'content-type': 'application/json',
        'x-generation-id': `gen-${requests.length}`,
      });
      response.end(JSON.stringify({
        model: body.model,
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
          prompt_tokens: 5,
          completion_tokens: 4,
          completion_tokens_details: {
            reasoning_tokens: 2,
          },
          total_tokens: 9,
          cost: 0.0001,
        },
      }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Fake OpenRouter server did not bind to a TCP port.');
    }

    try {
      const { stdout, stderr } = await execFileAsync(
        resolve('node_modules/.bin/tsx'),
        ['--conditions=react-server', 'scripts/bilans/openrouter-preflight.ts'],
        {
          cwd: process.cwd(),
          env: {
            PATH: process.env.PATH,
            HOME: home,
            NODE_ENV: 'test',
            BILAN_REPORT_GENERATION_MODE: 'OPENROUTER_REQUIRED',
            OPENROUTER_BASE_URL:
              `http://127.0.0.1:${address.port}/api/v1`,
            BILAN_OPENROUTER_PRIMARY_MODEL: 'anthropic/claude-sonnet-5',
            BILAN_OPENROUTER_FALLBACK_MODELS:
              '["openai/gpt-5.6-terra"]',
            BILAN_OPENROUTER_MODEL_POLICY_VERSION:
              'bilan-model-policy-v1.1',
            BILAN_OPENROUTER_TIMEOUT_MS: '2000',
            BILAN_OPENROUTER_MAX_ATTEMPTS: '3',
            BILAN_OPENROUTER_MAX_OUTPUT_TOKENS: '2048',
            BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT: '0.30',
            BILAN_OPENROUTER_MAX_COST_USD_PER_ASSESSMENT: '0.75',
            BILAN_OPENROUTER_DAILY_BUDGET_USD: '15.00',
          },
        },
      );

      expect(stderr).toBe('');
      expect(stdout.trim().split('\n')).toEqual([
        'PREFLIGHT_STATUS=PASS',
        'PRIMARY_MODEL_STATUS=PASS',
        'FALLBACK_MODEL_STATUS=PASS',
        'TOTAL_COST_MICROS_USD=200',
        expect.stringMatching(/^EVIDENCE_DIRECTORY=.+$/),
      ]);
      expect(stdout).not.toContain('synthetic-preflight-key');
      expect(requests.map(({ model }) => model)).toEqual([
        'anthropic/claude-sonnet-5',
        'openai/gpt-5.6-terra',
      ]);
      expect(requests[0]).toHaveProperty('max_tokens', 2_048);
      expect(requests[0]).not.toHaveProperty('max_completion_tokens');
      expect(requests[1]).toHaveProperty(
        'max_completion_tokens',
        2_048,
      );
      expect(requests[1]).not.toHaveProperty('max_tokens');
      for (const body of requests) {
        expect(body.reasoning).toEqual({ effort: 'low', exclude: true });
        expect(body).not.toHaveProperty('usage');
        expect(body).not.toHaveProperty('temperature');
        expect(body).not.toHaveProperty('top_p');
        expect(body).not.toHaveProperty('seed');
      }

      const root = join(
        home,
        '.local/share/nexus-release-evidence/bilan-openrouter-preflight',
      );
      const [timestamp] = readdirSync(root);
      const directory = join(root, timestamp);
      const reportPath = join(directory, 'preflight.redacted.json');
      expect(statSync(directory).mode & 0o777).toBe(0o700);
      expect(statSync(reportPath).mode & 0o777).toBe(0o600);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report).toMatchObject({
        syntheticOnly: true,
        dataSubjectCount: 0,
        repositorySha: expect.stringMatching(/^[a-f0-9]{40}$/),
        policyId: 'bilan-model-policy',
        policyVersion: '1.1',
        policyChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        transportPolicyId: 'bilan-openrouter-transport-policy',
        transportPolicyVersion: '1',
        transportPolicyChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        retryPolicyVersion: '1',
        preflightSoftwareSha: expect.stringMatching(/^[a-f0-9]{40}$/),
        catalogChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        proofChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        apiKeyFingerprintRedacted: expect.stringMatching(
          /^hmac-sha256:[a-f0-9]{12}$/,
        ),
        limits: {
          maxTotalCostMicrosUsd: 200_000,
          maxCostPerModelMicrosUsd: 100_000,
          maxOutputTokens: 2_048,
          modelCallCount: 2,
        },
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
      });
      expect(report.modelResults).toHaveLength(2);
      expect(report.modelResults[0]).toMatchObject({
        requestedModel: 'anthropic/claude-sonnet-5',
        outputTokenParameter: 'max_tokens',
        returnedModel: 'anthropic/claude-sonnet-5',
        provider: 'synthetic-provider',
        finishReason: 'stop',
        promptTokens: 5,
        completionTokens: 4,
        reasoningTokens: 2,
        totalTokens: 9,
        costMicrosUsd: 100,
        schemaValid: true,
        zdrRequested: true,
        dataCollectionDenyRequested: true,
        requireParametersRequested: true,
        contractValid: true,
      });
      expect(report.modelResults[1]).toMatchObject({
        requestedModel: 'openai/gpt-5.6-terra',
        outputTokenParameter: 'max_completion_tokens',
      });
      expect(report).not.toHaveProperty('proof');
      expect(report).not.toHaveProperty('configuration');
      expect(JSON.stringify(report)).not.toContain('synthetic-preflight-key');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('stops before the fallback call when the primary exceeds its preflight cap', async () => {
    const home = mkdtempSync(join(tmpdir(), 'nexus-openrouter-preflight-cap-'));
    chmodSync(home, 0o700);
    const secretDirectory = join(home, '.config', 'nexus-secrets');
    mkdirSync(secretDirectory, { recursive: true, mode: 0o700 });
    chmodSync(join(home, '.config'), 0o700);
    chmodSync(secretDirectory, 0o700);
    const keyPath = join(secretDirectory, 'openrouter-api-key');
    writeFileSync(keyPath, 'synthetic-preflight-key\n', { mode: 0o600 });
    chmodSync(keyPath, 0o600);
    let modelCallCount = 0;
    const server = createServer(async (request, response) => {
      if (request.method === 'GET' && request.url === '/api/v1/models') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(fixture));
        return;
      }
      modelCallCount += 1;
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(
        Buffer.concat(chunks).toString('utf8'),
      ) as OpenRouterRequestBody;
      response.writeHead(200, {
        'content-type': 'application/json',
        'x-generation-id': 'gen-over-cap',
      });
      response.end(JSON.stringify({
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
          cost: 0.100001,
        },
      }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Fake OpenRouter server did not bind to a TCP port.');
    }

    try {
      await expect(execFileAsync(
        resolve('node_modules/.bin/tsx'),
        ['--conditions=react-server', 'scripts/bilans/openrouter-preflight.ts'],
        {
          cwd: process.cwd(),
          env: {
            PATH: process.env.PATH,
            HOME: home,
            NODE_ENV: 'test',
            BILAN_REPORT_GENERATION_MODE: 'OPENROUTER_REQUIRED',
            OPENROUTER_BASE_URL:
              `http://127.0.0.1:${address.port}/api/v1`,
            BILAN_OPENROUTER_PRIMARY_MODEL: 'anthropic/claude-sonnet-5',
            BILAN_OPENROUTER_FALLBACK_MODELS:
              '["openai/gpt-5.6-terra"]',
            BILAN_OPENROUTER_MODEL_POLICY_VERSION:
              'bilan-model-policy-v1.1',
            BILAN_OPENROUTER_TIMEOUT_MS: '2000',
            BILAN_OPENROUTER_MAX_ATTEMPTS: '3',
            BILAN_OPENROUTER_MAX_OUTPUT_TOKENS: '2048',
            BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT: '0.30',
            BILAN_OPENROUTER_MAX_COST_USD_PER_ASSESSMENT: '0.75',
            BILAN_OPENROUTER_DAILY_BUDGET_USD: '15.00',
          },
        },
      )).rejects.toMatchObject({
        stderr: 'PREFLIGHT_STATUS=FAILED:OPENROUTER_BUDGET_EXCEEDED\n',
      });
      expect(modelCallCount).toBe(1);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('records a model-specific failure and still verifies the other approved model', async () => {
    const home = mkdtempSync(join(tmpdir(), 'nexus-openrouter-preflight-model-'));
    chmodSync(home, 0o700);
    const secretDirectory = join(home, '.config', 'nexus-secrets');
    mkdirSync(secretDirectory, { recursive: true, mode: 0o700 });
    chmodSync(join(home, '.config'), 0o700);
    chmodSync(secretDirectory, 0o700);
    const keyPath = join(secretDirectory, 'openrouter-api-key');
    writeFileSync(keyPath, 'synthetic-preflight-key\n', { mode: 0o600 });
    chmodSync(keyPath, 0o600);
    const requestedModels: string[] = [];
    const server = createServer(async (request, response) => {
      if (request.method === 'GET' && request.url === '/api/v1/models') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(fixture));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(
        Buffer.concat(chunks).toString('utf8'),
      ) as OpenRouterRequestBody;
      requestedModels.push(body.model);
      if (requestedModels.length === 1) {
        response.writeHead(400, {
          'content-type': 'application/json',
          'x-generation-id': 'gen-primary-invalid',
        });
        response.end(JSON.stringify({
          error: {
            code: 'invalid_request',
            message: 'raw provider detail must remain private',
          },
        }));
        return;
      }
      response.writeHead(200, {
        'content-type': 'application/json',
        'x-generation-id': 'gen-fallback-ok',
      });
      response.end(JSON.stringify({
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
          cost: 0.0001,
        },
      }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Fake OpenRouter server did not bind to a TCP port.');
    }

    try {
      const error = await execFileAsync(
        resolve('node_modules/.bin/tsx'),
        ['--conditions=react-server', 'scripts/bilans/openrouter-preflight.ts'],
        {
          cwd: process.cwd(),
          env: {
            PATH: process.env.PATH,
            HOME: home,
            NODE_ENV: 'test',
            BILAN_REPORT_GENERATION_MODE: 'OPENROUTER_REQUIRED',
            OPENROUTER_BASE_URL:
              `http://127.0.0.1:${address.port}/api/v1`,
            BILAN_OPENROUTER_PRIMARY_MODEL: 'anthropic/claude-sonnet-5',
            BILAN_OPENROUTER_FALLBACK_MODELS:
              '["openai/gpt-5.6-terra"]',
            BILAN_OPENROUTER_MODEL_POLICY_VERSION:
              'bilan-model-policy-v1.1',
            BILAN_OPENROUTER_TIMEOUT_MS: '2000',
            BILAN_OPENROUTER_MAX_ATTEMPTS: '3',
            BILAN_OPENROUTER_MAX_OUTPUT_TOKENS: '2048',
            BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT: '0.30',
            BILAN_OPENROUTER_MAX_COST_USD_PER_ASSESSMENT: '0.75',
            BILAN_OPENROUTER_DAILY_BUDGET_USD: '15.00',
          },
        },
      ).catch((caught: unknown) => caught as {
        stdout: string;
        stderr: string;
      });

      expect(requestedModels).toEqual([
        'anthropic/claude-sonnet-5',
        'openai/gpt-5.6-terra',
      ]);
      expect(error.stderr).toBe('');
      expect(error.stdout.trim().split('\n')).toEqual([
        'PREFLIGHT_STATUS=BLOCKED_BY_PRIMARY_MODEL_PREFLIGHT',
        'PRIMARY_MODEL_STATUS=FAIL:OPENROUTER_INVALID_REQUEST',
        'FALLBACK_MODEL_STATUS=PASS',
        'TOTAL_COST_MICROS_USD=100',
        expect.stringMatching(/^EVIDENCE_DIRECTORY=.+$/),
      ]);
      expect(error.stdout).not.toContain('raw provider detail');
      const evidenceDirectory = error.stdout.trim().split('\n')[4]
        .replace('EVIDENCE_DIRECTORY=', '');
      const report = JSON.parse(readFileSync(
        join(evidenceDirectory, 'preflight.redacted.json'),
        'utf8',
      ));
      expect(report.modelResults).toEqual([
        expect.objectContaining({
          requestedModel: 'anthropic/claude-sonnet-5',
          status: 'FAIL',
          normalizedErrorCode: 'OPENROUTER_INVALID_REQUEST',
          generationId: 'gen-primary-invalid',
          contractValid: false,
        }),
        expect.objectContaining({
          requestedModel: 'openai/gpt-5.6-terra',
          status: 'PASS',
          normalizedErrorCode: null,
          contractValid: true,
        }),
      ]);
      expect(JSON.stringify(report)).not.toContain('raw provider detail');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
      rmSync(home, { recursive: true, force: true });
    }
  });
});
