import type { CanonicalAttemptProvenance } from '@prisma/client';

import type { FactSheet } from '../facts/fact-sheet';

export const PAPER_ENTRY_DURATION_MEASUREMENT = 'NOT_MEASURED_PAPER_ENTRY' as const;
export const PAPER_ENTRY_DURATION_NOTICE = 'Durée non mesurée — saisie papier.' as const;

export type ReportDurationMeasurement = typeof PAPER_ENTRY_DURATION_MEASUREMENT;

export type ReportPassationPresentation = Readonly<{
  factSheet: FactSheet;
  durationMeasurement?: ReportDurationMeasurement;
}>;

/**
 * Removes the misleading duration flag from a report view, never from the
 * append-only scoring snapshot. The marker is persisted with the report
 * identity so later HTML/PDF materialization can rebuild the same view.
 */
export function applyReportPassationPresentation(
  factSheet: FactSheet,
  durationMeasurement?: ReportDurationMeasurement,
): FactSheet {
  if (durationMeasurement !== PAPER_ENTRY_DURATION_MEASUREMENT) return factSheet;
  return Object.freeze({
    ...factSheet,
    flags: Object.freeze(factSheet.flags.filter((flag) => flag !== 'PASSATION_EXPRESS')),
  });
}

/**
 * Presentation-only decision. Provenance deliberately stays out of the facts
 * engine: an online attempt retains every computed flag, while a paper entry
 * gets a duration-not-measured marker and a projected report fact sheet.
 */
export function prepareReportPassationPresentation(
  factSheet: FactSheet,
  provenance: CanonicalAttemptProvenance,
): ReportPassationPresentation {
  if (provenance !== 'SAISIE_PAPIER') return Object.freeze({ factSheet });
  return Object.freeze({
    factSheet: applyReportPassationPresentation(factSheet, PAPER_ENTRY_DURATION_MEASUREMENT),
    durationMeasurement: PAPER_ENTRY_DURATION_MEASUREMENT,
  });
}
