/**
 * Single canonical server-side gate for definitive Quote emission (Lot 5
 * correctif de sécurité §1, docs/candidat-individuel/lot5-catalogue-
 * brainstorming.md). Called exclusively from
 * lib/quotes/persistence.server.ts::transitionQuoteStatus — the one choke
 * point every current and future caller (send route, accept route, staff
 * workspace, internal automation) already goes through. Never duplicated
 * per-route: duplicating this check would let a new entry point forget it.
 *
 * NOTE: the mission's invariant also names `validation.
 * emissionAutomatiqueAutorisee` (ProfileValidationResult). No dedicated
 * snapshot column exists for it yet — no code path today produces a
 * ProfileValidationResult snapshot on Quote. Its absence is treated as
 * blocking (fail-closed): every quote today is rejected by this gate,
 * which is the correct behavior (100% of quotes are still
 * LEGACY_ESTIMATE_UNVERIFIED). When the carte-aware creation path is
 * eventually built, it must add that snapshot column and this gate must be
 * updated to check it explicitly — never silently assumed satisfied.
 *
 * No override parameter exists. A future staff manual-emission-after-
 * review path, if built, must require a structured audit record
 * (validateur, date, motif, éléments vérifiés, justificatifs examinés,
 * version des règles, décision explicite) — never a generic bypass of this
 * function.
 */
import 'server-only';
import type { Quote } from '@prisma/client';

export class QuoteNotEmittableError extends Error {
  constructor(public readonly reasons: string[]) {
    super(`Quote is not eligible for definitive emission: ${reasons.join('; ')}`);
    this.name = 'QuoteNotEmittableError';
  }
}

interface SnapshotCarteShape {
  emissionAutomatiqueAutorisee?: unknown;
  necessiteVerificationHumaine?: unknown;
}

function parseSnapshotCarte(raw: unknown): SnapshotCarteShape | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as SnapshotCarteShape;
}

interface SnapshotReglesShape {
  margin?: { gate?: unknown };
  groupState?: { state?: unknown };
}

function parseSnapshotRegles(raw: unknown): SnapshotReglesShape | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as SnapshotReglesShape;
}

/**
 * Shared by collectQuoteEmissionBlockers (send/accept — requires
 * regulatoryMaturity to ALREADY be CARTE_VALIDATED_DEFINITIVE) and
 * collectQuotePromotionBlockers (T5R — the staff action that SETS
 * regulatoryMaturity to that value in the first place, so it cannot
 * require it as a precondition of itself). Everything else a valid
 * carte-aware Quote must satisfy either way.
 */
function collectCarteValidityBlockers(quote: Quote): string[] {
  const reasons: string[] = [];
  if (!quote.profilId) {
    reasons.push('profilId missing');
  }
  if (!quote.pricingVersion) {
    reasons.push('pricingVersion missing');
  }
  if (!quote.snapshotRegles) {
    reasons.push('snapshotRegles missing');
  }

  const carte = parseSnapshotCarte(quote.snapshotCarte);
  if (!carte) {
    reasons.push('snapshotCarte missing or invalid');
  } else {
    if (carte.emissionAutomatiqueAutorisee !== true) {
      reasons.push('snapshotCarte.emissionAutomatiqueAutorisee != true');
    }
    if (carte.necessiteVerificationHumaine !== false) {
      reasons.push('snapshotCarte.necessiteVerificationHumaine != false');
    }
  }

  return reasons;
}

/** Never throws — collects every reason, for logging/audit. Empty array = emittable. */
export function collectQuoteEmissionBlockers(quote: Quote): string[] {
  const reasons: string[] = [];
  if (quote.regulatoryMaturity !== 'CARTE_VALIDATED_DEFINITIVE') {
    reasons.push('regulatoryMaturity != CARTE_VALIDATED_DEFINITIVE');
  }
  reasons.push(...collectCarteValidityBlockers(quote));
  return reasons;
}

