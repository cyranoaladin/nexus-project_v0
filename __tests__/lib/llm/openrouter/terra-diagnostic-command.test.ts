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

const execFileAsync = promisify(execFile);

type CapturedBody = Record<string, unknown>;

function createPrivateHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'nexus-terra-diagnostic-'));
  chmodSync(home, 0o700);
  const configDirectory = join(home, '.config');
  const secretDirectory = join(configDirectory, 'nexus-secrets');
  mkdirSync(secretDirectory, { recursive: true, mode: 0o700 });
  chmodSync(configDirectory, 0o700);
  chmodSync(secretDirectory, 0o700);
  const keyPath = join(secretDirectory, 'openrouter-api-key');
  writeFileSync(keyPath, 'synthetic-terra-key\n', { mode: 0o600 });
  chmodSync(keyPath, 0o600);
  return home;
}

function environment(home: string, baseUrl: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: home,
    NODE_ENV: 'test',
    BILAN_REPORT_GENERATION_MODE: 'OPENROUTER_REQUIRED',
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
  };
}

describe('bounded Terra diagnostic command', () => {
  it('tries D1 then D2, stops on success, and writes only redacted evidence', async () => {
    const home = createPrivateHome();
    const requests: CapturedBody[] = [];
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
      ) as CapturedBody;
      requests.push(body);
      if (requests.length === 1) {
        response.writeHead(400, {
          'content-type': 'application/json',
          'x-generation-id': 'gen-d1-failed',
        });
        response.end(JSON.stringify({
          error: {
            type: 'token_limit_exceeded',
            code: 'not-allowlisted-private-code',
            message: 'private provider message',
            metadata: { raw: 'private raw body' },
          },
        }));
        return;
      }
      response.writeHead(200, {
        'content-type': 'application/json',
        'x-generation-id': 'gen-d2-pass',
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
          prompt_tokens: 7,
          completion_tokens: 5,
          completion_tokens_details: { reasoning_tokens: 2 },
          total_tokens: 12,
          cost: '0.001',
        },
      }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Fake server did not bind.');
    }

    try {
      const { stdout, stderr } = await execFileAsync(
        resolve('node_modules/.bin/tsx'),
        [
          '--conditions=react-server',
          'scripts/bilans/openrouter-terra-diagnostic.ts',
        ],
        {
          cwd: process.cwd(),
          env: environment(
            home,
            `http://127.0.0.1:${address.port}/api/v1`,
          ),
        },
      );

      expect(stderr).toBe('');
      expect(stdout.trim().split('\n')).toEqual([
        'TERRA_DIAGNOSTIC_STATUS=PASS:D2',
        'ROOT_CAUSE=OPENAI_OUTPUT_TOKEN_PARAMETER_ALIAS',
        'TERRA_DIAGNOSTIC_CALL_COUNT=2',
        'TERRA_DIAGNOSTIC_TOTAL_COST_MICROS_USD=1000',
        expect.stringMatching(/^EVIDENCE_DIRECTORY=.+$/),
      ]);
      expect(requests).toHaveLength(2);
      expect(requests[0]).toHaveProperty('max_tokens', 2_048);
      expect(requests[0]).not.toHaveProperty('max_completion_tokens');
      expect(requests[1]).toHaveProperty('max_completion_tokens', 2_048);
      expect(requests[1]).not.toHaveProperty('max_tokens');
      expect(requests.every(({ model }) =>
        model === 'openai/gpt-5.6-terra')).toBe(true);

      const root = join(
        home,
        '.local/share/nexus-release-evidence/bilan-openrouter-terra-diagnostic',
      );
      const [timestamp] = readdirSync(root);
      const directory = join(root, timestamp);
      const reportPath = join(directory, 'terra-diagnostic.redacted.json');
      expect(statSync(directory).mode & 0o777).toBe(0o700);
      expect(statSync(reportPath).mode & 0o777).toBe(0o600);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report).toMatchObject({
        repositorySha: expect.stringMatching(/^[a-f0-9]{40}$/),
        softwareSha: expect.stringMatching(/^[a-f0-9]{40}$/),
        policyId: 'bilan-model-policy',
        policyVersion: '1.1',
        catalogChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        apiKeyFingerprintRedacted: expect.stringMatching(
          /^hmac-sha256:[a-f0-9]{12}$/,
        ),
        syntheticOnly: true,
        dataSubjectCount: 0,
        rootCause: 'OPENAI_OUTPUT_TOKEN_PARAMETER_ALIAS',
        limits: {
          maxCalls: 3,
          maxTotalCostMicrosUsd: 50_000,
          maxCostPerCallMicrosUsd: 20_000,
        },
      });
      expect(report.variantResults).toHaveLength(2);
      expect(report.variantResults[0]).toMatchObject({
        variantId: 'D1',
        payloadParameterNames: expect.arrayContaining([
          'max_tokens',
          'reasoning',
          'response_format',
          'provider',
        ]),
        reasoningEffort: 'low',
        httpStatus: 400,
        normalizedErrorType: 'token_limit_exceeded',
        normalizedErrorCode: 'unknown_safe_code',
      });
      expect(report.variantResults[1]).toMatchObject({
        variantId: 'D2',
        reasoningEffort: 'low',
        returnedModel: 'openai/gpt-5.6-terra',
        provider: 'synthetic-provider',
        finishReason: 'stop',
        costMicrosUsd: 1_000,
        schemaValid: true,
      });
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain('private provider message');
      expect(serialized).not.toContain('private raw body');
      expect(serialized).not.toContain('not-allowlisted-private-code');
      expect(serialized).not.toContain('synthetic-terra-key');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('registers the canonical command without any automatic retry flag', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(packageJson.scripts['bilan:openrouter:diagnose-terra']).toBe(
      'tsx --conditions=react-server scripts/bilans/openrouter-terra-diagnostic.ts',
    );
  });
});
