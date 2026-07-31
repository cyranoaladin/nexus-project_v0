import 'server-only';

import {
  assembleGroundedParentReport,
  buildParentLlmPayload,
  validateParentReportDraft,
  type ParentLlmPayload,
  type ParentReport,
  type ParentReportDraft,
} from './report-contracts';
import { scanPiiFields } from '../local-first/pii';
import type { LocalFirstReportContext } from '../local-first/contracts';
import { sha256Canonical } from '@/lib/llm/openrouter/hash';

type SafeCompletionProvenance = Readonly<{
  requestedModel: string;
  returnedModel: string;
  provider: string | null;
  generationId: string;
  finishReason: string;
  promptTokens: number;
  cachedPromptTokens?: number | null;
  completionTokens: number;
  reasoningTokens: number | null;
  totalTokens: number;
  costMicrosUsd: number;
  latencyMs: number;
}>;

export type BenchmarkCompletion = Readonly<{
  data: ParentReportDraft;
  provenance: SafeCompletionProvenance;
}>;

export type AutomaticReportValidation = Readonly<{
  schemaValid: true;
  scoreEchoValid: true;
  evidenceRefsValid: true;
  competencyIdsValid: true;
  recommendationsAllowlisted: true;
  noForbiddenClaims: true;
  noCrossAudienceData: true;
  noPii: true;
  noHtml: true;
  noMarkdown: true;
  finishReasonStop: true;
}>;

export type SyntheticBenchmarkResult = Readonly<{
  fixtureId: string;
  model: string;
  report: ParentReport;
  provenance: SafeCompletionProvenance;
  automaticValidation: AutomaticReportValidation;
}>;

export type SyntheticBenchmarkRun = Readonly<{
  schemaVersion: 'bilan-synthetic-benchmark-run-v1';
  callCount: number;
  totalCostMicrosUsd: number;
  warningReached: boolean;
  results: readonly SyntheticBenchmarkResult[];
  failures: readonly SyntheticBenchmarkFailure[];
}>;

export type SyntheticBenchmarkFailure = Readonly<{
  fixtureId: string;
  model: string;
  normalizedErrorCode: string;
}>;

export class BenchmarkCriticalValidationError extends Error {
  readonly safeContext: Readonly<{
    fixtureId: string;
    model: string;
    validationCode: string;
    provenance: SafeCompletionProvenance;
  }>;

  constructor(
    safeContext: BenchmarkCriticalValidationError['safeContext'],
    options: ErrorOptions = {},
  ) {
    super(`BENCHMARK_CRITICAL_VALIDATION_FAILURE:${safeContext.validationCode}`, options);
    this.name = 'BenchmarkCriticalValidationError';
    this.safeContext = Object.freeze({ ...safeContext });
  }
}

function orderedModels(
  fixtureId: string,
  models: readonly string[],
): readonly string[] {
  const seed = Number.parseInt(sha256Canonical(fixtureId).slice(0, 8), 16);
  const offset = seed % models.length;
  return [...models.slice(offset), ...models.slice(0, offset)];
}

function narrativeFields(report: ParentReport): Array<{
  path: string;
  text: string;
  source: 'CONTROLLED_TEMPLATE';
}> {
  const fields: Array<{
    path: string;
    text: string;
    source: 'CONTROLLED_TEMPLATE';
  }> = [
    { path: '$.title', text: report.title, source: 'CONTROLLED_TEMPLATE' },
    { path: '$.summary', text: report.summary, source: 'CONTROLLED_TEMPLATE' },
    {
      path: '$.closingMessage',
      text: report.closingMessage,
      source: 'CONTROLLED_TEMPLATE',
    },
  ];
  report.strengths.forEach((item, index) => {
    fields.push({
      path: `$.strengths[${index}].title`,
      text: item.title,
      source: 'CONTROLLED_TEMPLATE',
    }, {
      path: `$.strengths[${index}].explanation`,
      text: item.explanation,
      source: 'CONTROLLED_TEMPLATE',
    });
  });
  report.priorities.forEach((item, index) => {
    fields.push({
      path: `$.priorities[${index}].title`,
      text: item.title,
      source: 'CONTROLLED_TEMPLATE',
    }, {
      path: `$.priorities[${index}].explanation`,
      text: item.explanation,
      source: 'CONTROLLED_TEMPLATE',
    });
  });
  report.actionPlan.forEach((item, index) => {
    fields.push({
      path: `$.actionPlan[${index}].title`,
      text: item.title,
      source: 'CONTROLLED_TEMPLATE',
    }, {
      path: `$.actionPlan[${index}].rationale`,
      text: item.rationale,
      source: 'CONTROLLED_TEMPLATE',
    }, {
      path: `$.actionPlan[${index}].cadence`,
      text: item.cadence,
      source: 'CONTROLLED_TEMPLATE',
    });
    item.actions.forEach((text, actionIndex) => fields.push({
      path: `$.actionPlan[${index}].actions[${actionIndex}]`,
      text,
      source: 'CONTROLLED_TEMPLATE',
    }));
  });
  report.unmeasuredAreas.forEach((item, index) => fields.push({
    path: `$.unmeasuredAreas[${index}].title`,
    text: item.title,
    source: 'CONTROLLED_TEMPLATE',
  }));
  report.cautionNotes.forEach((text, index) => fields.push({
    path: `$.cautionNotes[${index}]`,
    text,
    source: 'CONTROLLED_TEMPLATE',
  }));
  return fields;
}