/**
 * T5R — RECETTE_FINDING_3. Gate for the staff promotion action
 * (lib/quotes/persistence.server.ts::promoteQuoteToFamilyVisible) that
 * sets regulatoryMaturity to CARTE_VALIDATED_DEFINITIVE — the ONE place
 * this repo ever does so outside a test's direct DB write. Reuses every
 * carte-validity check collectQuoteEmissionBlockers already enforces
 * (minus regulatoryMaturity itself — that's what this gate authorizes
 * setting), plus the commercial checks the mission requires: margin
 * gate, group headcount state, and a positive commercial total. A
 * quote that satisfies collectCarteValidityBlockers structurally can
 * never have a P3-hard-block or a DEFERRED catalogue element in it
 * (buildCandidateQuoteRecommendation never reaches READY, hence never
 * reaches createQuote, for either case — see docs/candidat-individuel/
 * v1-release-scope.md) — no separate check needed for those.
 */
/**
 * Shared by collectQuotePromotionBlockers and collectFamilyLinkIssuanceBlockers
 * (T5R2) — the commercial-integrity checks the mission requires beyond
 * pure carte validity: margin gate, group headcount state, positive
 * commercial total. Extracted so both gates read one definition, never
 * two independently-drifting lists.
 *
 * T5R5 §FINDING_11 (invariant: family-visible Quote ⇒ student identity
 * present AND responsible/contact identity present) — checked here too,
 * so it covers BOTH the promotion action (sets regulatoryMaturity to
 * CARTE_VALIDATED_DEFINITIVE) and family-link issuance (defense in
 * depth), the two places a Quote actually becomes reachable by a family.
 */
function collectCommercialIntegrityBlockers(quote: Quote): string[] {
  const reasons: string[] = [];

  if (quote.grandTotal <= 0 || quote.monthlyTotal <= 0) {
    reasons.push('total commercial <= 0');
  }

  if (!quote.contactLeadId) {
    reasons.push('contactLeadId missing (Responsable)');
  }
  if (!quote.studentId) {
    reasons.push('studentId missing (Élève)');
  }

  const regles = parseSnapshotRegles(quote.snapshotRegles);
  if (!regles) {
    reasons.push('snapshotRegles missing or invalid');
  } else {
    if (regles.margin?.gate === 'BLOCKED') {
      reasons.push('snapshotRegles.margin.gate == BLOCKED');
    }
    if (regles.groupState?.state === 'GROUP_PENDING') {
      // Defensive only — a GROUP_PENDING scenario is never persisted by
      // the quote-creation route in the first place (returns 422 first).
      reasons.push('snapshotRegles.groupState.state == GROUP_PENDING');
    }
  }

  return reasons;
}

export function collectQuotePromotionBlockers(quote: Quote): string[] {
  const reasons = collectCarteValidityBlockers(quote);
  reasons.push(...collectCommercialIntegrityBlockers(quote));

  return reasons;
}

/**
 * T5R2 — RECETTE_FINDING (FAMILY_LINK_DISTRIBUTION), the gate for
 * lib/quotes/persistence.server.ts::issueOrRotateFamilyLink. A family
 * link may only ever be issued/rotated for a Quote that is ALREADY
 * published (regulatoryMaturity == CARTE_VALIDATED_DEFINITIVE, i.e.
 * already passed collectQuotePromotionBlockers once, at promotion time)
 * — collectQuoteEmissionBlockers already expresses exactly that
 * precondition. The commercial-integrity checks are re-verified here too
 * (defense in depth; nothing mutates a Quote's snapshotRegles/totals
 * after creation, so they cannot have changed since promotion, but this
 * gate never assumes that silently). One composition, no second
 * divergent criteria list.
 */
export function collectFamilyLinkIssuanceBlockers(quote: Quote): string[] {
  const reasons = collectQuoteEmissionBlockers(quote);
  reasons.push(...collectCommercialIntegrityBlockers(quote));
  return reasons;
}

export function assertQuoteCanBeSent(quote: Quote): void {
  const reasons = collectQuoteEmissionBlockers(quote);
  if (reasons.length > 0) throw new QuoteNotEmittableError(reasons);
}

export function assertQuoteCanBeAccepted(quote: Quote): void {
  const reasons = collectQuoteEmissionBlockers(quote);
  if (reasons.length > 0) throw new QuoteNotEmittableError(reasons);
}
