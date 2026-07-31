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

  it('stops immediately on a grounding or PII failure', async () => {
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
    })).rejects.toThrow('BENCHMARK_CRITICAL_VALIDATION_FAILURE');
    expect(calls).toBe(1);
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
});
