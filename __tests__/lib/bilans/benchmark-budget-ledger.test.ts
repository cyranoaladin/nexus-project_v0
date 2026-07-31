/** @jest-environment node */

import {
  BenchmarkBudgetLedger,
  estimateBenchmarkCallReserve,
  extractBenchmarkModelPrices,
  replayBenchmarkBudgetEvents,
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

    expect(reserve).toBe(BigInt(6_383));
  });

  it('accepts the exact long decimal representation returned by OpenRouter', () => {
    const prices = extractBenchmarkModelPrices({
      data: [{
        id: 'openai/gpt-5.6-luna',
        pricing: {
          prompt: '0.0000001',
          completion: '0.0000006000000000000001',
        },
      }],
    }, ['openai/gpt-5.6-luna']);

    expect(estimateBenchmarkCallReserve({
      price: prices.get('openai/gpt-5.6-luna')!,
      maximumInputTokens: 2_500,
      maximumOutputTokens: 2_048,
      safetyMarginBasisPoints: 12_500,
    })).toBe(BigInt(3_385));
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
      warningMicrosUsd: BigInt(700_000),
      hardStopMicrosUsd: BigInt(1_000_000),
      maxNetworkAttempts: 42,
    });
    ledger.reserve({ reservationKey: 'attempt-1:network:1', amountMicrosUsd: BigInt(50_000) });
    expect(ledger.summary()).toMatchObject({
      attemptedCallCount: 1,
      totalKnownCostMicrosUsd: BigInt(0),
      openReservedCostMicrosUsd: BigInt(50_000),
    });

    ledger.reconcile({
      reservationKey: 'attempt-1:network:1',
      knownCostMicrosUsd: 12_345,
    });
    expect(ledger.summary()).toMatchObject({
      attemptedCallCount: 1,
      totalKnownCostMicrosUsd: BigInt(12_345),
      openReservedCostMicrosUsd: BigInt(0),
      reportedCostUndercountMicrosUsd: BigInt(0),
    });
  });

  it('counts known costs for rejected outputs and transport errors', () => {
    const ledger = new BenchmarkBudgetLedger({
      warningMicrosUsd: BigInt(700_000),
      hardStopMicrosUsd: BigInt(1_000_000),
      maxNetworkAttempts: 42,
    });
    for (const [key, cost] of [['schema-failure', 2_000], ['transport', 300]] as const) {
      ledger.reserve({ reservationKey: key, amountMicrosUsd: BigInt(10_000) });
      ledger.reconcile({ reservationKey: key, knownCostMicrosUsd: cost });
    }
    expect(ledger.summary().totalKnownCostMicrosUsd).toBe(BigInt(2_300));
  });

  it('keeps an UNKNOWN_OUTCOME reserve and blocks reuse of its key', () => {
    const ledger = new BenchmarkBudgetLedger({
      warningMicrosUsd: BigInt(700_000),
      hardStopMicrosUsd: BigInt(1_000_000),
      maxNetworkAttempts: 42,
    });
    ledger.reserve({ reservationKey: 'unknown', amountMicrosUsd: BigInt(80_000) });
    ledger.reconcile({ reservationKey: 'unknown', knownCostMicrosUsd: null });

    expect(ledger.summary().reservedUnknownCostMicrosUsd).toBe(BigInt(80_000));
    expect(() => ledger.reserve({
      reservationKey: 'unknown',
      amountMicrosUsd: BigInt(1),
    })).toThrow('BENCHMARK_BUDGET_RESERVATION_DUPLICATE');
  });

  it('enforces the hard stop before a network call', () => {
    const ledger = new BenchmarkBudgetLedger({
      warningMicrosUsd: BigInt(70),
      hardStopMicrosUsd: BigInt(100),
      maxNetworkAttempts: 2,
    });
    ledger.reserve({ reservationKey: 'first', amountMicrosUsd: BigInt(60) });
    expect(() => ledger.reserve({
      reservationKey: 'second',
      amountMicrosUsd: BigInt(41),
    })).toThrow('BENCHMARK_HARD_STOP_PRE_CALL');
    ledger.reconcile({ reservationKey: 'first', knownCostMicrosUsd: 20 });
    ledger.reserve({ reservationKey: 'second', amountMicrosUsd: BigInt(41) });
    expect(() => ledger.reserve({
      reservationKey: 'third',
      amountMicrosUsd: BigInt(1),
    })).toThrow('BENCHMARK_NETWORK_ATTEMPT_LIMIT');
  });

  it('reconstructs known and unknown costs from the durable journal', () => {
    const ledger = new BenchmarkBudgetLedger({
      warningMicrosUsd: BigInt(700_000),
      hardStopMicrosUsd: BigInt(1_000_000),
      maxNetworkAttempts: 42,
    });
    replayBenchmarkBudgetEvents(ledger, [{
      type: 'BUDGET_RESERVED',
      payload: { reservationKey: 'known', amountMicrosUsd: '1000' },
    }, {
      type: 'BUDGET_RECONCILED',
      payload: { reservationKey: 'known', knownCostMicrosUsd: 123 },
    }, {
      type: 'BUDGET_RESERVED',
      payload: { reservationKey: 'unknown', amountMicrosUsd: '2000' },
    }, {
      type: 'BUDGET_RECONCILED',
      payload: { reservationKey: 'unknown', knownCostMicrosUsd: null },
    }]);

    expect(ledger.summary()).toMatchObject({
      attemptedCallCount: 2,
      totalKnownCostMicrosUsd: BigInt(123),
      reservedUnknownCostMicrosUsd: BigInt(2_000),
      reportedCostUndercountMicrosUsd: BigInt(0),
    });
  });
});
