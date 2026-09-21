/**
 * Seeds exactly ONE DiagnosticInstrumentRef row for the candidat-libre
 * diagnostics feature (Jalon C, C1): an entirely fictional DEMO_FIXTURE
 * instrument, invented for this feature's own tests/technical demo, never
 * derived from real bank content. As of 2026-09-21 the private catalog's
 * V3 pilot has zero AUTHORIZED instruments (both pilot instruments remain
 * METHOD_PILOT_SAMPLE — see nexus-diagnostics-private/V3_PILOT_REVIEW.md),
 * so this fixture is what the attribution/deposit flow runs against until
 * a real ingestion (scripts/core-v2/ingest-diagnostic-catalog.ts, not yet
 * written — no real manifest to ingest from yet) has something AUTHORIZED
 * to mirror.
 *
 * Refuses to run outside a disposable stack, same guard as
 * seed-e2e-staff-actors.ts.
 */
import { createHash } from 'node:crypto';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import { diagnosticInstrumentSubjectRelativePath, writeDiagnosticStorageFixture } from '@/lib/core-v2/diagnostics/storage';

export const DEMO_INSTRUMENT_KEY = 'DEMO-FIXTURE-01';
export const DEMO_INSTRUMENT_VERSION = '1.0.0';

const DEMO_SUBJECT_PDF = Buffer.from(
  [
    '%PDF-1.0',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj',
    'trailer<</Root 1 0 R>>',
    '%%EOF',
    '',
  ].join('\n'),
  'utf8',
);

async function main(): Promise<void> {
  if (process.env.E2E_DISPOSABLE_STACK !== '1' && process.env.NEXUS_DISPOSABLE_POSTGRES !== '1') {
    throw new Error('SEED_DIAGNOSTIC_CATALOG_DEMO_REFUSED: only for a disposable stack (E2E_DISPOSABLE_STACK=1).');
  }
  const client = await requireCoreV2Client();

  const manifestChecksum = createHash('sha256').update(`${DEMO_INSTRUMENT_KEY}@${DEMO_INSTRUMENT_VERSION}`).digest('hex');

  const instrument = await client.diagnosticInstrumentRef.upsert({
    where: { instrumentKey_version: { instrumentKey: DEMO_INSTRUMENT_KEY, version: DEMO_INSTRUMENT_VERSION } },
    create: {
      instrumentKey: DEMO_INSTRUMENT_KEY,
      version: DEMO_INSTRUMENT_VERSION,
      title: 'Diagnostic — démonstration technique (fixture)',
      subject: 'Démonstration',
      level: 'Toutes',
      targetSession: 'DEMO',
      form: 'FORM_DEMO',
      durationMinutes: 30,
      modalities: 'Fixture synthétique — jamais un instrument réel, jamais utilisable pour une décision pédagogique.',
      catalogStatus: 'DEMO_FIXTURE',
      manifestChecksum,
      manifestVersion: 'demo/1.0',
      sourceCommit: null,
      attributionConditions: 'Aucune — démonstration technique uniquement.',
    },
    update: {
      catalogStatus: 'DEMO_FIXTURE',
      manifestChecksum,
    },
  });

  await writeDiagnosticStorageFixture(diagnosticInstrumentSubjectRelativePath(instrument.id), DEMO_SUBJECT_PDF);

  console.log(`[seed-diagnostic-catalog-demo] seeded ${instrument.instrumentKey}@${instrument.version} (id=${instrument.id}).`);
  await disconnectCoreV2Client();
}

main().catch(async (error) => {
  console.error('[seed-diagnostic-catalog-demo] FAILED', error instanceof Error ? error.message : error);
  await disconnectCoreV2Client().catch(() => undefined);
  process.exit(1);
});
