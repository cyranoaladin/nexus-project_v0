/**
 * Carries the C2 AI pilot's already-real, already-billed spend into
 * whichever Core v2 database CORE_V2_DATABASE_URL points at, BEFORE that
 * environment is ever allowed to reserve a new real call (mission
 * "TERMINER LA LIVRAISON DE #316", 2026-09-22, §3).
 *
 * Reads its input EXCLUSIVELY from the durable, committed evidence log
 * (docs/core-v2/evidence/*.json) — never from the disposable dev/test
 * database the original call happened against, which every test run
 * truncates and which no longer holds the row by the time this runs.
 * Never copies the disposable database wholesale, never reimports any
 * row a Jest test simulated (those never had a real providerRequestId
 * from an actual provider response).
 *
 * Idempotent: safe to run on every deploy/migration pass. A second run
 * against a database that already carries this exact providerRequestId
 * is a confirmed no-op (recordCarryOverCommittedSpend's own advisory-lock
 * transaction), never a duplicate row, never a doubled total.
 *
 * Verified independently against the REAL OpenRouter account (free
 * /api/v1/auth/key read, 2026-09-22) that exactly one real spend exists
 * for this pilot: usage_daily === usage_weekly === 0.010464, and
 * usage_monthly (0.0108805) is exactly this call plus the account's own
 * unrelated pre-existing 0.0004165 — there is no other real operation of
 * this pilot to reconcile.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import { recordCarryOverCommittedSpend, readAiBudgetSnapshot, PILOT_TOTAL_CAP_USD } from '@/lib/core-v2/diagnostics/ai-budget-ledger';

const EVIDENCE_DIR = join(process.cwd(), 'docs/core-v2/evidence');

interface EvidenceLedgerRow {
  readonly providerRequestId: string;
  readonly actualCostUsd: number;
  readonly provider: string;
  readonly model: string;
  readonly status: string;
}

function loadEvidenceEntries(): readonly EvidenceLedgerRow[] {
  const files = readdirSync(EVIDENCE_DIR).filter((f) => f.endsWith('.json'));
  const entries: EvidenceLedgerRow[] = [];
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(join(EVIDENCE_DIR, file), 'utf8')) as { ledger?: EvidenceLedgerRow };
    if (!parsed.ledger) continue;
    if (parsed.ledger.status !== 'COMMITTED') {
      throw new Error(`RECONCILE_REFUSED: ${file} is not a COMMITTED entry (status=${parsed.ledger.status}) — only a confirmed, billed spend may be carried over.`);
    }
    if (!parsed.ledger.providerRequestId) {
      throw new Error(`RECONCILE_REFUSED: ${file} has no providerRequestId — a carry-over with no traceable provider identifier is refused.`);
    }
    entries.push(parsed.ledger);
  }
  return entries;
}

async function main(): Promise<void> {
  const entries = loadEvidenceEntries();
  if (entries.length === 0) {
    console.log('[reconcile-ai-pilot-carry-over] no evidence entries found — nothing to carry over.');
    return;
  }

  const client = await requireCoreV2Client();
  for (const entry of entries) {
    const row = await recordCarryOverCommittedSpend(client, {
      providerRequestId: entry.providerRequestId,
      actualCostUsd: entry.actualCostUsd,
      provider: entry.provider,
      model: entry.model,
    });
    console.log(`[reconcile-ai-pilot-carry-over] carried over ${entry.providerRequestId}: $${entry.actualCostUsd} (ledger row ${row.id}).`);
  }

  const snapshot = await readAiBudgetSnapshot(client, {});
  console.log(`[reconcile-ai-pilot-carry-over] pilot total after reconciliation: $${snapshot.pilotTotalUsd.toFixed(6)} of $${PILOT_TOTAL_CAP_USD} cap.`);
  await disconnectCoreV2Client();
}

main().catch(async (error) => {
  console.error('[reconcile-ai-pilot-carry-over] FAILED', error instanceof Error ? error.message : error);
  await disconnectCoreV2Client().catch(() => undefined);
  process.exit(1);
});
