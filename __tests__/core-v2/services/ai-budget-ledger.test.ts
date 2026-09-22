/**
 * AI budget ledger (owner decision, 2026-09-22, mission §4/§5): persistent,
 * reconciliation-safe accounting for the C2 pilot. No network calls here —
 * pure DB logic, real Postgres rows.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@/core-v2/generated/client';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

import { createHousehold, createStudent } from '@/lib/core-v2/services';
import { attributeDiagnostic } from '@/lib/core-v2/services/diagnostics';
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';
import { enqueueDiagnosticSubmissionProcessing } from '@/lib/core-v2/services/diagnostic-processing';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import {
  AI_PILOT_KEY,
  MAX_ATTEMPTS_PER_UNIT,
  PER_AUDIENCE_CAP_USD,
  PER_BILAN_CAP_USD,
  PILOT_TOTAL_CAP_USD,
  commitAiBudgetEntry,
  readAiBudgetSnapshot,
  releaseAiBudgetEntry,
  reserveAiBudget,
} from '@/lib/core-v2/diagnostics/ai-budget-ledger';

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
});

function allowDemoFixtureFor(...studentIds: string[]) {
  const existing = (process.env.DIAGNOSTIC_DEMO_STUDENT_IDS ?? '').split(',').filter(Boolean);
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = [...existing, ...studentIds].join(',');
}

function eleveActor(userId: string) {
  return { userId, role: 'ELEVE' as const };
}

async function seedProcessing(client: PrismaClient, ctx: ServiceContext, label: string): Promise<string> {
  const { household } = await createHousehold(client, ctx, {
    parent: { firstName: `P${label}`, lastName: 'Synthetic', email: `parent-ai-budget-${label}@synthetic.test` },
  });
  const { student, user } = await createStudent(client, ctx, {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  allowDemoFixtureFor(student.id);
  const instrumentKey = `AI-BUDGET-${label}`;
  const instrument = await client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: `AI budget instrument ${label}`,
      subject: 'Test',
      level: 'Toutes',
      targetSession: 'DEMO',
      form: 'FORM_TEST',
      durationMinutes: 30,
      modalities: 'Test only.',
      catalogStatus: 'DEMO_FIXTURE',
      manifestChecksum: createHash('sha256').update(instrumentKey).digest('hex'),
      manifestVersion: 'test/1.0',
      subjectSha256: createHash('sha256').update(`subject-${instrumentKey}`).digest('hex'),
    },
  });
  const assignment = await attributeDiagnostic(client, ctx, { studentId: student.id, instrumentRefId: instrument.id });
  const pdf = await renderHtmlToPdf(`<html><body><p>Réponse ${label}</p></body></html>`);
  const { submission } = await depositOwnDiagnosticSubmission(client, h.ctx(eleveActor(user.id)), {
    assignmentId: assignment.id,
    originalFilename: 'reponses.pdf',
    mimeType: 'application/pdf',
    bytes: pdf,
  });
  const processing = await enqueueDiagnosticSubmissionProcessing(client, ctx, submission.id);
  return processing.id;
}

describe('reserveAiBudget — normal reservation', () => {
  test('creates a RESERVED row and counts toward every cap immediately', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `A-${randomUUID()}`);

    const entry = await reserveAiBudget(h.client, {
      processingId,
      audienceScope: 'pedagogical',
      estimatedCostUsd: 0.05,
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.5',
    });
    expect(entry.status).toBe('RESERVED');
    expect(entry.pilotKey).toBe(AI_PILOT_KEY);
    expect(entry.attempt).toBe(1);

    const snapshot = await readAiBudgetSnapshot(h.client, { processingId, audienceScope: 'pedagogical' });
    expect(snapshot.pilotTotalUsd).toBeCloseTo(0.05, 6);
    expect(snapshot.perBilanUsd).toBeCloseTo(0.05, 6);
    expect(snapshot.perAudienceUsd).toBeCloseTo(0.05, 6);
    expect(snapshot.attemptsForUnit).toBe(1);
  });
});

describe('reserveAiBudget — caps refuse outright, never a silent truncation', () => {
  test('refuses when the pilot-wide total cap would be exceeded', async () => {
    const ctx = h.ctx();
    // Each filler is its OWN bilan (processingId) with a single committed
    // audience, so no filler ever approaches the per-bilan (0.75) or
    // per-audience (0.30) caps — only the pilot-wide sum is being probed.
    let pilotTotalSoFar = 0;
    for (let i = 0; i < 7; i += 1) {
      const fillerProcessingId = await seedProcessing(h.client, ctx, `B${i}-${randomUUID()}`);
      const entry = await reserveAiBudget(h.client, {
        processingId: fillerProcessingId,
        audienceScope: 'pedagogical',
        estimatedCostUsd: 0.28,
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
      });
      await commitAiBudgetEntry(h.client, entry.id, { actualCostUsd: 0.28 });
      pilotTotalSoFar += 0.28;
    }
    // 7 * 0.28 = 1.96 committed; one more 0.28 (on a brand-new bilan/audience,
    // itself well under every OTHER cap) would reach 2.24 > 2.00 pilot cap.
    const lastProcessingId = await seedProcessing(h.client, ctx, `B-last-${randomUUID()}`);
    await expect(
      reserveAiBudget(h.client, {
        processingId: lastProcessingId,
        audienceScope: 'pedagogical',
        estimatedCostUsd: 0.28,
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const snapshot = await readAiBudgetSnapshot(h.client, { processingId: lastProcessingId });
    expect(snapshot.pilotTotalUsd).toBeCloseTo(pilotTotalSoFar, 6);
    expect(snapshot.pilotTotalUsd).toBeLessThanOrEqual(PILOT_TOTAL_CAP_USD);
  });

  test('refuses when the per-bilan cap would be exceeded, even though no single audience exceeds its own cap', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `C-${randomUUID()}`);
    // Two committed audiences at 0.3 each (each individually within the 0.30
    // per-audience cap) already total 0.6 for this one bilan.
    for (const audienceScope of ['pedagogical', 'candidate']) {
      const entry = await reserveAiBudget(h.client, {
        processingId,
        audienceScope,
        estimatedCostUsd: 0.3,
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
      });
      await commitAiBudgetEntry(h.client, entry.id, { actualCostUsd: 0.3 });
    }

    // A third audience, requesting only 0.2 (itself far under the 0.30
    // per-audience cap), still pushes this bilan's total to 0.8 > 0.75.
    await expect(
      reserveAiBudget(h.client, {
        processingId,
        audienceScope: 'parent-reader',
        estimatedCostUsd: 0.2,
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(PER_BILAN_CAP_USD).toBe(0.75);
  });

  test('refuses when the per-audience cap would be exceeded, even under the per-bilan cap', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `D-${randomUUID()}`);
    const first = await reserveAiBudget(h.client, {
      processingId,
      audienceScope: 'pedagogical',
      estimatedCostUsd: 0.2,
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.5',
    });
    await commitAiBudgetEntry(h.client, first.id, { actualCostUsd: 0.2 });

    await expect(
      reserveAiBudget(h.client, {
        processingId,
        audienceScope: 'pedagogical', // same audience — 0.2 + 0.2 = 0.4 > 0.30 cap
        estimatedCostUsd: 0.2,
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(PER_AUDIENCE_CAP_USD).toBe(0.3);
  });

  test('refuses a 4th attempt for the same (processingId, audienceScope) unit', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `E-${randomUUID()}`);
    for (let i = 0; i < MAX_ATTEMPTS_PER_UNIT; i += 1) {
      const entry = await reserveAiBudget(h.client, {
        processingId,
        audienceScope: 'pedagogical',
        estimatedCostUsd: 0.01,
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
      });
      expect(entry.attempt).toBe(i + 1);
    }
    await expect(
      reserveAiBudget(h.client, {
        processingId,
        audienceScope: 'pedagogical',
        estimatedCostUsd: 0.01,
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('reconciliation safety — an unknown-status (still RESERVED) spend stays counted', () => {
  test('a RESERVED entry that is never committed nor released still counts against every cap', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `F-${randomUUID()}`);
    // Simulates a request whose outcome is unknown (e.g. a network timeout): reserved, then nothing else ever happens to it.
    await reserveAiBudget(h.client, {
      processingId,
      audienceScope: 'pedagogical',
      estimatedCostUsd: 0.25,
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.5',
    });

    const snapshot = await readAiBudgetSnapshot(h.client, { processingId, audienceScope: 'pedagogical' });
    expect(snapshot.perAudienceUsd).toBeCloseTo(0.25, 6); // still provisioned, not silently dropped

    // A second call requesting more than the remaining headroom (0.30 - 0.25 = 0.05) is refused.
    await expect(
      reserveAiBudget(h.client, {
        processingId,
        audienceScope: 'pedagogical',
        estimatedCostUsd: 0.1,
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('an explicitly RELEASED entry (confirmed no cost incurred) no longer counts', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `G-${randomUUID()}`);
    const entry = await reserveAiBudget(h.client, {
      processingId,
      audienceScope: 'pedagogical',
      estimatedCostUsd: 0.25,
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.5',
    });
    await releaseAiBudgetEntry(h.client, entry.id);

    const snapshot = await readAiBudgetSnapshot(h.client, { processingId, audienceScope: 'pedagogical' });
    expect(snapshot.perAudienceUsd).toBeCloseTo(0, 6);

    // The same headroom is available again since the release genuinely freed it.
    await expect(
      reserveAiBudget(h.client, {
        processingId,
        audienceScope: 'pedagogical',
        estimatedCostUsd: 0.25,
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
      }),
    ).resolves.toMatchObject({ status: 'RESERVED' });
  });

  test('commitAiBudgetEntry replaces the reserved estimate with the real reported cost', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `H-${randomUUID()}`);
    const entry = await reserveAiBudget(h.client, {
      processingId,
      audienceScope: 'pedagogical',
      estimatedCostUsd: 0.29, // worst-case estimate
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.5',
    });
    await commitAiBudgetEntry(h.client, entry.id, { actualCostUsd: 0.041, providerRequestId: 'gen-abc123' });

    const snapshot = await readAiBudgetSnapshot(h.client, { processingId, audienceScope: 'pedagogical' });
    expect(snapshot.perAudienceUsd).toBeCloseTo(0.041, 6); // the real cost, not the worst-case estimate
  });
});

describe('reserveAiBudget — atomic under real concurrency (mission §5)', () => {
  test('two concurrent reservations near the PILOT-WIDE cap, on two different bilans: exactly one succeeds', async () => {
    const ctx = h.ctx();
    // Spread the $1.80 filler across 3 bilans x 2 audiences ($0.30 each) so
    // no single per-bilan (0.75) or per-audience (0.30) cap is tripped —
    // only the cross-cutting pilot-wide cap is being probed here.
    for (let i = 0; i < 3; i += 1) {
      const fillerProcessingId = await seedProcessing(h.client, ctx, `CONC-PILOT-FILL-${i}-${randomUUID()}`);
      for (const audienceScope of ['a', 'b']) {
        const entry = await reserveAiBudget(h.client, {
          processingId: fillerProcessingId,
          audienceScope,
          estimatedCostUsd: 0.3,
          provider: 'openrouter',
          model: 'anthropic/claude-sonnet-4.5',
        });
        await commitAiBudgetEntry(h.client, entry.id, { actualCostUsd: 0.3 });
      }
    }
    // Pilot-wide spend is now 1.80; headroom to the 2.00 cap is exactly 0.20.

    const processingA = await seedProcessing(h.client, ctx, `CONC-PILOT-A-${randomUUID()}`);
    const processingB = await seedProcessing(h.client, ctx, `CONC-PILOT-B-${randomUUID()}`);
    // Each request alone (0.15) fits the 0.20 headroom; both together (0.30) do not.
    // A read-then-insert race would let both pass their own (stale) check.
    const results = await Promise.allSettled([
      reserveAiBudget(h.client, { processingId: processingA, audienceScope: 'a', estimatedCostUsd: 0.15, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' }),
      reserveAiBudget(h.client, { processingId: processingB, audienceScope: 'a', estimatedCostUsd: 0.15, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' });

    const finalSnapshot = await readAiBudgetSnapshot(h.client, { processingId: processingA });
    expect(finalSnapshot.pilotTotalUsd).toBeLessThanOrEqual(PILOT_TOTAL_CAP_USD);
  });

  test('two concurrent reservations near the PER-BILAN cap, on two different audiences of the SAME bilan: exactly one succeeds', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `CONC-BILAN-${randomUUID()}`);
    for (const audienceScope of ['a', 'b']) {
      const entry = await reserveAiBudget(h.client, { processingId, audienceScope, estimatedCostUsd: 0.3, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' });
      await commitAiBudgetEntry(h.client, entry.id, { actualCostUsd: 0.3 });
    }
    // Per-bilan spend is now 0.60; headroom to the 0.75 cap is 0.15.
    const results = await Promise.allSettled([
      reserveAiBudget(h.client, { processingId, audienceScope: 'c', estimatedCostUsd: 0.1, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' }),
      reserveAiBudget(h.client, { processingId, audienceScope: 'd', estimatedCostUsd: 0.1, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const finalSnapshot = await readAiBudgetSnapshot(h.client, { processingId });
    expect(finalSnapshot.perBilanUsd).toBeLessThanOrEqual(PER_BILAN_CAP_USD);
  });

  test('two concurrent reservations near the PER-AUDIENCE cap, same (processingId, audienceScope): exactly one succeeds', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `CONC-AUD-${randomUUID()}`);
    const first = await reserveAiBudget(h.client, { processingId, audienceScope: 'x', estimatedCostUsd: 0.2, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' });
    await commitAiBudgetEntry(h.client, first.id, { actualCostUsd: 0.2 }); // headroom to 0.30 is 0.10

    const results = await Promise.allSettled([
      reserveAiBudget(h.client, { processingId, audienceScope: 'x', estimatedCostUsd: 0.08, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' }),
      reserveAiBudget(h.client, { processingId, audienceScope: 'x', estimatedCostUsd: 0.08, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const finalSnapshot = await readAiBudgetSnapshot(h.client, { processingId, audienceScope: 'x' });
    expect(finalSnapshot.perAudienceUsd).toBeLessThanOrEqual(PER_AUDIENCE_CAP_USD);
  });

  test('two concurrent reservations for the 3rd attempt of the same unit: exactly one succeeds, the attempt cap is never exceeded', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `CONC-ATTEMPTS-${randomUUID()}`);
    for (let i = 0; i < MAX_ATTEMPTS_PER_UNIT - 1; i += 1) {
      await reserveAiBudget(h.client, { processingId, audienceScope: 'y', estimatedCostUsd: 0.01, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' });
    }
    const results = await Promise.allSettled([
      reserveAiBudget(h.client, { processingId, audienceScope: 'y', estimatedCostUsd: 0.01, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' }),
      reserveAiBudget(h.client, { processingId, audienceScope: 'y', estimatedCostUsd: 0.01, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const finalSnapshot = await readAiBudgetSnapshot(h.client, { processingId, audienceScope: 'y' });
    expect(finalSnapshot.attemptsForUnit).toBe(MAX_ATTEMPTS_PER_UNIT);
  });
});

describe('release/reconciliation — idempotent, never double-counted', () => {
  test('releasing the same entry twice is idempotent and never frees headroom twice', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `RECON-${randomUUID()}`);
    const entry = await reserveAiBudget(h.client, { processingId, audienceScope: 'z', estimatedCostUsd: 0.2, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' });

    await releaseAiBudgetEntry(h.client, entry.id);
    await releaseAiBudgetEntry(h.client, entry.id); // repeated reconciliation — must not error, must not double-free anything

    const snapshot = await readAiBudgetSnapshot(h.client, { processingId, audienceScope: 'z' });
    expect(snapshot.perAudienceUsd).toBeCloseTo(0, 6);
  });

  test('a late reconciliation attempt can never un-commit a real, already-billed spend', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `RECON-COMMITTED-${randomUUID()}`);
    const entry = await reserveAiBudget(h.client, { processingId, audienceScope: 'z', estimatedCostUsd: 0.2, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' });
    await commitAiBudgetEntry(h.client, entry.id, { actualCostUsd: 0.05, providerRequestId: 'gen-real' });

    // A stray/duplicate release call arriving after the real cost is already
    // known must never erase that fact from the ledger.
    await releaseAiBudgetEntry(h.client, entry.id);
    const row = await h.client.diagnosticAiBudgetLedger.findUniqueOrThrow({ where: { id: entry.id } });
    expect(row.status).toBe('COMMITTED');
    expect(Number(row.actualCostUsd)).toBe(0.05);
  });

  test('a repeated commit call for the same entry is idempotent and never overwrites the real cost with a second value', async () => {
    const ctx = h.ctx();
    const processingId = await seedProcessing(h.client, ctx, `RECON-DOUBLECOMMIT-${randomUUID()}`);
    const entry = await reserveAiBudget(h.client, { processingId, audienceScope: 'z', estimatedCostUsd: 0.2, provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' });

    await commitAiBudgetEntry(h.client, entry.id, { actualCostUsd: 0.05, providerRequestId: 'gen-real' });
    await commitAiBudgetEntry(h.client, entry.id, { actualCostUsd: 0.19, providerRequestId: 'gen-different' }); // a late/duplicate call reporting a different cost

    const row = await h.client.diagnosticAiBudgetLedger.findUniqueOrThrow({ where: { id: entry.id } });
    expect(Number(row.actualCostUsd)).toBe(0.05); // the FIRST real commit wins, never silently overwritten
    expect(row.providerRequestId).toBe('gen-real');
  });
});
