/** @jest-environment node */

import fixtures from '@/content/bilans/benchmarks/synthetic-v1/synthetic-simple-01.json';
import {
  AI_ASSISTANCE_DISCLOSURE,
  buildParentLlmPayload,
  type ParentReportDraft,
} from '@/lib/bilans/benchmark/report-contracts';
import {
  runSyntheticParentBenchmark,
} from '@/lib/bilans/benchmark/runner';
import {
  buildLocalFirstReportContext,
} from '@/lib/bilans/local-first/contracts';

function draftForFixture(): ParentReportDraft {
  return {
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
    }],
    priorities: [{
      competencyId: 'cmp:calcul',
      title: 'Entretenir les automatismes',
      explanation:
        'Une pratique courte aidera à conserver la régularité observée.',
      priority: 'LOW',
    }],
    actionPlan: [{
      recommendationId: 'rec:s01',
      title: 'Conserver un entraînement régulier',
      rationale: 'Les acquis sont solides sur la preuve disponible.',
      actions: ['Réaliser deux séries courtes chaque semaine.'],
      cadence: 'Deux fois par semaine',
      durationWeeks: 3,
    }],
    unmeasuredAreas: [],
    cautionNotes: [
      'Les conclusions restent limitées aux compétences mesurées.',
    ],
    closingMessage: AI_ASSISTANCE_DISCLOSURE,
  };
}

