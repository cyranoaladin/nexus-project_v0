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

/** Never throws — collects every reason, for logging/audit. Empty array = emittable. */
export function collectQuoteEmissionBlockers(quote: Quote): string[] {
  const reasons: string[] = [];

  if (quote.regulatoryMaturity !== 'CARTE_VALIDATED_DEFINITIVE') {
    reasons.push('regulatoryMaturity != CARTE_VALIDATED_DEFINITIVE');
  }
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

export function assertQuoteCanBeSent(quote: Quote): void {
  const reasons = collectQuoteEmissionBlockers(quote);
  if (reasons.length > 0) throw new QuoteNotEmittableError(reasons);
}

export function assertQuoteCanBeAccepted(quote: Quote): void {
  const reasons = collectQuoteEmissionBlockers(quote);
  if (reasons.length > 0) throw new QuoteNotEmittableError(reasons);
}
