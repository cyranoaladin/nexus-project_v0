import type { FactSheet } from '../facts/fact-sheet';
import type { BilanPackSubject } from '../catalog/subjects';
import {
  PAPER_ENTRY_DURATION_MEASUREMENT,
  type ReportDurationMeasurement,
} from './passation-presentation';

export const RENDER_IDENTITY_VERSION = 'render-identity.v1' as const;

export type RenderIdentity = Readonly<{
  displayName: string;
  level: FactSheet['student']['level'];
  subject: BilanPackSubject;
  date: string;
  stageLabel: string;
  durationMeasurement?: ReportDurationMeasurement;
}>;

/**
 * Mirrors the alias format enforced upstream by `buildFactSheet`. Kept
 * deliberately identical: a laxer render boundary would leave a gap between the
 * fact sheet and the rows that are written append-only.
 */
const PSEUDONYMOUS_DISPLAY_NAME = /^ELEVE_[A-Z]+$/;

export function assertRenderIdentity(identity: RenderIdentity): RenderIdentity {
  if (
    identity.durationMeasurement !== undefined
    && identity.durationMeasurement !== PAPER_ENTRY_DURATION_MEASUREMENT
  ) {
    throw new Error('RENDER_IDENTITY_INVALID:durationMeasurement');
  }
  for (const [field, value] of Object.entries(identity)) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`RENDER_IDENTITY_INVALID:${field}`);
    }
  }
  return Object.freeze({ ...identity });
}

/**
 * Same checks, plus the guarantee that `displayName` carries the `ELEVE_XXXX`
 * pseudonym rather than a real identity.
 *
 * Use this — never the plain `assertRenderIdentity` — for the immutable snapshot,
 * `canonical_report_revisions.content` and every deterministic report-engine
 * input. A separate presentation identity may be projected into the HTML/PDF
 * header after the engine has produced its content; it must never flow back into
 * this canonical object.
 *
 * The coach group plan deliberately does NOT use this: it is rendered on demand,
 * never persisted to the canonical tables, and is an internal document whose
 * whole purpose is to name the students of a group.
 */
export function assertPseudonymousRenderIdentity(identity: RenderIdentity): RenderIdentity {
  const asserted = assertRenderIdentity(identity);
  if (!PSEUDONYMOUS_DISPLAY_NAME.test(asserted.displayName)) {
    throw new Error('RENDER_IDENTITY_NOT_PSEUDONYMOUS:displayName');
  }
  return asserted;
}
