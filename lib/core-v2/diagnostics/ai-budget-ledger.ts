/**
 * Persistent, reconciliation-safe budget accounting for the C2 AI pilot
 * (owner decision, 2026-09-22): OpenRouter, anthropic/claude-sonnet-4.5,
 * DEMO_FIXTURE synthetic data only. Never an in-memory counter — every
 * reservation is a DB row, written BEFORE the provider call it covers, so
 * a crash between reservation and call still counts against the budget.
 * A request of unknown outcome (timeout, ambiguous network failure)
 * stays RESERVED — counted, never silently dropped — until an explicit
 * reconciliation confirms no cost was incurred.
 */
import { Prisma, type DiagnosticAiBudgetLedger, type PrismaClient } from '@/core-v2/generated/client';
import { ConflictError } from '../errors';

/** Any client this module can read/write through: the top-level PrismaClient, or a transaction client already inside reserveAiBudget's own transaction. */
type QueryableClient = PrismaClient | Prisma.TransactionClient;

/** Scopes every row of this pilot — never shared with TeacherBrief or any other AI consumer's own accounting. */
export const AI_PILOT_KEY = 'c2-demo-pilot-2026';

export const PILOT_TOTAL_CAP_USD = 2.0;
export const PER_BILAN_CAP_USD = 0.75;
export const PER_AUDIENCE_CAP_USD = 0.3;
export const MAX_ATTEMPTS_PER_UNIT = 3;
export const MAX_OUTPUT_TOKENS = 2_048;

/**
 * Whole micro-dollars (1e-6 USD), matching the ledger's own
 * Decimal(10,6) precision exactly. Every cap comparison happens in this
 * integer unit, never as a raw floating-point `>` (mission §5: "ne
 * transforme pas une approximation flottante en plafond financier exact"
 * — 0.3, for instance, has no exact IEEE-754 double representation;
 * rounding to the nearest micro-dollar after scaling is the standard fix,
 * and correctly recovers the exact intended integer for every amount this
 * ledger ever stores).
 */
function toMicroUsd(amountUsd: number): number {
  return Math.round(amountUsd * 1_000_000);
}

function toNumber(value: { toString(): string } | null): number {
  return value === null ? 0 : Number(value.toString());
}

/** Sums whichever cost is authoritative per row, in micro-dollars: the real cost once COMMITTED, the reservation while still RESERVED. RELEASED rows never count. */
function activeCostMicroUsd(row: Pick<DiagnosticAiBudgetLedger, 'status' | 'reservedCostUsd' | 'actualCostUsd'>): number {
  if (row.status === 'RELEASED') return 0;
  if (row.status === 'COMMITTED' && row.actualCostUsd !== null) return toMicroUsd(toNumber(row.actualCostUsd));
  return toMicroUsd(toNumber(row.reservedCostUsd));
}

export interface AiBudgetSnapshot {
  readonly pilotTotalUsd: number;
  readonly perBilanUsd: number;
  readonly perAudienceUsd: number | null;
  readonly attemptsForUnit: number;
  /** Same three sums, in whole micro-dollars — the exact integers cap comparisons are actually decided on (mission §5). */
  readonly pilotTotalMicroUsd: number;
  readonly perBilanMicroUsd: number;
  readonly perAudienceMicroUsd: number | null;
}

