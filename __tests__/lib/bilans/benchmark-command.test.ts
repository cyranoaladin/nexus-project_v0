/** @jest-environment node */

import { execFile } from 'node:child_process';
import {
  chmodSync,
  existsSync,
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

import { AI_ASSISTANCE_DISCLOSURE } from '@/lib/bilans/benchmark/report-contracts';
import { createOwnerPrivacyAttestation } from '@/lib/llm/openrouter/privacy-attestation';

const execFileAsync = promisify(execFile);
const MODELS = [
  ['openai/gpt-5.6-luna', 'max_completion_tokens'],
  ['openai/gpt-5.6-terra', 'max_completion_tokens'],
  ['anthropic/claude-sonnet-5', 'max_tokens'],
] as const;

function privateHome(apiKey: string): string {
  const home = mkdtempSync(join(tmpdir(), 'nexus-benchmark-command-'));
  chmodSync(home, 0o700);
  const config = join(home, '.config');
  const secrets = join(config, 'nexus-secrets');
  mkdirSync(secrets, { recursive: true, mode: 0o700 });
  chmodSync(config, 0o700);
  chmodSync(secrets, 0o700);
  writeFileSync(join(secrets, 'openrouter-api-key'), `${apiKey}\n`, {
    mode: 0o600,
  });
  const now = Date.now();
  const attestation = createOwnerPrivacyAttestation({
    apiKey,
    attestedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 24 * 60 * 60 * 1_000).toISOString(),
    inputOutputLogging: false,
    useOfInputsOutputs: false,
    zdrAccountPolicy: true,
    guardrailEnabled: true,
    keySpendingLimitMicrosUsd: 2_000_000,
  });
  writeFileSync(
    join(secrets, 'openrouter-privacy-attestation.json'),
    `${JSON.stringify(attestation)}\n`,
    { mode: 0o600 },
  );
  return home;
}

function catalog() {
  return {
    data: MODELS.map(([id, outputParameter]) => ({
      id,
      canonical_slug: id,
      context_length: 128_000,
      supported_parameters: [
        'response_format',
        'structured_outputs',
        outputParameter,
        'reasoning',
      ],
      top_provider: { max_completion_tokens: 32_768 },
      reasoning: { supported_efforts: ['low'] },
      pricing: {
        prompt: '0.000000001',
        completion: '0.000000002',
        internal_reasoning: '0.000000002',
        request: '0',
      },
    })),
  };
}

