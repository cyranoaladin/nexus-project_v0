import 'server-only';

import { NextResponse } from 'next/server';

/**
 * Global kill switch for the whole candidate-libre diagnostic feature.
 *
 * Independent of the per-user entitlement system in lib/access/ — that
 * system grants features to paying accounts, this is a repo-wide dark
 * switch. OFF means dark for every role, including staff and ADMIN, with
 * no exemption, until a real dossier is explicitly activated (Phase P).
 * Defaults to disabled: an unset or misconfigured env var must never
 * accidentally turn the feature on.
 */
export function isCandidateDiagnosticFeatureEnabled(): boolean {
  return process.env.CANDIDATE_DIAGNOSTIC_ENABLED === 'true';
}

/** For API routes: returns a 404 (not 403 — the route must look absent) when the flag is off, else null. */
export function guardCandidateDiagnosticFeature(): NextResponse | null {
  if (isCandidateDiagnosticFeatureEnabled()) return null;
  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}