function assertNoPii(report: ParentReport): void {
  const scan = scanPiiFields(narrativeFields(report));
  if (scan.result.status !== 'CLEAN') {
    throw new Error('OUTPUT_PII_DETECTED');
  }
}

export async function runSyntheticParentBenchmark(
  options: Readonly<{
    contexts: readonly LocalFirstReportContext[];
    models: readonly string[];
    hardStopMicrosUsd: number;
    warningMicrosUsd: number;
    complete: (input: Readonly<{
      model: string;
      fixtureId: string;
      payload: ParentLlmPayload;
    }>) => Promise<BenchmarkCompletion>;
    onResult?: (
      result: SyntheticBenchmarkResult,
      attemptNumber: number,
    ) => void | Promise<void>;
    onFailure?: (
      failure: SyntheticBenchmarkFailure,
      attemptNumber: number,
    ) => void | Promise<void>;
  }>,
): Promise<SyntheticBenchmarkRun> {
  if (
    options.contexts.length === 0
    || options.models.length === 0
    || options.hardStopMicrosUsd <= 0
    || options.warningMicrosUsd <= 0
    || options.warningMicrosUsd > options.hardStopMicrosUsd
  ) {
    throw new Error('BENCHMARK_CONFIGURATION_INVALID');
  }
  const results: SyntheticBenchmarkResult[] = [];
  const failures: SyntheticBenchmarkFailure[] = [];
  const consecutiveFailures = new Map<string, number>();
  let totalCostMicrosUsd = 0;
  for (const context of options.contexts) {
    const payload = buildParentLlmPayload(context);
    for (const model of orderedModels(context.fixtureId, options.models)) {
      let completion: BenchmarkCompletion;
      try {
        completion = await options.complete({
          model,
          fixtureId: context.fixtureId,
          payload,
        });
      } catch (caught) {
        const candidateCode = caught !== null
          && typeof caught === 'object'
          && 'code' in caught
          && typeof caught.code === 'string'
          ? caught.code
          : 'BENCHMARK_TRANSPORT_FAILURE';
        const normalizedErrorCode = /^[A-Z][A-Z0-9_]{2,79}$/.test(
          candidateCode,
        )
          ? candidateCode
          : 'BENCHMARK_TRANSPORT_FAILURE';
        const failure = Object.freeze({
          fixtureId: context.fixtureId,
          model,
          normalizedErrorCode,
        });
        failures.push(failure);
        const attemptNumber = results.length + failures.length;
        await options.onFailure?.(failure, attemptNumber);
        const count = (consecutiveFailures.get(model) ?? 0) + 1;
        consecutiveFailures.set(model, count);
        if (count >= 3) {
          throw new Error('BENCHMARK_THREE_CONSECUTIVE_MODEL_FAILURES');
        }
        continue;
      }
      consecutiveFailures.set(model, 0);
      totalCostMicrosUsd += completion.provenance.costMicrosUsd;
      if (totalCostMicrosUsd >= options.hardStopMicrosUsd) {
        throw new Error('BENCHMARK_HARD_STOP_REACHED');
      }
      let report: ParentReport;
      try {
        report = assembleGroundedParentReport(
          context,
          validateParentReportDraft(completion.data),
        );
        assertNoPii(report);
      } catch (caught) {
        const validationCode = caught instanceof Error
          ? caught.message.startsWith('REPORT_GROUNDING_FAILURE: ')
            ? caught.message.slice('REPORT_GROUNDING_FAILURE: '.length)
            : caught.message === 'OUTPUT_PII_DETECTED'
              ? caught.message
              : 'LOCAL_SCHEMA_VALIDATION'
          : 'LOCAL_SCHEMA_VALIDATION';
        throw new BenchmarkCriticalValidationError({
          fixtureId: context.fixtureId,
          model,
          validationCode,
          provenance: completion.provenance,
        }, { cause: caught });
      }
      if (completion.provenance.finishReason !== 'stop') {
        throw new Error(
          'BENCHMARK_CRITICAL_VALIDATION_FAILURE: incomplete output',
        );
      }
      const result = Object.freeze({
        fixtureId: context.fixtureId,
        model,
        report,
        provenance: completion.provenance,
        automaticValidation: Object.freeze({
          schemaValid: true,
          scoreEchoValid: true,
          evidenceRefsValid: true,
          competencyIdsValid: true,
          recommendationsAllowlisted: true,
          noForbiddenClaims: true,
          noCrossAudienceData: true,
          noPii: true,
          noHtml: true,
          noMarkdown: true,
          finishReasonStop: true,
        }),
      });
      results.push(result);
      await options.onResult?.(result, results.length + failures.length);
    }
  }
  return Object.freeze({
    schemaVersion: 'bilan-synthetic-benchmark-run-v1',
    callCount: results.length + failures.length,
    totalCostMicrosUsd,
    warningReached: totalCostMicrosUsd >= options.warningMicrosUsd,
    results: Object.freeze(results),
    failures: Object.freeze(failures),
  });
}
