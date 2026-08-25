/**
 * Lot 5 confinement (docs/candidat-individuel/lot5-catalogue-brainstorming.md
 * Décision 1) — shared, client-safe (no server-only import) so both the PDF
 * adapter and the public devis page render the exact same disclosure text
 * for a legacy-maturity Quote, never two independently-drifting copies.
 */
import type { QuoteRegulatoryMaturity } from '@prisma/client';

export const LEGACY_REGULATORY_DISCLAIMER =
  'Cette estimation est provisoire et ne garantit pas que toutes les épreuves listées restent à ' +
  'présenter. Les notes conservées, les reconductions et les dispenses seront vérifiées par notre ' +
  'équipe pédagogique avant toute émission définitive.';

/** Null when the quote's regulatory basis is already carte-validated — no disclosure needed. */
export function getLegacyRegulatoryDisclaimer(maturity: QuoteRegulatoryMaturity): string | null {
  return maturity === 'LEGACY_ESTIMATE_UNVERIFIED' ? LEGACY_REGULATORY_DISCLAIMER : null;
}
