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
 * The subject is a REAL, readable PDF (title, disclaimer banner,
 * instructions, three identified items, response zones) rendered through
 * this codebase's existing HTML→PDF pipeline (lib/bilans/render/pdf.ts) —
 * not a byte-empty placeholder. Its fingerprint (subjectSha256) is stored
 * on the catalog row and frozen onto every attribution
 * (subjectSha256Snapshot) so a later, silent replacement of the file is
 * detectable and refused at serve time (mission §5).
 *
 * Idempotency (mission §5): re-running this script with the SAME content
 * is a no-op. If a row for this exact (instrumentKey, version) already
 * exists with a DIFFERENT subject fingerprint, the script refuses rather
 * than silently overwriting it — bump DEMO_INSTRUMENT_VERSION instead to
 * publish a new version.
 *
 * Refuses to run outside a disposable stack, same guard as
 * seed-e2e-staff-actors.ts.
 */
import { createHash } from 'node:crypto';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import { normalizePdfForComparison, renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import { publishCatalogFixture } from '@/lib/core-v2/diagnostics/catalog';
import { diagnosticInstrumentSubjectRelativePath, writeDiagnosticStorageFixture } from '@/lib/core-v2/diagnostics/storage';
import { DEMO_INSTRUMENT_DURATION_MINUTES, DEMO_INSTRUMENT_TITLE, DEMO_SUBJECT_HTML } from '@/lib/core-v2/diagnostics/demo-content';

export const DEMO_INSTRUMENT_KEY = 'DEMO-FIXTURE-01';
export const DEMO_INSTRUMENT_VERSION = '2.0.0';

async function main(): Promise<void> {
  if (process.env.E2E_DISPOSABLE_STACK !== '1' && process.env.NEXUS_DISPOSABLE_POSTGRES !== '1') {
    throw new Error('SEED_DIAGNOSTIC_CATALOG_DEMO_REFUSED: only for a disposable stack (E2E_DISPOSABLE_STACK=1).');
  }
  const client = await requireCoreV2Client();

  // Chromium's PDF export embeds a fresh /CreationDate, /ModDate and /ID on
  // every render, even for byte-identical HTML — normalizePdfForComparison
  // (already used elsewhere in this codebase for exactly this reason) zeroes
  // those fields so the SAME content always fingerprints and serves
  // identically across repeated seeds, instead of tripping the "different
  // content at the same version" refusal on every re-run.
  const subjectPdf = normalizePdfForComparison(await renderHtmlToPdf(DEMO_SUBJECT_HTML));
  const subjectSha256 = createHash('sha256').update(subjectPdf).digest('hex');
  const manifestChecksum = createHash('sha256').update(`${DEMO_INSTRUMENT_KEY}@${DEMO_INSTRUMENT_VERSION}`).digest('hex');

  const { instrument, created } = await publishCatalogFixture(client, {
    instrumentKey: DEMO_INSTRUMENT_KEY,
    version: DEMO_INSTRUMENT_VERSION,
    title: DEMO_INSTRUMENT_TITLE,
    subject: 'Démonstration',
    level: 'Toutes',
    targetSession: 'DEMO',
    form: 'FORM_DEMO',
    durationMinutes: DEMO_INSTRUMENT_DURATION_MINUTES,
    modalities: 'Fixture synthétique — démonstration technique, durée indicative non calibrée, jamais un instrument réel.',
    catalogStatus: 'DEMO_FIXTURE',
    manifestChecksum,
    manifestVersion: 'demo/2.0',
    sourceCommit: null,
    subjectSha256,
    baremeReference: null,
    attributionConditions: 'Aucune — démonstration technique uniquement.',
  });

  console.log(
    created
      ? `[seed-diagnostic-catalog-demo] created ${instrument.instrumentKey}@${instrument.version} (id=${instrument.id}).`
      : `[seed-diagnostic-catalog-demo] ${instrument.instrumentKey}@${instrument.version} unchanged (identical content).`,
  );

  // The fixture file itself is always (re)written from the current
  // rendered bytes — safe because publishCatalogFixture already asserted
  // any EXISTING row's stored fingerprint matches these exact bytes (or
  // the row is brand new); this is not the "silent replace" path.
  await writeDiagnosticStorageFixture(diagnosticInstrumentSubjectRelativePath(instrument.id), subjectPdf);

  await disconnectCoreV2Client();
}

main().catch(async (error) => {
  console.error('[seed-diagnostic-catalog-demo] FAILED', error instanceof Error ? error.message : error);
  await disconnectCoreV2Client().catch(() => undefined);
  process.exit(1);
});