describe('synthetic benchmark runner', () => {
  it('runs one no-retry call per model and produces strict metrics', async () => {
    const context = buildLocalFirstReportContext(fixtures, 'PARENT');
    expect(buildParentLlmPayload(context)).not.toHaveProperty('score');
    const models = [
      'openai/gpt-5.6-luna',
      'openai/gpt-5.6-terra',
      'anthropic/claude-sonnet-5',
    ] as const;
    const seen: string[] = [];
    const run = await runSyntheticParentBenchmark({
      contexts: [context],
      models,
      hardStopMicrosUsd: 1_500_000,
      warningMicrosUsd: 1_000_000,
      complete: async ({ model }) => {
        seen.push(model);
        return {
          data: draftForFixture(),
          provenance: {
            requestedModel: model,
            returnedModel: model,
            provider: 'fake-zdr-provider',
            generationId: `gen-${model}`,
            finishReason: 'stop',
            promptTokens: 100,
            completionTokens: 60,
            reasoningTokens: 10,
            totalTokens: 160,
            costMicrosUsd: 500,
            latencyMs: 100,
          },
        };
      },
    });

    expect(seen).toHaveLength(3);
    expect(new Set(seen)).toEqual(new Set(models));
    expect(run.totalCostMicrosUsd).toBe(1_500);
    expect(run.results).toHaveLength(3);
    expect(run.results.every(({ automaticValidation }) =>
      Object.values(automaticValidation).every(Boolean))).toBe(true);
  });

  it('stops immediately on a deterministic PII security failure', async () => {
    const context = buildLocalFirstReportContext(fixtures, 'PARENT');
    let calls = 0;
    await expect(runSyntheticParentBenchmark({
      contexts: [context],
      models: [
        'openai/gpt-5.6-luna',
        'openai/gpt-5.6-terra',
      ],
      hardStopMicrosUsd: 1_500_000,
      warningMicrosUsd: 1_000_000,
      complete: async ({ model }) => {
        calls += 1;
        return {
          data: {
            ...draftForFixture(),
            summary: 'Contact : personne.synthetique@example.invalid',
          },
          provenance: {
            requestedModel: model,
            returnedModel: model,
            provider: 'fake',
            generationId: 'fake',
            finishReason: 'stop',
            promptTokens: 1,
            completionTokens: 1,
            reasoningTokens: 0,
            totalTokens: 2,
            costMicrosUsd: 1,
            latencyMs: 1,
          },
        };
      },
    })).rejects.toThrow('BENCHMARK_SECURITY_CRITICAL');
    expect(calls).toBe(1);
  });

  it('records a grounding defect as a quality result and continues', async () => {
    const context = buildLocalFirstReportContext(fixtures, 'PARENT');
    const models = ['openai/gpt-5.6-luna', 'openai/gpt-5.6-terra'] as const;
    let calls = 0;
    const run = await runSyntheticParentBenchmark({
      contexts: [context],
      models,
      hardStopMicrosUsd: 1_500_000,
      warningMicrosUsd: 1_000_000,
      complete: async ({ model }) => {
        calls += 1;
        return {
          data: calls === 1
            ? {
              ...draftForFixture(),
              strengths: [{
                ...draftForFixture().strengths[0],
                competencyId: 'cmp:unknown',
              }],
            }
            : draftForFixture(),
          provenance: {
            requestedModel: model,
            returnedModel: model,
            provider: 'fake',
            generationId: `gen-${calls}`,
            finishReason: 'stop',
            promptTokens: 1,
            completionTokens: 1,
            reasoningTokens: 0,
            totalTokens: 2,
            costMicrosUsd: 5,
            latencyMs: 1,
          },
        };
      },
    });

    expect(calls).toBe(2);
    expect(run.results).toHaveLength(1);
    expect(run.failures).toEqual([expect.objectContaining({
      category: 'QUALITY_FAILURE',
      terminalStatus: 'QUALITY_FAILURE',
      validationStage: 'GROUNDING',
      knownCostMicrosUsd: 5,
    })]);
    expect(run.totalCostMicrosUsd).toBe(10);
  });

  it('treats cross-audience fields as a security-critical failure', async () => {
    const context = buildLocalFirstReportContext(fixtures, 'PARENT');
    await expect(runSyntheticParentBenchmark({
      contexts: [context],
      models: ['openai/gpt-5.6-luna'],
      hardStopMicrosUsd: 1_500_000,
      warningMicrosUsd: 1_000_000,
      complete: async ({ model }) => ({
        data: {
          ...draftForFixture(),
          audience: 'STUDENT',
          internalNotes: 'should-never-be-here',
        } as unknown as ParentReportDraft,
        provenance: {
          requestedModel: model,
          returnedModel: model,
          provider: 'fake',
          generationId: 'gen-security',
          finishReason: 'stop',
          promptTokens: 1,
          completionTokens: 1,
          reasoningTokens: 0,
          totalTokens: 2,
          costMicrosUsd: 5,
          latencyMs: 1,
        },
      }),
    })).rejects.toThrow('BENCHMARK_SECURITY_CRITICAL');
  });

  it('enforces the actual-cost hard stop', async () => {
    const context = buildLocalFirstReportContext(fixtures, 'PARENT');
    await expect(runSyntheticParentBenchmark({
      contexts: [context],
      models: ['openai/gpt-5.6-luna'],
      hardStopMicrosUsd: 1,
      warningMicrosUsd: 1,
      complete: async ({ model }) => ({
        data: draftForFixture(),
        provenance: {
          requestedModel: model,
          returnedModel: model,
          provider: 'fake',
          generationId: 'fake',
          finishReason: 'stop',
          promptTokens: 1,
          completionTokens: 1,
          reasoningTokens: 0,
          totalTokens: 2,
          costMicrosUsd: 2,
          latencyMs: 1,
        },
      }),
    })).rejects.toThrow('BENCHMARK_HARD_STOP_REACHED');
  });

  it('records an isolated provider failure and never retries the pair', async () => {
    const context = buildLocalFirstReportContext(fixtures, 'PARENT');
    const calls: string[] = [];
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
        calls.push(model);
        if (model === 'openai/gpt-5.6-terra') {
          throw Object.assign(new Error('redacted'), {
            code: 'OPENROUTER_PROVIDER_UNAVAILABLE',
          });
        }
        return {
          data: draftForFixture(),
          provenance: {
            requestedModel: model,
            returnedModel: model,
            provider: 'fake',
            generationId: `fake-${model}`,
            finishReason: 'stop',
            promptTokens: 1,
            completionTokens: 1,
            reasoningTokens: 0,
            totalTokens: 2,
            costMicrosUsd: 1,
            latencyMs: 1,
          },
        };
      },
    });
    expect(calls).toHaveLength(3);
    expect(new Set(calls).size).toBe(3);
    expect(run.callCount).toBe(3);
    expect(run.results).toHaveLength(2);
    expect(run.failures).toEqual([{
      fixtureId: 'synthetic-simple-01',
      model: 'openai/gpt-5.6-terra',
      category: 'TRANSPORT_FAILURE',
      terminalStatus: 'TRANSPORT_FAILURE_FINAL',
      validationStage: 'TRANSPORT',
      normalizedErrorCode: 'OPENROUTER_PROVIDER_UNAVAILABLE',
      retryable: false,
      responseReceived: false,
      knownCostMicrosUsd: null,
      safeAttempt: null,
    }]);
  });
});