export async function readAiBudgetSnapshot(
  client: QueryableClient,
  input: { readonly processingId: string; readonly audienceScope?: string | null },
): Promise<AiBudgetSnapshot> {
  const pilotRows = await client.diagnosticAiBudgetLedger.findMany({
    where: { pilotKey: AI_PILOT_KEY, status: { in: ['RESERVED', 'COMMITTED'] } },
    select: { status: true, reservedCostUsd: true, actualCostUsd: true },
  });
  const pilotTotalMicroUsd = pilotRows.reduce((sum, row) => sum + activeCostMicroUsd(row), 0);

  const bilanRows = await client.diagnosticAiBudgetLedger.findMany({
    where: { pilotKey: AI_PILOT_KEY, processingId: input.processingId, status: { in: ['RESERVED', 'COMMITTED'] } },
    select: { status: true, reservedCostUsd: true, actualCostUsd: true },
  });
  const perBilanMicroUsd = bilanRows.reduce((sum, row) => sum + activeCostMicroUsd(row), 0);

  let perAudienceMicroUsd: number | null = null;
  let attemptsForUnit = 0;
  if (input.audienceScope !== undefined) {
    const audienceRows = await client.diagnosticAiBudgetLedger.findMany({
      where: {
        pilotKey: AI_PILOT_KEY,
        processingId: input.processingId,
        audienceScope: input.audienceScope,
      },
    });
    perAudienceMicroUsd = audienceRows
      .filter((row) => row.status !== 'RELEASED')
      .reduce((sum, row) => sum + activeCostMicroUsd(row), 0);
    attemptsForUnit = audienceRows.filter((row) => row.status !== 'RELEASED').length;
  }

  return {
    pilotTotalUsd: pilotTotalMicroUsd / 1_000_000,
    perBilanUsd: perBilanMicroUsd / 1_000_000,
    perAudienceUsd: perAudienceMicroUsd === null ? null : perAudienceMicroUsd / 1_000_000,
    attemptsForUnit,
    pilotTotalMicroUsd,
    perBilanMicroUsd,
    perAudienceMicroUsd,
  };
}

export interface ReserveAiBudgetInput {
  readonly processingId: string;
  readonly audienceScope: string;
  readonly estimatedCostUsd: number;
  readonly provider: string;
  readonly model: string;
  readonly endpointTag?: string | null;
}

/**
 * Reserves the worst-case cost of one call BEFORE it is made. Refuses
 * outright — never silently truncating the request — if any cap (pilot
 * total, per-bilan, per-audience) would be exceeded, or if this
 * (processingId, audienceScope) unit has already reached
 * MAX_ATTEMPTS_PER_UNIT non-released attempts.
 *
 * Atomic (mission §5): the read-check-insert sequence is wrapped in one
 * DB transaction, serialized by a Postgres advisory lock keyed on
 * AI_PILOT_KEY. A plain read-then-insert (even against persistent rows)
 * lets two concurrent reservations both read the same snapshot and both
 * pass the same cap check — the lock makes that structurally impossible:
 * only one reservation for this pilot is ever mid-flight at a time. The
 * pilot's total real call volume is tiny (well under $2 at a few cents
 * each), so a single global serialization point costs nothing in
 * practice while closing every cap dimension (pilot/bilan/audience/
 * attempts) at once. The transaction itself never spans the network call
 * — it commits and returns before any provider request is made.
 */
