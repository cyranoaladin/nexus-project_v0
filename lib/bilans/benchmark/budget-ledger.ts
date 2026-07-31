import 'server-only';

import { z } from 'zod';

// OpenRouter currently serializes some catalogue prices with harmless decimal
// tails (for example 0.0000006000000000000001). Keep the parse exact and
// integer-only instead of rounding those values through Number.
const PRICE_DECIMAL_PLACES = 24;
const DecimalPriceSchema = z.string().regex(/^\d+(?:\.\d{1,24})?$/);

const ModelPriceEntrySchema = z.object({
  id: z.string().min(1),
  pricing: z.object({
    prompt: DecimalPriceSchema,
    completion: DecimalPriceSchema,
    internal_reasoning: DecimalPriceSchema.optional(),
    request: DecimalPriceSchema.optional(),
  }).passthrough(),
}).passthrough();

const CatalogSchema = z.object({
  data: z.array(z.unknown()),
}).passthrough();

export type BenchmarkModelPrice = Readonly<{
  modelId: string;
  promptUsdPerToken: string;
  completionUsdPerToken: string;
  reasoningUsdPerToken: string;
  requestUsd: string;
}>;

const PRICE_SCALE = BigInt('1000000000000000000000000');
const MICROS_PER_USD = BigInt('1000000');
const BASIS_POINTS = BigInt('10000');

function decimalToScaled(value: string): bigint {
  if (!DecimalPriceSchema.safeParse(value).success) {
    throw new Error('BLOCKED_BY_BENCHMARK_PRICE_METADATA');
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * PRICE_SCALE
    + BigInt(fraction.padEnd(PRICE_DECIMAL_PLACES, '0'));
}

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - BigInt(1)) / denominator;
}

export function extractBenchmarkModelPrices(
  catalog: unknown,
  requiredModelIds: readonly string[],
): ReadonlyMap<string, BenchmarkModelPrice> {
  const parsed = CatalogSchema.safeParse(catalog);
  if (
    !parsed.success
    || requiredModelIds.length === 0
    || new Set(requiredModelIds).size !== requiredModelIds.length
  ) {
    throw new Error('BLOCKED_BY_BENCHMARK_PRICE_METADATA');
  }
  const prices = new Map<string, BenchmarkModelPrice>();
  for (const modelId of requiredModelIds) {
    const candidate = parsed.data.data.find((entry) =>
      entry !== null
      && typeof entry === 'object'
      && 'id' in entry
      && entry.id === modelId);
    const selected = ModelPriceEntrySchema.safeParse(candidate);
    if (!selected.success) {
      throw new Error('BLOCKED_BY_BENCHMARK_PRICE_METADATA');
    }
    const entry = selected.data;
    const price = Object.freeze({
      modelId,
      promptUsdPerToken: entry.pricing.prompt,
      completionUsdPerToken: entry.pricing.completion,
      reasoningUsdPerToken:
        entry.pricing.internal_reasoning ?? entry.pricing.completion,
      requestUsd: entry.pricing.request ?? '0',
    });
    for (const value of [
      price.promptUsdPerToken,
      price.completionUsdPerToken,
      price.reasoningUsdPerToken,
      price.requestUsd,
    ]) decimalToScaled(value);
    prices.set(modelId, price);
  }
  return prices;
}

export function estimateBenchmarkCallReserve(
  input: Readonly<{
    price: BenchmarkModelPrice;
    maximumInputTokens: number;
    maximumOutputTokens: number;
    safetyMarginBasisPoints: number;
  }>,
): bigint {
  if (
    !Number.isSafeInteger(input.maximumInputTokens)
    || input.maximumInputTokens <= 0
    || !Number.isSafeInteger(input.maximumOutputTokens)
    || input.maximumOutputTokens <= 0
    || !Number.isSafeInteger(input.safetyMarginBasisPoints)
    || input.safetyMarginBasisPoints < 10_000
  ) {
    throw new Error('BENCHMARK_BUDGET_ESTIMATE_INVALID');
  }
  const inputUnits = BigInt(input.maximumInputTokens);
  const outputUnits = BigInt(input.maximumOutputTokens);
  const scaledUsd =
    decimalToScaled(input.price.promptUsdPerToken) * inputUnits
    + decimalToScaled(input.price.completionUsdPerToken) * outputUnits
    + decimalToScaled(input.price.reasoningUsdPerToken) * outputUnits
    + decimalToScaled(input.price.requestUsd);
  return ceilDivide(
    scaledUsd * MICROS_PER_USD * BigInt(input.safetyMarginBasisPoints),
    PRICE_SCALE * BASIS_POINTS,
  );
}

type Reservation = {
  amountMicrosUsd: bigint;
  status: 'OPEN' | 'UNKNOWN' | 'RECONCILED';
};

export class BenchmarkBudgetLedger {
  private readonly warningMicrosUsd: bigint;
  private readonly hardStopMicrosUsd: bigint;
  private readonly maxNetworkAttempts: number;
  private readonly reservations = new Map<string, Reservation>();
  private totalKnownCostMicrosUsd = BigInt(0);

