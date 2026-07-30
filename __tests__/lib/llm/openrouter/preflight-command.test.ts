/** @jest-environment node */

import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
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
            OPENROUTER_API_KEY: 'synthetic-preflight-key',
            OPENROUTER_BASE_URL:
              `http://127.0.0.1:${address.port}/api/v1`,
            BILAN_OPENROUTER_PRIMARY_MODEL: 'anthropic/claude-sonnet-5',
            BILAN_OPENROUTER_FALLBACK_MODELS:
              '["openai/gpt-5.6-terra"]',
            BILAN_OPENROUTER_MODEL_POLICY_VERSION:
              'bilan-model-policy-v1.1',
            BILAN_OPENROUTER_TIMEOUT_MS: '2000',
            BILAN_OPENROUTER_MAX_ATTEMPTS: '1',
            BILAN_OPENROUTER_MAX_OUTPUT_TOKENS: '256',
            BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT: '0.50',
            BILAN_OPENROUTER_DAILY_BUDGET_USD: '25',
          },
        },
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('OpenRouter synthetic preflight passed.');
      expect(stdout).not.toContain('synthetic-preflight-key');
      expect(requests.map(({ model }) => model)).toEqual([
        'anthropic/claude-sonnet-5',
        'openai/gpt-5.6-terra',
      ]);
      for (const body of requests) {
        expect(body.reasoning).toEqual({ effort: 'low', exclude: true });
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
        configuration: {
          apiKeyConfigured: true,
        },
      });
      expect(JSON.stringify(report)).not.toContain('synthetic-preflight-key');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
      rmSync(home, { recursive: true, force: true });
    }
  });
});
