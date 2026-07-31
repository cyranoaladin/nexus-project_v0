import 'server-only';

import type { LocalFirstReportContext } from '../local-first/contracts';
import type { BenchmarkBudgetLedger } from './budget-ledger';
import {
  BenchmarkCriticalValidationError,
  runSyntheticParentBenchmark,
  type BenchmarkCompletion,
  type SyntheticBenchmarkFailure,
  type SyntheticBenchmarkResult,
} from './runner';
import {
  appendBenchmarkEvent,
  canStartDeferredTransportRetry,
  projectBenchmarkAttempts,
  readBenchmarkJournal,
  shouldAutomaticallyStartAttempt,
  type BenchmarkJournalHandle,
} from './journal';
import type { BenchmarkScheduleEntry } from './schedule';

function safeAttemptFromError(caught: unknown) {
  if (
    caught === null
    || typeof caught !== 'object'
    || !('attempts' in caught)
    || !Array.isArray(caught.attempts)
  ) return null;
  const candidate = caught.attempts.at(-1);
  return candidate !== null && typeof candidate === 'object'
    ? candidate as Record<string, unknown>
    : null;
}

function knownCostFromError(caught: unknown): number | null {
  const attempt = safeAttemptFromError(caught);
  return typeof attempt?.costMicrosUsd === 'number'
    && Number.isSafeInteger(attempt.costMicrosUsd)
    && attempt.costMicrosUsd >= 0
    ? attempt.costMicrosUsd
    : null;
}

function hasResponseFromError(caught: unknown): boolean {
  const attempt = safeAttemptFromError(caught);
  return typeof attempt?.generationId === 'string';
}

function terminalOutcomes(
  journal: BenchmarkJournalHandle,
): ReadonlyMap<string, SyntheticBenchmarkResult | SyntheticBenchmarkFailure> {
  const outcomes = new Map<
    string,
    SyntheticBenchmarkResult | SyntheticBenchmarkFailure
  >();
  for (const event of readBenchmarkJournal(journal)) {
    const attemptKey = typeof event.payload.attemptKey === 'string'
      ? event.payload.attemptKey
      : null;
    if (attemptKey === null) continue;
    if (event.type === 'ATTEMPT_VALIDATED' && event.payload.result) {
      outcomes.set(attemptKey, event.payload.result as SyntheticBenchmarkResult);
    }
    if (
      [
        'ATTEMPT_TRANSPORT_FAILED',
        'ATTEMPT_SCHEMA_FAILED',
        'ATTEMPT_GROUNDING_FAILED',
      ].includes(event.type)
      && event.payload.failure
    ) {
      outcomes.set(attemptKey, event.payload.failure as SyntheticBenchmarkFailure);
    }
  }
  return outcomes;
}