  constructor(input: Readonly<{
    warningMicrosUsd: bigint;
    hardStopMicrosUsd: bigint;
    maxNetworkAttempts: number;
  }>) {
    if (
      input.warningMicrosUsd <= BigInt(0)
      || input.hardStopMicrosUsd <= BigInt(0)
      || input.warningMicrosUsd > input.hardStopMicrosUsd
      || !Number.isSafeInteger(input.maxNetworkAttempts)
      || input.maxNetworkAttempts <= 0
    ) {
      throw new Error('BENCHMARK_BUDGET_CONFIGURATION_INVALID');
    }
    this.warningMicrosUsd = input.warningMicrosUsd;
    this.hardStopMicrosUsd = input.hardStopMicrosUsd;
    this.maxNetworkAttempts = input.maxNetworkAttempts;
  }

  reserve(input: Readonly<{
    reservationKey: string;
    amountMicrosUsd: bigint;
  }>): void {
    if (this.reservations.has(input.reservationKey)) {
      throw new Error('BENCHMARK_BUDGET_RESERVATION_DUPLICATE');
    }
    if (this.reservations.size >= this.maxNetworkAttempts) {
      throw new Error('BENCHMARK_NETWORK_ATTEMPT_LIMIT');
    }
    if (input.amountMicrosUsd <= BigInt(0)) {
      throw new Error('BENCHMARK_BUDGET_RESERVATION_INVALID');
    }
    const existingReserved = [...this.reservations.values()]
      .filter(({ status }) => status !== 'RECONCILED')
      .reduce((total, { amountMicrosUsd }) => total + amountMicrosUsd, BigInt(0));
    if (
      this.totalKnownCostMicrosUsd
      + existingReserved
      + input.amountMicrosUsd
      > this.hardStopMicrosUsd
    ) {
      throw new Error('BENCHMARK_HARD_STOP_PRE_CALL');
    }
    this.reservations.set(input.reservationKey, {
      amountMicrosUsd: input.amountMicrosUsd,
      status: 'OPEN',
    });
  }

  reconcile(input: Readonly<{
    reservationKey: string;
    knownCostMicrosUsd: number | null;
  }>): void {
    const reservation = this.reservations.get(input.reservationKey);
    if (reservation === undefined || reservation.status !== 'OPEN') {
      throw new Error('BENCHMARK_BUDGET_RECONCILIATION_INVALID');
    }
    if (input.knownCostMicrosUsd === null) {
      reservation.status = 'UNKNOWN';
      return;
    }
    if (
      !Number.isSafeInteger(input.knownCostMicrosUsd)
      || input.knownCostMicrosUsd < 0
    ) {
      throw new Error('BENCHMARK_BUDGET_RECONCILIATION_INVALID');
    }
    this.totalKnownCostMicrosUsd += BigInt(input.knownCostMicrosUsd);
    reservation.status = 'RECONCILED';
  }

  summary() {
    const values = [...this.reservations.values()];
    const openReservedCostMicrosUsd = values
      .filter(({ status }) => status === 'OPEN')
      .reduce((total, { amountMicrosUsd }) => total + amountMicrosUsd, BigInt(0));
    const reservedUnknownCostMicrosUsd = values
      .filter(({ status }) => status === 'UNKNOWN')
      .reduce((total, { amountMicrosUsd }) => total + amountMicrosUsd, BigInt(0));
    return Object.freeze({
      attemptedCallCount: values.length,
      totalKnownCostMicrosUsd: this.totalKnownCostMicrosUsd,
      openReservedCostMicrosUsd,
      reservedUnknownCostMicrosUsd,
      reportedCostUndercountMicrosUsd: BigInt(0),
      warningReached:
        this.totalKnownCostMicrosUsd
        + openReservedCostMicrosUsd
        + reservedUnknownCostMicrosUsd
        >= this.warningMicrosUsd,
      hardStopMicrosUsd: this.hardStopMicrosUsd,
    });
  }
}

export function replayBenchmarkBudgetEvents(
  ledger: BenchmarkBudgetLedger,
  events: readonly Readonly<{
    type: string;
    payload: Readonly<Record<string, unknown>>;
  }>[],
): void {
  for (const event of events) {
    if (event.type === 'BUDGET_RESERVED') {
      if (
        typeof event.payload.reservationKey !== 'string'
        || typeof event.payload.amountMicrosUsd !== 'string'
        || !/^[1-9]\d*$/.test(event.payload.amountMicrosUsd)
      ) throw new Error('BENCHMARK_BUDGET_JOURNAL_INVALID');
      ledger.reserve({
        reservationKey: event.payload.reservationKey,
        amountMicrosUsd: BigInt(event.payload.amountMicrosUsd),
      });
    }
    if (event.type === 'BUDGET_RECONCILED') {
      if (
        typeof event.payload.reservationKey !== 'string'
        || !(
          event.payload.knownCostMicrosUsd === null
          || (
            typeof event.payload.knownCostMicrosUsd === 'number'
            && Number.isSafeInteger(event.payload.knownCostMicrosUsd)
            && event.payload.knownCostMicrosUsd >= 0
          )
        )
      ) throw new Error('BENCHMARK_BUDGET_JOURNAL_INVALID');
      ledger.reconcile({
        reservationKey: event.payload.reservationKey,
        knownCostMicrosUsd: event.payload.knownCostMicrosUsd,
      });
    }
  }
}
