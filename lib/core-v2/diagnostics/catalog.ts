import type { CatalogStatus } from '@/core-v2/generated/client';
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