export async function runResumableBenchmarkCampaign(
  options: Readonly<{
    journal: BenchmarkJournalHandle;
    ledger: BenchmarkBudgetLedger;
    schedule: readonly BenchmarkScheduleEntry[];
    contexts: readonly LocalFirstReportContext[];
    reserveMicrosUsd: (input: Readonly<{
      entry: BenchmarkScheduleEntry;
      networkAttemptNumber: number;
    }>) => bigint;
    complete: (input: Readonly<{
      model: string;
      fixtureId: string;
      payload: Parameters<
        Parameters<typeof runSyntheticParentBenchmark>[0]['complete']
      >[0]['payload'];
    }>) => Promise<BenchmarkCompletion>;
  }>,
) {
  const contextByFixture = new Map(
    options.contexts.map((context) => [context.fixtureId, context]),
  );
  const projection = projectBenchmarkAttempts(readBenchmarkJournal(options.journal));
  const outcomes = new Map(terminalOutcomes(options.journal));
  const deferred: BenchmarkScheduleEntry[] = [];
  let unknownOutcomeCount = 0;
  const resumeDuplicateCallCount = 0;

  const execute = async (
    entry: BenchmarkScheduleEntry,
    networkAttemptNumber: number,
  ): Promise<void> => {
    const context = contextByFixture.get(entry.fixtureId);
    if (context === undefined) throw new Error('BENCHMARK_CONTEXT_MISSING');
    const reservationKey = `${entry.attemptKey}:network:${networkAttemptNumber}`;
    const reservedMicrosUsd = options.reserveMicrosUsd({
      entry,
      networkAttemptNumber,
    });
    options.ledger.reserve({ reservationKey, amountMicrosUsd: reservedMicrosUsd });
    appendBenchmarkEvent(options.journal, {
      type: 'BUDGET_RESERVED',
      payload: {
        attemptKey: entry.attemptKey,
        reservationKey,
        amountMicrosUsd: reservedMicrosUsd.toString(),
      },
    });
    appendBenchmarkEvent(options.journal, {
      type: 'ATTEMPT_STARTED',
      payload: {
        attemptKey: entry.attemptKey,
        fixtureId: entry.fixtureId,
        modelId: entry.modelId,
        networkAttemptNumber,
      },
    });

    let reconciled = false;
    try {
      const run = await runSyntheticParentBenchmark({
        contexts: [context],
        models: [entry.modelId],
        hardStopMicrosUsd: 1_000_000,
        warningMicrosUsd: 700_000,
        complete: async (input) => {
          try {
            const completion = await options.complete(input);
            appendBenchmarkEvent(options.journal, {
              type: 'ATTEMPT_RESPONSE_RECEIVED',
              payload: {
                attemptKey: entry.attemptKey,
                networkAttemptNumber,
                generationId: completion.provenance.generationId,
                provider: completion.provenance.provider,
                returnedModel: completion.provenance.returnedModel,
                finishReason: completion.provenance.finishReason,
                costMicrosUsd: completion.provenance.costMicrosUsd,
              },
            });
            options.ledger.reconcile({
              reservationKey,
              knownCostMicrosUsd: completion.provenance.costMicrosUsd,
            });
            reconciled = true;
            appendBenchmarkEvent(options.journal, {
              type: 'BUDGET_RECONCILED',
              payload: {
                attemptKey: entry.attemptKey,
                reservationKey,
                knownCostMicrosUsd: completion.provenance.costMicrosUsd,
              },
            });
            return completion;
          } catch (caught) {
            const knownCostMicrosUsd = knownCostFromError(caught);
            if (hasResponseFromError(caught)) {
              const attempt = safeAttemptFromError(caught);
              appendBenchmarkEvent(options.journal, {
                type: 'ATTEMPT_RESPONSE_RECEIVED',
                payload: {
                  attemptKey: entry.attemptKey,
                  networkAttemptNumber,
                  generationId: attempt?.generationId ?? null,
                  provider: attempt?.provider ?? null,
                  returnedModel: attempt?.returnedModel ?? null,
                  finishReason: attempt?.finishReason ?? null,
                  costMicrosUsd: knownCostMicrosUsd,
                },
              });
            }
            options.ledger.reconcile({ reservationKey, knownCostMicrosUsd });
            reconciled = true;
            appendBenchmarkEvent(options.journal, {
              type: 'BUDGET_RECONCILED',
              payload: {
                attemptKey: entry.attemptKey,
                reservationKey,
                knownCostMicrosUsd,
              },
            });
            throw caught;
          }
        },
      });
      if (run.results[0]) {
        const result = run.results[0];
        outcomes.set(entry.attemptKey, result);
        appendBenchmarkEvent(options.journal, {
          type: 'ATTEMPT_VALIDATED',
          payload: {
            attemptKey: entry.attemptKey,
            networkAttemptNumber,
            result,
          },
        });
        return;
      }
      const failure = run.failures[0];
      if (failure === undefined) throw new Error('BENCHMARK_OUTCOME_MISSING');
      outcomes.set(entry.attemptKey, failure);
      appendBenchmarkEvent(options.journal, {
        type: failure.category === 'TRANSPORT_FAILURE'
          ? 'ATTEMPT_TRANSPORT_FAILED'
          : failure.validationStage === 'GROUNDING'
            ? 'ATTEMPT_GROUNDING_FAILED'
            : 'ATTEMPT_SCHEMA_FAILED',
        payload: {
          attemptKey: entry.attemptKey,
          networkAttemptNumber,
          retryable: failure.retryable,
          final: !failure.retryable || networkAttemptNumber >= 2,
          failure,
        },
      });
      if (failure.retryable && networkAttemptNumber < 2) deferred.push(entry);
    } catch (caught) {
      if (!reconciled) {
        options.ledger.reconcile({ reservationKey, knownCostMicrosUsd: null });
        appendBenchmarkEvent(options.journal, {
          type: 'BUDGET_RECONCILED',
          payload: {
            attemptKey: entry.attemptKey,
            reservationKey,
            knownCostMicrosUsd: null,
          },
        });
      }
      if (caught instanceof BenchmarkCriticalValidationError) {
        appendBenchmarkEvent(options.journal, {
          type: 'ATTEMPT_SECURITY_FAILED',
          payload: {
            attemptKey: entry.attemptKey,
            networkAttemptNumber,
            validationCode: caught.safeContext.validationCode,
          },
        });
      }
      throw caught;
    }
  };

  for (const entry of options.schedule) {
    const current = projection.get(entry.attemptKey);
    if (shouldAutomaticallyStartAttempt(current)) {
      await execute(entry, 1);
      continue;
    }
    if (current?.state === 'UNKNOWN_OUTCOME') unknownOutcomeCount += 1;
    if (canStartDeferredTransportRetry(current)) deferred.push(entry);
  }
  for (const entry of deferred) await execute(entry, 2);

  const orderedOutcomes = options.schedule
    .map(({ attemptKey }) => outcomes.get(attemptKey))
    .filter((outcome): outcome is SyntheticBenchmarkResult | SyntheticBenchmarkFailure =>
      outcome !== undefined);
  return Object.freeze({
    results: Object.freeze(orderedOutcomes.filter(
      (outcome): outcome is SyntheticBenchmarkResult => 'report' in outcome,
    )),
    failures: Object.freeze(orderedOutcomes.filter(
      (outcome): outcome is SyntheticBenchmarkFailure => 'category' in outcome,
    )),
    unknownOutcomeCount,
    resumeDuplicateCallCount,
    terminalCombinationCount: orderedOutcomes.length,
    budget: options.ledger.summary(),
  });
}
