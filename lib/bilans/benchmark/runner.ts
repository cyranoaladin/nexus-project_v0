import 'server-only';

import {
  assembleGroundedParentReport,
  buildParentLlmPayload,
  validateParentReportDraft,
  type ParentLlmPayload,
  type ParentReport,
  type ParentReportDraft,
} from './report-contracts';
import {
  scanPiiFields,
  type PiiScanResult,
} from '../local-first/pii';
import type { LocalFirstReportContext } from '../local-first/contracts';
import { sha256Canonical } from '@/lib/llm/openrouter/hash';

export type SafeCompletionProvenance = Readonly<{
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

export type SafeFailureAttempt = Readonly<{
  provider: string | null;
  generationId: string | null;
  returnedModel: string | null;
  finishReason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  costMicrosUsd: number | null;
  latencyMs: number | null;
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
  outputPiiDeterministicScan: PiiScanResult;
  outputPrivacyHumanReview: 'PENDING';
}>;

export type SyntheticBenchmarkFailure = Readonly<{
  fixtureId: string;
  model: string;
  category: 'SECURITY_CRITICAL' | 'QUALITY_FAILURE' | 'TRANSPORT_FAILURE';
  terminalStatus:
    | 'SECURITY_FAILURE'
    | 'QUALITY_FAILURE'
    | 'TRANSPORT_FAILURE_FINAL';
  validationStage: 'TRANSPORT' | 'SCHEMA' | 'GROUNDING' | 'SECURITY';
  normalizedErrorCode: string;
  retryable: boolean;
  responseReceived: boolean;
  knownCostMicrosUsd: number | null;
  safeAttempt: SafeFailureAttempt | null;
}>;

export type SyntheticBenchmarkRun = Readonly<{
  schemaVersion: 'bilan-synthetic-benchmark-run-v1';
  callCount: number;
  totalCostMicrosUsd: number;
  warningReached: boolean;
  results: readonly SyntheticBenchmarkResult[];
  failures: readonly SyntheticBenchmarkFailure[];
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
    super(`BENCHMARK_SECURITY_CRITICAL:${safeContext.validationCode}`, options);
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

function narrativeFields(report: ParentReport) {
  const fields: Array<{
    path: string;
    text: string;
    source: 'LLM_GENERATED_TEXT';
  }> = [
    { path: '$.title', text: report.title, source: 'LLM_GENERATED_TEXT' },
    { path: '$.summary', text: report.summary, source: 'LLM_GENERATED_TEXT' },
    {
      path: '$.closingMessage',
      text: report.closingMessage,
      source: 'LLM_GENERATED_TEXT',
    },
  ];
  report.strengths.forEach((item, index) => fields.push(
    { path: `$.strengths[${index}].title`, text: item.title, source: 'LLM_GENERATED_TEXT' },
    { path: `$.strengths[${index}].explanation`, text: item.explanation, source: 'LLM_GENERATED_TEXT' },
  ));
  report.priorities.forEach((item, index) => fields.push(
    { path: `$.priorities[${index}].title`, text: item.title, source: 'LLM_GENERATED_TEXT' },
    { path: `$.priorities[${index}].explanation`, text: item.explanation, source: 'LLM_GENERATED_TEXT' },
  ));
  report.actionPlan.forEach((item, index) => {
    fields.push(
      { path: `$.actionPlan[${index}].title`, text: item.title, source: 'LLM_GENERATED_TEXT' },
      { path: `$.actionPlan[${index}].rationale`, text: item.rationale, source: 'LLM_GENERATED_TEXT' },
      { path: `$.actionPlan[${index}].cadence`, text: item.cadence, source: 'LLM_GENERATED_TEXT' },
    );
    item.actions.forEach((text, actionIndex) => fields.push({
      path: `$.actionPlan[${index}].actions[${actionIndex}]`,
      text,
      source: 'LLM_GENERATED_TEXT',
    }));
  });
  report.unmeasuredAreas.forEach((item, index) => fields.push({
    path: `$.unmeasuredAreas[${index}].title`,
    text: item.title,
    source: 'LLM_GENERATED_TEXT',
  }));
  report.cautionNotes.forEach((text, index) => fields.push({
    path: `$.cautionNotes[${index}]`,
    text,
    source: 'LLM_GENERATED_TEXT',
  }));
  return fields;
}

function assertNoPii(report: ParentReport): PiiScanResult {
  const scan = scanPiiFields(narrativeFields(report));
  if (scan.result.status !== 'CLEAN') throw new Error('OUTPUT_PII_DETECTED');
  return scan.result;
}

function assertNoCrossAudienceOrScore(input: unknown): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return;
  const record = input as Record<string, unknown>;
  if (
    (typeof record.audience === 'string' && record.audience !== 'PARENT')
    || 'internal' in record
    || 'internalNotes' in record
    || 'llmApprovedInternalNotes' in record
    || 'score' in record
    || 'scoreEcho' in record
  ) throw new Error('CROSS_AUDIENCE_OR_SCORE_TAMPERING');
}

function safeAttemptFromCaught(caught: unknown): SafeFailureAttempt | null {
  if (
    caught === null
    || typeof caught !== 'object'
    || !('attempts' in caught)
    || !Array.isArray(caught.attempts)
  ) return null;
  const candidate = caught.attempts.at(-1);
  if (candidate === null || typeof candidate !== 'object') return null;
  const record = candidate as Record<string, unknown>;
  const text = (field: string) => typeof record[field] === 'string'
    ? record[field] as string
    : null;
  const number = (field: string) => typeof record[field] === 'number'
    && Number.isFinite(record[field])
    ? record[field] as number
    : null;
  return Object.freeze({
    provider: text('provider'),
    generationId: text('generationId'),
    returnedModel: text('returnedModel'),
    finishReason: text('finishReason'),
    promptTokens: number('promptTokens'),
    completionTokens: number('completionTokens'),
    reasoningTokens: number('reasoningTokens'),
    totalTokens: number('totalTokens'),
    costMicrosUsd: number('costMicrosUsd'),
    latencyMs: number('latencyMs'),
  });
}

function isReceivedQualityFailure(
  normalizedErrorCode: string,
  safeAttempt: SafeFailureAttempt | null,
): boolean {
  return safeAttempt?.generationId !== null
    && safeAttempt?.generationId !== undefined
    && (
      normalizedErrorCode === 'OPENROUTER_SCHEMA_FAILURE'
      || normalizedErrorCode === 'OPENROUTER_INCOMPLETE_RESPONSE'
    );
}

function qualityFailure(
  fixtureId: string,
  model: string,
  validationStage: 'SCHEMA' | 'GROUNDING',
  normalizedErrorCode: string,
  provenance: SafeCompletionProvenance,
): SyntheticBenchmarkFailure {
  return Object.freeze({
    fixtureId,
    model,
    category: 'QUALITY_FAILURE',
    terminalStatus: 'QUALITY_FAILURE',
    validationStage,
    normalizedErrorCode,
    retryable: false,
    responseReceived: true,
    knownCostMicrosUsd: provenance.costMicrosUsd,
    safeAttempt: Object.freeze({
      provider: provenance.provider,
      generationId: provenance.generationId,
      returnedModel: provenance.returnedModel,
      finishReason: provenance.finishReason,
      promptTokens: provenance.promptTokens,
      completionTokens: provenance.completionTokens,
      reasoningTokens: provenance.reasoningTokens,
      totalTokens: provenance.totalTokens,
      costMicrosUsd: provenance.costMicrosUsd,
      latencyMs: provenance.latencyMs,
    }),
  });
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
    onResult?: (result: SyntheticBenchmarkResult, attemptNumber: number) => void | Promise<void>;
    onFailure?: (failure: SyntheticBenchmarkFailure, attemptNumber: number) => void | Promise<void>;
  }>,
): Promise<SyntheticBenchmarkRun> {
  if (
    options.contexts.length === 0
    || options.models.length === 0
    || options.hardStopMicrosUsd <= 0
    || options.warningMicrosUsd <= 0
    || options.warningMicrosUsd > options.hardStopMicrosUsd
  ) throw new Error('BENCHMARK_CONFIGURATION_INVALID');

  const results: SyntheticBenchmarkResult[] = [];
  const failures: SyntheticBenchmarkFailure[] = [];
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
        const normalizedErrorCode = /^[A-Z][A-Z0-9_]{2,79}$/.test(candidateCode)
          ? candidateCode
          : 'BENCHMARK_TRANSPORT_FAILURE';
        const safeAttempt = safeAttemptFromCaught(caught);
        const receivedQualityFailure = isReceivedQualityFailure(
          normalizedErrorCode,
          safeAttempt,
        );
        const failure = Object.freeze({
          fixtureId: context.fixtureId,
          model,
          category: receivedQualityFailure
            ? 'QUALITY_FAILURE' as const
            : 'TRANSPORT_FAILURE' as const,
          terminalStatus: receivedQualityFailure
            ? 'QUALITY_FAILURE' as const
            : 'TRANSPORT_FAILURE_FINAL' as const,
          validationStage: receivedQualityFailure
            ? 'SCHEMA' as const
            : 'TRANSPORT' as const,
          normalizedErrorCode,
          retryable: !receivedQualityFailure
            && caught !== null
            && typeof caught === 'object'
            && 'retryable' in caught
            && caught.retryable === true,
          responseReceived: safeAttempt?.generationId !== null
            && safeAttempt?.generationId !== undefined,
          knownCostMicrosUsd: safeAttempt?.costMicrosUsd ?? null,
          safeAttempt,
        });
        failures.push(failure);
        totalCostMicrosUsd += failure.knownCostMicrosUsd ?? 0;
        await options.onFailure?.(failure, results.length + failures.length);
        if (totalCostMicrosUsd >= options.hardStopMicrosUsd) {
          throw new Error('BENCHMARK_HARD_STOP_REACHED');
        }
        continue;
      }
      totalCostMicrosUsd += completion.provenance.costMicrosUsd;
      if (totalCostMicrosUsd >= options.hardStopMicrosUsd) {
        throw new Error('BENCHMARK_HARD_STOP_REACHED');
      }
      try {
        assertNoCrossAudienceOrScore(completion.data);
      } catch (caught) {
        throw new BenchmarkCriticalValidationError({
          fixtureId: context.fixtureId,
          model,
          validationCode: 'CROSS_AUDIENCE_OR_SCORE_TAMPERING',
          provenance: completion.provenance,
        }, { cause: caught });
      }
      let draft: ParentReportDraft;
      try {
        draft = validateParentReportDraft(completion.data);
      } catch {
        const failure = qualityFailure(
          context.fixtureId,
          model,
          'SCHEMA',
          'LOCAL_SCHEMA_VALIDATION',
          completion.provenance,
        );
        failures.push(failure);
        await options.onFailure?.(failure, results.length + failures.length);
        continue;
      }
      let report: ParentReport;
      try {
        report = assembleGroundedParentReport(context, draft);
      } catch (caught) {
        const normalizedErrorCode = caught instanceof Error
          && caught.message.startsWith('REPORT_GROUNDING_FAILURE: ')
          ? caught.message.slice('REPORT_GROUNDING_FAILURE: '.length)
          : 'LOCAL_GROUNDING_VALIDATION';
        const failure = qualityFailure(
          context.fixtureId,
          model,
          'GROUNDING',
          normalizedErrorCode,
          completion.provenance,
        );
        failures.push(failure);
        await options.onFailure?.(failure, results.length + failures.length);
        continue;
      }
      let outputPiiDeterministicScan: PiiScanResult;
      try {
        outputPiiDeterministicScan = assertNoPii(report);
      } catch (caught) {
        throw new BenchmarkCriticalValidationError({
          fixtureId: context.fixtureId,
          model,
          validationCode: 'OUTPUT_PII_DETECTED',
          provenance: completion.provenance,
        }, { cause: caught });
      }
      if (completion.provenance.finishReason !== 'stop') {
        const failure = qualityFailure(
          context.fixtureId,
          model,
          'SCHEMA',
          'INCOMPLETE_RESPONSE',
          completion.provenance,
        );
        failures.push(failure);
        await options.onFailure?.(failure, results.length + failures.length);
        continue;
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
        outputPiiDeterministicScan,
        outputPrivacyHumanReview: 'PENDING' as const,
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
