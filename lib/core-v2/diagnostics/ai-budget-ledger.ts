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
import type { DiagnosticAiBudgetLedger, PrismaClient } from '@/core-v2/generated/client';
import { ConflictError } from '../errors';

/** Scopes every row of this pilot — never shared with TeacherBrief or any other AI consumer's own accounting. */
export const AI_PILOT_KEY = 'c2-demo-pilot-2026';

export const PILOT_TOTAL_CAP_USD = 2.0;
export const PER_BILAN_CAP_USD = 0.75;
export const PER_AUDIENCE_CAP_USD = 0.3;
export const MAX_ATTEMPTS_PER_UNIT = 3;
export const MAX_OUTPUT_TOKENS = 2_048;

function toNumber(value: { toString(): string } | null): number {
  return value === null ? 0 : Number(value.toString());
}

/** Sums whichever cost is authoritative per row: the real cost once COMMITTED, the reservation while still RESERVED. RELEASED rows never count. */
function activeCost(row: Pick<DiagnosticAiBudgetLedger, 'status' | 'reservedCostUsd' | 'actualCostUsd'>): number {
  if (row.status === 'RELEASED') return 0;
  if (row.status === 'COMMITTED' && row.actualCostUsd !== null) return toNumber(row.actualCostUsd);
  return toNumber(row.reservedCostUsd);
}

export interface AiBudgetSnapshot {
  readonly pilotTotalUsd: number;
  readonly perBilanUsd: number;
  readonly perAudienceUsd: number | null;
  readonly attemptsForUnit: number;
}

export async function readAiBudgetSnapshot(
  client: PrismaClient,
  input: { readonly processingId: string; readonly audienceScope?: string | null },
): Promise<AiBudgetSnapshot> {
  const pilotRows = await client.diagnosticAiBudgetLedger.findMany({
    where: { pilotKey: AI_PILOT_KEY, status: { in: ['RESERVED', 'COMMITTED'] } },
    select: { status: true, reservedCostUsd: true, actualCostUsd: true },
  });
  const pilotTotalUsd = pilotRows.reduce((sum, row) => sum + activeCost(row), 0);

  const bilanRows = await client.diagnosticAiBudgetLedger.findMany({
    where: { pilotKey: AI_PILOT_KEY, processingId: input.processingId, status: { in: ['RESERVED', 'COMMITTED'] } },
    select: { status: true, reservedCostUsd: true, actualCostUsd: true },
  });
  const perBilanUsd = bilanRows.reduce((sum, row) => sum + activeCost(row), 0);

  let perAudienceUsd: number | null = null;
  let attemptsForUnit = 0;
  if (input.audienceScope !== undefined) {
    const audienceRows = await client.diagnosticAiBudgetLedger.findMany({
      where: {
        pilotKey: AI_PILOT_KEY,
        processingId: input.processingId,
        audienceScope: input.audienceScope,
      },
    });
    perAudienceUsd = audienceRows
      .filter((row) => row.status !== 'RELEASED')
      .reduce((sum, row) => sum + activeCost(row), 0);
    attemptsForUnit = audienceRows.filter((row) => row.status !== 'RELEASED').length;
  }

  return { pilotTotalUsd, perBilanUsd, perAudienceUsd, attemptsForUnit };
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
 */
export async function reserveAiBudget(client: PrismaClient, input: ReserveAiBudgetInput): Promise<DiagnosticAiBudgetLedger> {
  const snapshot = await readAiBudgetSnapshot(client, { processingId: input.processingId, audienceScope: input.audienceScope });

  if (snapshot.attemptsForUnit >= MAX_ATTEMPTS_PER_UNIT) {
    throw new ConflictError(`This generation unit has already reached its ${MAX_ATTEMPTS_PER_UNIT}-attempt cap.`, {
      processingId: input.processingId,
      audienceScope: input.audienceScope,
      attemptsForUnit: snapshot.attemptsForUnit,
    });
  }
  if (snapshot.pilotTotalUsd + input.estimatedCostUsd > PILOT_TOTAL_CAP_USD) {
    throw new ConflictError('This call would exceed the pilot’s total budget cap.', {
      pilotTotalUsd: snapshot.pilotTotalUsd,
      estimatedCostUsd: input.estimatedCostUsd,
      capUsd: PILOT_TOTAL_CAP_USD,
    });
  }
  if (snapshot.perBilanUsd + input.estimatedCostUsd > PER_BILAN_CAP_USD) {
    throw new ConflictError('This call would exceed the per-bilan budget cap.', {
      processingId: input.processingId,
      perBilanUsd: snapshot.perBilanUsd,
      estimatedCostUsd: input.estimatedCostUsd,
      capUsd: PER_BILAN_CAP_USD,
    });
  }
  if ((snapshot.perAudienceUsd ?? 0) + input.estimatedCostUsd > PER_AUDIENCE_CAP_USD) {
    throw new ConflictError('This call would exceed the per-audience budget cap.', {
      processingId: input.processingId,
      audienceScope: input.audienceScope,
      perAudienceUsd: snapshot.perAudienceUsd,
      estimatedCostUsd: input.estimatedCostUsd,
      capUsd: PER_AUDIENCE_CAP_USD,
    });
  }

  return client.diagnosticAiBudgetLedger.create({
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
}

/** Called only once the real provider response is known — replaces the reservation's estimate with the real reported cost. */
export async function commitAiBudgetEntry(
  client: PrismaClient,
  entryId: string,
  input: { readonly actualCostUsd: number; readonly providerRequestId?: string | null },
): Promise<DiagnosticAiBudgetLedger> {
  return client.diagnosticAiBudgetLedger.update({
    where: { id: entryId },
    data: { status: 'COMMITTED', actualCostUsd: input.actualCostUsd, providerRequestId: input.providerRequestId ?? null },
  });
}

/**
 * Marks a reservation as definitively not incurred — ONLY when the
 * provider's own response confirms no generation happened (e.g. refused
 * at routing, before any token was produced). Never called for a
 * timeout, a network error, or any other ambiguous outcome: those stay
 * RESERVED, counted against the budget, until a human reconciles them.
 */
export async function releaseAiBudgetEntry(client: PrismaClient, entryId: string): Promise<DiagnosticAiBudgetLedger> {
  return client.diagnosticAiBudgetLedger.update({ where: { id: entryId }, data: { status: 'RELEASED' } });
}
