/**
 * FAMILY_VISIBILITY_INVARIANTS — the single canonical gate for every
 * family-facing read of a candidat-individuel quote (mission P0-B,
 * docs/candidat-individuel — "un devis publié peut potentiellement rester
 * lisible si son Responsable/Élève est ensuite détaché").
 *
 * collectQuoteEmissionBlockers (lib/quotes/emission-guard.ts) already
 * proves a quote is a real, staff-validated, definitive devis. It never
 * checks identity though — contactLeadId/studentId can be silently nulled
 * (Prisma onDelete: SetNull, prisma/schema.prisma Quote.contactLead/
 * Quote.student) if the Responsable/Élève row is later deleted, and a
 * ProfilCandidat can be re-pointed at a different lead/student after a
 * Quote already snapshotted the old one. This module composes the
 * existing emission gate (never re-implemented) with those two identity
 * checks, so every read path (HTML page, public JSON, public PDF, staff
 * PDF, accept) enforces the exact same rule — never duplicated per-route.
 *
 * Scoped strictly to profilId != null, same as collectQuoteEmissionBlockers'
 * existing callers: a legacy/public-simulator quote (profilId null, no
 * studentId ever set) keeps its exact prior behavior untouched.
 */
import 'server-only';
import type { Quote } from '@prisma/client';
import { collectQuoteEmissionBlockers } from './emission-guard';
import type { QuoteProfilIdentity } from './persistence.server';

export type QuoteWithProfilIdentity = Quote & { profil: QuoteProfilIdentity | null };

/** Never throws — collects every reason, for logging/audit. Empty array = family-visible. */
export function collectFamilyVisibilityBlockers(quote: QuoteWithProfilIdentity): string[] {
  if (quote.profilId == null) return [];

  const reasons = collectQuoteEmissionBlockers(quote);

  if (!quote.contactLeadId) reasons.push('contactLeadId missing (Responsable detached)');
  if (!quote.studentId) reasons.push('studentId missing (Élève detached)');

  if (quote.profil) {
    if (quote.contactLeadId !== quote.profil.contactLeadId) {
      reasons.push('contactLeadId diverges from profil.contactLeadId');
    }
    if (quote.studentId !== quote.profil.studentId) {
      reasons.push('studentId diverges from profil.studentId');
    }
  }

  return reasons;
}