function draftFromPayload(payload: Record<string, unknown>) {
  const competencies = payload.competencies as Array<{
    competencyId: string;
    title: string;
    status: string;
  }>;
  const priorities = payload.priorities as Array<{
    competencyId: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  const recommendations = payload.allowedRecommendations as Array<{
    recommendationId: string;
    title: string;
  }>;
  const unmeasured = payload.unmeasuredCompetencyIds as string[];
  return {
    schemaVersion: 'bilan-report-parent-draft-v1',
    audience: 'PARENT',
    title: 'Bilan parent synthétique',
    summary: 'Cette synthèse décrit uniquement les faits synthétiques autorisés.',
    strengths: competencies
      .filter(({ status }) => status === 'MASTERED')
      .map(({ competencyId, title }) => ({
        competencyId,
        title,
        explanation: 'Cette compétence est maîtrisée dans le jeu de données synthétique.',
      })),
    priorities: priorities.map(({ competencyId, priority }) => ({
      competencyId,
      title: 'Priorité synthétique',
      explanation: 'Cette priorité reprend le contexte synthétique autorisé.',
      priority,
    })),
    actionPlan: recommendations.map(({ recommendationId, title }) => ({
      recommendationId,
      title,
      rationale: 'Cette action appartient au catalogue synthétique autorisé.',
      actions: ['Réaliser une activité synthétique courte chaque semaine.'],
      cadence: 'Une fois par semaine',
      durationWeeks: 3,
    })),
    unmeasuredAreas: unmeasured.map((competencyId) => ({
      competencyId,
      title: competencies.find((item) => item.competencyId === competencyId)?.title
        ?? 'Compétence non mesurée',
    })),
    cautionNotes: ['Les conclusions restent limitées aux éléments synthétiques mesurés.'],
    closingMessage: AI_ASSISTANCE_DISCLOSURE,
  };
}

describe('durable benchmark command', () => {
  it('persists the run and Luna preflight before completing the 36-call matrix', async () => {
    const apiKey = 'synthetic-benchmark-command-key';
    const home = privateHome(apiKey);
    const evidenceRoot = join(
      home,
      '.local/share/nexus-release-evidence/bilan-openrouter-model-benchmark',
    );
    let postCount = 0;
    let manifestExistedBeforeNetwork = false;
    let preflightExistedBeforeBenchmark = false;
    const server = createServer(async (request, response) => {
      if (request.method === 'GET' && request.url === '/api/v1/models') {
        const runDirectories = existsSync(evidenceRoot)
          ? readdirSync(evidenceRoot)
          : [];
        manifestExistedBeforeNetwork = runDirectories.length === 1
          && existsSync(join(evidenceRoot, runDirectories[0], 'run-manifest.json'));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(catalog()));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
        model: string;
        messages: Array<{ role: string; content: string }>;
      };
      postCount += 1;
      const runDirectory = join(evidenceRoot, readdirSync(evidenceRoot)[0]);
      if (postCount === 2) {
        preflightExistedBeforeBenchmark = readFileSync(
          join(runDirectory, 'events.ndjson'),
          'utf8',
        ).includes('PREFLIGHT_SUCCEEDED');
      }
      const data = postCount === 1
        ? {
          schemaVersion: 'openrouter-contract-test-v1',
          status: 'ok',
          echo: 'synthetic-no-pii',
        }
        : draftFromPayload(JSON.parse(body.messages.at(-1)!.content));
      response.writeHead(200, {
        'content-type': 'application/json',
        'x-generation-id': `gen-command-${postCount}`,
      });
      response.end(JSON.stringify({
        model: body.model,
        provider: 'synthetic-zdr-provider',
        choices: [{
          message: { role: 'assistant', content: JSON.stringify(data) },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 80,
          completion_tokens_details: { reasoning_tokens: 10 },
          total_tokens: 180,
          cost: '0.000001',
        },
      }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Fake OpenRouter server did not bind.');
    }

    try {
      const { stdout, stderr } = await execFileAsync(
        resolve('node_modules/.bin/tsx'),
        ['--conditions=react-server', 'scripts/bilans/openrouter-model-benchmark.ts'],
        {
          cwd: process.cwd(),
          env: {
            PATH: process.env.PATH,
            HOME: home,
            NODE_ENV: 'test',
            BILAN_REPORT_GENERATION_MODE: 'OPENROUTER_REQUIRED',
            OPENROUTER_BASE_URL: `http://127.0.0.1:${address.port}/api/v1`,
            BILAN_OPENROUTER_PRIMARY_MODEL: 'anthropic/claude-sonnet-5',
            BILAN_OPENROUTER_FALLBACK_MODELS: '["openai/gpt-5.6-terra"]',
            BILAN_OPENROUTER_MODEL_POLICY_VERSION: 'bilan-model-policy-v1.1',
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
      expect(manifestExistedBeforeNetwork).toBe(true);
      expect(preflightExistedBeforeBenchmark).toBe(true);
      expect(postCount).toBe(37);
      expect(stdout).toContain('BENCHMARK_STATUS=COMPLETE');
      expect(stdout).toContain('TERMINAL_COMBINATION_COUNT=36');
      expect(stdout).toContain('VALID_REPORT_COUNT=36');
      expect(stdout).toContain('NETWORK_CALL_COUNT=37');
      expect(stdout).toContain('HUMAN_REVIEW_STATUS=PENDING');

      const [runId] = readdirSync(evidenceRoot);
      const directory = join(evidenceRoot, runId);
      expect(statSync(directory).mode & 0o777).toBe(0o700);
      const reviewerPackage = readFileSync(
        join(directory, 'reviewer-package/review-packet.json'),
        'utf8',
      );
      expect(reviewerPackage).not.toMatch(
        /luna|terra|sonnet|openai|anthropic|provider|generation|cost|latency/i,
      );
      expect(existsSync(join(
        directory,
        'owner-sealed-model-key/model-key.json',
      ))).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
      rmSync(home, { recursive: true, force: true });
    }
  }, 30_000);
});
