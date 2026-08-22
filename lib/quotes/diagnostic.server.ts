/**
 * Server-only adapter fetching a real CandidateDiagnostic's raw domain
 * scores. Reuses lib/diagnostics/candidat-libre/access.server.ts for
 * ownership — the quote domain never re-implements "who can see this
 * diagnostic" (CDC §41). Returns raw scores only; projecting them onto a
 * candidate's specific subjects (which needs the situation) stays in the
 * pure lib/quotes/diagnostic.ts, so this adapter doesn't duplicate that
 * step or need to know the situation itself.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import type { AuthSession } from '@/lib/guards';
import { isErrorResponse } from '@/lib/guards';
import { getDiagnosticForActor } from '@/lib/diagnostics/candidat-libre/access.server';
import type { DiagnosticAutoScore } from '@/lib/diagnostics/candidat-libre/types';
import type { RawDomainScores } from './diagnostic';

export interface LoadedDiagnostic {
  diagnosticId: string;
  raw: RawDomainScores;
  overconfidentDomainKeys: Set<string>;
}

export async function loadRawDomainScores(
  session: AuthSession,
  diagnosticId: string,
): Promise<LoadedDiagnostic | NextResponse> {
  const diagnostic = await getDiagnosticForActor(session, diagnosticId);
  if (isErrorResponse(diagnostic)) return diagnostic;

  const raw: RawDomainScores = {};
  const overconfidentDomainKeys = new Set<string>();

  for (const diagnosticModule of diagnostic.modules) {
    const autoScore = diagnosticModule.autoScore as unknown as DiagnosticAutoScore | null;
    if (!autoScore) continue;
    for (const [domain, score] of Object.entries(autoScore.domainScores)) {
      raw[domain] = score;
    }
    if (autoScore.confidenceCalibration.overconfidenceCount > 0) {
      for (const domain of Object.keys(autoScore.domainScores)) overconfidentDomainKeys.add(domain);
    }
  }

  return { diagnosticId, raw, overconfidentDomainKeys };
}
