import type { CatalogStatus, DiagnosticInstrumentRef, PrismaClient } from '@/core-v2/generated/client';
import { InvalidStateError } from '../errors';

/**
 * A row's presence in DiagnosticInstrumentRef is a technical mirror of the
 * private catalog, never itself an authorization. Only these two statuses
 * may ever be attributed to a candidate: AUTHORIZED (a real, pedagogically
 * cleared instrument) and DEMO_FIXTURE (an entirely fictional row used only
 * to validate this software, never derived from real bank content — see
 * scripts/core-v2/seed-diagnostic-catalog-demo.ts). IN_REVIEW, UNAVAILABLE,
 * ARCHIVED and COMPROMISED are visible to staff (so the operator understands
 * why an instrument is not selectable) but never attributable.
 */
const ATTRIBUTABLE_STATUSES: ReadonlySet<CatalogStatus> = new Set(['AUTHORIZED', 'DEMO_FIXTURE']);

export function isAttributableCatalogStatus(status: CatalogStatus): boolean {
  return ATTRIBUTABLE_STATUSES.has(status);
}

export function assertAttributable(instrument: { readonly id: string; readonly catalogStatus: CatalogStatus }): void {
  if (!isAttributableCatalogStatus(instrument.catalogStatus)) {
    throw new InvalidStateError(
      `Instrument is not attributable in its current catalog status (${instrument.catalogStatus}).`,
      { instrumentRefId: instrument.id, catalogStatus: instrument.catalogStatus },
    );
  }
}

export interface CatalogFixtureContent {
  readonly instrumentKey: string;
  readonly version: string;
  readonly title: string;
  readonly subject: string;
  readonly level: string;
  readonly targetSession: string;
  readonly form: string;
  readonly durationMinutes: number;
  readonly modalities: string;
  readonly catalogStatus: CatalogStatus;
  readonly manifestChecksum: string;
  readonly manifestVersion: string;
  readonly sourceCommit?: string | null;
  readonly subjectSha256: string;
  readonly baremeReference?: string | null;
  readonly attributionConditions?: string | null;
}

/**
 * Publishes a fixture/catalog-mirror row without ever silently replacing
 * an existing version's content (mission §5): re-publishing the exact same
 * `subjectSha256` for an existing (instrumentKey, version) is a no-op;
 * publishing DIFFERENT content under a version already on record is
 * refused outright — bump the version to publish new content instead.
 */
export async function publishCatalogFixture(
  client: PrismaClient,
  content: CatalogFixtureContent,
): Promise<{ instrument: DiagnosticInstrumentRef; created: boolean }> {
  const existing = await client.diagnosticInstrumentRef.findUnique({
    where: { instrumentKey_version: { instrumentKey: content.instrumentKey, version: content.version } },
  });

  if (existing) {
    if (existing.subjectSha256 !== content.subjectSha256) {
      throw new InvalidStateError(
        `${content.instrumentKey}@${content.version} already exists with a different subject fingerprint — ` +
          'a version already in use is never silently replaced; publish new content under a new version.',
        {
          instrumentKey: content.instrumentKey,
          version: content.version,
          existingSubjectSha256Prefix: existing.subjectSha256.slice(0, 12),
          newSubjectSha256Prefix: content.subjectSha256.slice(0, 12),
        },
      );
    }
    return { instrument: existing, created: false };
  }

  const instrument = await client.diagnosticInstrumentRef.create({ data: { ...content } });
  return { instrument, created: true };
}