export async function reserveAiBudget(client: PrismaClient, input: ReserveAiBudgetInput): Promise<DiagnosticAiBudgetLedger> {
  return client.$transaction(async (tx) => {
    // Postgres advisory locks take two int4 keys; a fixed namespace hash
    // plus a hash of the pilot key scopes this lock to exactly this
    // pilot's reservations without colliding with unrelated advisory
    // locks elsewhere in the app.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('core_v2_ai_budget_ledger'), hashtext(${AI_PILOT_KEY}))`;

    const snapshot = await readAiBudgetSnapshot(tx, { processingId: input.processingId, audienceScope: input.audienceScope });
    const estimatedMicroUsd = toMicroUsd(input.estimatedCostUsd);

    if (snapshot.attemptsForUnit >= MAX_ATTEMPTS_PER_UNIT) {
      throw new ConflictError(`This generation unit has already reached its ${MAX_ATTEMPTS_PER_UNIT}-attempt cap.`, {
        processingId: input.processingId,
        audienceScope: input.audienceScope,
        attemptsForUnit: snapshot.attemptsForUnit,
      });
    }
    if (snapshot.pilotTotalMicroUsd + estimatedMicroUsd > toMicroUsd(PILOT_TOTAL_CAP_USD)) {
      throw new ConflictError('This call would exceed the pilot’s total budget cap.', {
        pilotTotalUsd: snapshot.pilotTotalUsd,
        estimatedCostUsd: input.estimatedCostUsd,
        capUsd: PILOT_TOTAL_CAP_USD,
      });
    }
    if (snapshot.perBilanMicroUsd + estimatedMicroUsd > toMicroUsd(PER_BILAN_CAP_USD)) {
      throw new ConflictError('This call would exceed the per-bilan budget cap.', {
        processingId: input.processingId,
        perBilanUsd: snapshot.perBilanUsd,
        estimatedCostUsd: input.estimatedCostUsd,
        capUsd: PER_BILAN_CAP_USD,
      });
    }
    if ((snapshot.perAudienceMicroUsd ?? 0) + estimatedMicroUsd > toMicroUsd(PER_AUDIENCE_CAP_USD)) {
      throw new ConflictError('This call would exceed the per-audience budget cap.', {
        processingId: input.processingId,
        audienceScope: input.audienceScope,
        perAudienceUsd: snapshot.perAudienceUsd,
        estimatedCostUsd: input.estimatedCostUsd,
        capUsd: PER_AUDIENCE_CAP_USD,
      });
    }

    return tx.diagnosticAiBudgetLedger.create({
      data: {
        pilotKey: AI_PILOT_KEY,
        processingId: input.processingId,
        audienceScope: input.audienceScope,
        attempt: snapshot.attemptsForUnit + 1,
        status: 'RESERVED',
        reservedCostUsd: input.estimatedCostUsd,
        provider: input.provider,
        model: input.model,
        endpointTag: input.endpointTag ?? null,
      },
    });
  });
}

/** Called only once the real provider response is known — replaces the reservation's estimate with the real reported cost. */
export async function commitAiBudgetEntry(
  client: PrismaClient,
  entryId: string,
  input: { readonly actualCostUsd: number; readonly providerRequestId?: string | null },
): Promise<DiagnosticAiBudgetLedger> {
  // Guarded, idempotent transition — ONLY from RESERVED (mission §6: "les
  // transitions de réconciliation doivent être idempotentes et ne pas
  // permettre à un résultat tardif d'annuler une dépense déjà constatée").
  // A retried/duplicate commit call on an already-COMMITTED or already-
  // RELEASED row is a no-op: it returns the row exactly as it already is,
  // it never overwrites a real, already-recorded cost.
  await client.diagnosticAiBudgetLedger.updateMany({
    where: { id: entryId, status: 'RESERVED' },
    data: { status: 'COMMITTED', actualCostUsd: input.actualCostUsd, providerRequestId: input.providerRequestId ?? null },
  });
  return client.diagnosticAiBudgetLedger.findUniqueOrThrow({ where: { id: entryId } });
}

/**
 * Marks a reservation as definitively not incurred — ONLY when the
 * provider's own response confirms no generation happened (e.g. refused
 * at routing, before any token was produced). Never called for a
 * timeout, a network error, or any other ambiguous outcome: those stay
 * RESERVED, counted against the budget, until a human reconciles them.
 *
 * Guarded, idempotent transition — ONLY from RESERVED (mission §6): a
 * repeated release call is a harmless no-op, and — critically — a release
 * call arriving after the entry has already been COMMITTED can never
 * downgrade it back off the ledger's books. A real, billed spend is never
 * erased by a late or duplicate reconciliation signal.
 */
export async function releaseAiBudgetEntry(client: PrismaClient, entryId: string): Promise<DiagnosticAiBudgetLedger> {
  await client.diagnosticAiBudgetLedger.updateMany({ where: { id: entryId, status: 'RESERVED' }, data: { status: 'RELEASED' } });
  return client.diagnosticAiBudgetLedger.findUniqueOrThrow({ where: { id: entryId } });
}
