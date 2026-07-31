/** @jest-environment node */

import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import syntheticFixture from '@/content/bilans/benchmarks/synthetic-v1/synthetic-simple-01.json';
import {
  runResumableBenchmarkCampaign,
} from '@/lib/bilans/benchmark/campaign';
import { BenchmarkBudgetLedger } from '@/lib/bilans/benchmark/budget-ledger';
import {
  AI_ASSISTANCE_DISCLOSURE,
  type ParentReportDraft,
} from '@/lib/bilans/benchmark/report-contracts';
import {
  appendBenchmarkEvent,
  createBenchmarkJournal,
  readBenchmarkJournal,
} from '@/lib/bilans/benchmark/journal';
import { createBenchmarkRunIdentity } from '@/lib/bilans/benchmark/run-identity';
import { buildBalancedBenchmarkSchedule } from '@/lib/bilans/benchmark/schedule';
import { buildLocalFirstReportContext } from '@/lib/bilans/local-first/contracts';

function identity() {
  return createBenchmarkRunIdentity({
    repositorySha: 'a'.repeat(40),
    benchmarkPolicyChecksum: 'b'.repeat(64),
    transportPolicyChecksum: 'c'.repeat(64),
    datasetChecksum: 'd'.repeat(64),
    promptChecksum: 'e'.repeat(64),
    draftSchemaChecksum: 'f'.repeat(64),
    finalSchemaChecksum: '0'.repeat(64),
    randomizationSeed: 'campaign-test-seed-v1',
    createdAt: '2026-07-31T10:00:00.000Z',
  });
}

function draft(): ParentReportDraft {
  return {
    schemaVersion: 'bilan-report-parent-draft-v1',
    audience: 'PARENT',
    title: 'Bilan synthétique de mathématiques',
    summary: 'Les acquis observés sont solides sur la preuve synthétique.',
    strengths: [{
      competencyId: 'cmp:calcul',
      title: 'Calcul numérique',
      explanation: 'Les procédures sont régulièrement appliquées.',
    }],
    priorities: [{
      competencyId: 'cmp:calcul',
      title: 'Entretenir les automatismes',
      explanation: 'Une pratique courte consolidera les acquis.',
      priority: 'LOW',
    }],
    actionPlan: [{
      recommendationId: 'rec:s01',
      title: 'Conserver un entraînement régulier',
      rationale: 'Les acquis restent solides sur la preuve disponible.',
      actions: ['Réaliser deux séries courtes chaque semaine.'],
      cadence: 'Deux fois par semaine',
      durationWeeks: 3,
    }],
    unmeasuredAreas: [],
    cautionNotes: ['Les conclusions restent limitées aux éléments mesurés.'],
    closingMessage: AI_ASSISTANCE_DISCLOSURE,
  };
}

function completion(model: string) {
  return {
    data: draft(),
    provenance: {
      requestedModel: model,
      returnedModel: model,
      provider: 'fake-zdr',
      generationId: `gen-${model}`,
      finishReason: 'stop',
      promptTokens: 100,
      completionTokens: 80,
      reasoningTokens: 0,
      totalTokens: 180,
      costMicrosUsd: 500,
      latencyMs: 100,
    },
  };
}

describe('resumable benchmark campaign', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nexus-benchmark-campaign-'));
    chmodSync(root, 0o700);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function setup() {
    const run = identity();
    const fullSchedule = buildBalancedBenchmarkSchedule({
      runId: run.runId,
      randomizationSeed: run.randomizationSeed,
      fixtureIds: Array.from({ length: 12 }, (_, index) => `fixture-${index}`),
      modelIds: ['luna', 'terra', 'sonnet'],
    });
    const schedule = [{
      ...fullSchedule[0],
      fixtureId: syntheticFixture.fixtureId,
    }];
    const journal = createBenchmarkJournal({
      rootDirectory: root,
      identity: run,
      schedule,
    });
    const ledger = new BenchmarkBudgetLedger({
      warningMicrosUsd: BigInt(700_000),
      hardStopMicrosUsd: BigInt(1_000_000),
      maxNetworkAttempts: 42,
    });
    return { journal, ledger, schedule };
  }

  it('records reserve/start/response/reconcile/validation around one call', async () => {
    const { journal, ledger, schedule } = setup();
    let calls = 0;
    const campaign = await runResumableBenchmarkCampaign({
      journal,
      ledger,
      schedule,
      contexts: [buildLocalFirstReportContext(syntheticFixture, 'PARENT')],
      reserveMicrosUsd: () => BigInt(10_000),
      complete: async ({ model }) => {
        calls += 1;
        return completion(model);
      },
    });

    expect(calls).toBe(1);
    expect(campaign.results).toHaveLength(1);
    expect(readBenchmarkJournal(journal).map(({ type }) => type)).toEqual([
      'BUDGET_RESERVED',
      'ATTEMPT_STARTED',
      'ATTEMPT_RESPONSE_RECEIVED',
      'BUDGET_RECONCILED',
      'ATTEMPT_VALIDATED',
    ]);
  });

  it('does not replay STARTED without a terminal event', async () => {
    const { journal, ledger, schedule } = setup();
    appendBenchmarkEvent(journal, {
      type: 'BUDGET_RESERVED',
      payload: {
        reservationKey: `${schedule[0].attemptKey}:network:1`,
        amountMicrosUsd: '10000',
      },
    });
    ledger.reserve({
      reservationKey: `${schedule[0].attemptKey}:network:1`,
      amountMicrosUsd: BigInt(10_000),
    });
    appendBenchmarkEvent(journal, {
      type: 'ATTEMPT_STARTED',
      payload: { attemptKey: schedule[0].attemptKey, networkAttemptNumber: 1 },
    });
    let calls = 0;
    const campaign = await runResumableBenchmarkCampaign({
      journal,
      ledger,
      schedule,
      contexts: [buildLocalFirstReportContext(syntheticFixture, 'PARENT')],
      reserveMicrosUsd: () => BigInt(10_000),
      complete: async ({ model }) => {
        calls += 1;
        return completion(model);
      },
    });

    expect(calls).toBe(0);
    expect(campaign.unknownOutcomeCount).toBe(1);
    expect(campaign.resumeDuplicateCallCount).toBe(0);
  });

  it('defers at most one retryable transport retry until after the primary pass', async () => {
    const { journal, ledger, schedule } = setup();
    let calls = 0;
    const campaign = await runResumableBenchmarkCampaign({
      journal,
      ledger,
      schedule,
      contexts: [buildLocalFirstReportContext(syntheticFixture, 'PARENT')],
      reserveMicrosUsd: () => BigInt(10_000),
      complete: async ({ model }) => {
        calls += 1;
        if (calls === 1) {
          throw Object.assign(new Error('redacted'), {
            code: 'OPENROUTER_PROVIDER_UNAVAILABLE',
            retryable: true,
            attempts: [],
          });
        }
        return completion(model);
      },
    });

    expect(calls).toBe(2);
    expect(campaign.results).toHaveLength(1);
    expect(campaign.failures).toHaveLength(0);
    expect(readBenchmarkJournal(journal).filter(
      ({ type }) => type === 'ATTEMPT_STARTED',
    )).toHaveLength(2);
  });
});
