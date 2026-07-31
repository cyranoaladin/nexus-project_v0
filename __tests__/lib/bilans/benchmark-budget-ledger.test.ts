/** @jest-environment node */

import {
  BenchmarkBudgetLedger,
  estimateBenchmarkCallReserve,
  extractBenchmarkModelPrices,
} from '@/lib/bilans/benchmark/budget-ledger';

const catalog = {
  data: [{
    id: 'openai/gpt-5.6-luna',
    pricing: {
      prompt: '0.0000004',
      completion: '0.0000012',
      internal_reasoning: '0.0000008',
      request: '0.00001',
    },
  }],
};

describe('benchmark budget ledger', () => {
  it('parses catalogue decimals exactly and reserves conservatively', () => {
    const prices = extractBenchmarkModelPrices(
      catalog,
      ['openai/gpt-5.6-luna'],
    );
    const reserve = estimateBenchmarkCallReserve({
      price: prices.get('openai/gpt-5.6-luna')!,
      maximumInputTokens: 2_500,
      maximumOutputTokens: 2_048,
      safetyMarginBasisPoints: 12_500,
    });

    expect(reserve).toBe(6_383n);
  });

  it.each([
    {},
    { data: [{ id: 'openai/gpt-5.6-luna', pricing: {} }] },
    { data: [{ id: 'openai/gpt-5.6-luna', pricing: {
      prompt: '4e-7', completion: '0.1', request: '0',
    } }] },
    { data: [{ id: 'openai/gpt-5.6-luna', pricing: {
      prompt: '-0.1', completion: '0.1', request: '0',
    } }] },
  ])('blocks missing or invalid price metadata', (candidate) => {
    expect(() => extractBenchmarkModelPrices(
      candidate,
      ['openai/gpt-5.6-luna'],
    )).toThrow('BLOCKED_BY_BENCHMARK_PRICE_METADATA');
  });

  it('reserves before a call and reconciles the provider cost exactly', () => {
    const ledger = new BenchmarkBudgetLedger({
      warningMicrosUsd: 700_000n,
      hardStopMicrosUsd: 1_000_000n,
      maxNetworkAttempts: 42,
    });
    ledger.reserve({ reservationKey: 'attempt-1:network:1', amountMicrosUsd: 50_000n });
    expect(ledger.summary()).toMatchObject({
      attemptedCallCount: 1,
      totalKnownCostMicrosUsd: 0n,
      openReservedCostMicrosUsd: 50_000n,
    });

    ledger.reconcile({
      reservationKey: 'attempt-1:network:1',
      knownCostMicrosUsd: 12_345,
    });
    expect(ledger.summary()).toMatchObject({
      attemptedCallCount: 1,
      totalKnownCostMicrosUsd: 12_345n,
      openReservedCostMicrosUsd: 0n,
      reportedCostUndercountMicrosUsd: 0n,
    });
  });

  it('counts known costs for rejected outputs and transport errors', () => {
    const ledger = new BenchmarkBudgetLedger({
      warningMicrosUsd: 700_000n,
      hardStopMicrosUsd: 1_000_000n,
      maxNetworkAttempts: 42,
    });
    for (const [key, cost] of [['schema-failure', 2_000], ['transport', 300]] as const) {
      ledger.reserve({ reservationKey: key, amountMicrosUsd: 10_000n });
      ledger.reconcile({ reservationKey: key, knownCostMicrosUsd: cost });
    }
    expect(ledger.summary().totalKnownCostMicrosUsd).toBe(2_300n);
  });

  it('keeps an UNKNOWN_OUTCOME reserve and blocks reuse of its key', () => {
    const ledger = new BenchmarkBudgetLedger({
      warningMicrosUsd: 700_000n,
      hardStopMicrosUsd: 1_000_000n,
      maxNetworkAttempts: 42,
    });
    ledger.reserve({ reservationKey: 'unknown', amountMicrosUsd: 80_000n });
    ledger.reconcile({ reservationKey: 'unknown', knownCostMicrosUsd: null });

    expect(ledger.summary().reservedUnknownCostMicrosUsd).toBe(80_000n);
    expect(() => ledger.reserve({
      reservationKey: 'unknown',
      amountMicrosUsd: 1n,
    })).toThrow('BENCHMARK_BUDGET_RESERVATION_DUPLICATE');
  });

  it('enforces the hard stop before a network call', () => {
    const ledger = new BenchmarkBudgetLedger({
      warningMicrosUsd: 70n,
      hardStopMicrosUsd: 100n,
      maxNetworkAttempts: 2,
    });
    ledger.reserve({ reservationKey: 'first', amountMicrosUsd: 60n });
    expect(() => ledger.reserve({
      reservationKey: 'second',
      amountMicrosUsd: 41n,
    })).toThrow('BENCHMARK_HARD_STOP_PRE_CALL');
    ledger.reconcile({ reservationKey: 'first', knownCostMicrosUsd: 20 });
    ledger.reserve({ reservationKey: 'second', amountMicrosUsd: 41n });
    expect(() => ledger.reserve({
      reservationKey: 'third',
      amountMicrosUsd: 1n,
    })).toThrow('BENCHMARK_NETWORK_ATTEMPT_LIMIT');
  });
});
