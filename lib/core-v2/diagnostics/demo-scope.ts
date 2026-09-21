/**
 * DEMO_FIXTURE containment (mission §3). A DEMO_FIXTURE row existing in
 * DiagnosticInstrumentRef is a technical fact, never itself an
 * authorization — the fixture must stay attributable only inside an
 * environment explicitly configured for demonstration, and only to a
 * student explicitly listed there as a synthetic demo candidate.
 *
 * Deliberately NOT derived from NODE_ENV: an optimized production BUILD
 * (the preview runs one) is not the same thing as the real business
 * environment. Deliberately NOT derived from an email domain or a name
 * prefix — those are guessable/spoofable and not a structural signal. The
 * only structural signal is this explicit, environment-level allowlist,
 * mirroring the existing candidat-libre (Core v1) feature's own
 * `CANDIDATE_DIAGNOSTIC_STUDENT_IDS` hard-allowlist pattern
 * (lib/diagnostics/candidat-libre/feature-flag.ts).
 */
import { InvalidStateError } from '../errors';

export function isDiagnosticDemoModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.DIAGNOSTIC_DEMO_MODE?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

export function diagnosticDemoStudentIds(env: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  const raw = env.DIAGNOSTIC_DEMO_STUDENT_IDS ?? '';
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

/**
 * Called from inside the service (never only from the UI): even an ADMIN
 * calling the API directly is refused if the environment is not explicitly
 * configured for demonstration, or if the target student is not on the
 * explicit allowlist — the fixture's presence in the database is never by
 * itself sufficient.
 */
export function assertDemoFixtureAttributable(studentId: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!isDiagnosticDemoModeEnabled(env)) {
    throw new InvalidStateError(
      'DEMO_FIXTURE instruments are not attributable: this environment is not configured for demonstration.',
      { studentId },
    );
  }
  if (!diagnosticDemoStudentIds(env).has(studentId)) {
    throw new InvalidStateError(
      'DEMO_FIXTURE instruments are only attributable to a student explicitly listed as a synthetic demo candidate.',
      { studentId },
    );
  }
}
