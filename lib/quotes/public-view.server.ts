import 'server-only';

import { getQuoteByPublicToken, markQuoteConsultedIfSent, type QuoteLookupResult } from './persistence.server';
import { collectFamilyVisibilityBlockers } from './family-visibility';
import { serializeError } from '@/lib/utils/serialize-error';

/**
 * Single family-facing quote read path for both the HTML page and JSON API.
 * Recording a first consultation is best-effort: an audit write must never
 * make an otherwise valid family link unavailable.
 *
 * Gate added by mission "vers un produit complet" §4/§6, extended by P0-B
 * (FAMILY_VISIBILITY_INVARIANTS): a candidat-individuel-sourced quote
 * (profilId set) must never be viewable through its signed link while it's
 * still an internal brouillon, nor once its Responsable/Élève has been
 * detached or its ProfilCandidat re-pointed at a different identity —
 * collectFamilyVisibilityBlockers (lib/quotes/family-visibility.ts) is the
 * SAME single canonical gate every family-facing read/accept path uses,
 * never a second check duplicating its logic. Scoped strictly to
 * profilId != null: every legacy quote (profilId null) keeps its exact
 * prior behavior — this is additive, not a change to the live legacy
 * family-consultation flow. Returns the generic NOT_FOUND reason (never a
 * distinct "not ready"/"detached" one) so a guessed/leaked token for an
 * unready or detached quote can't be distinguished from an invalid one.
 */
export async function getQuoteForFamilyView(rawToken: string): Promise<QuoteLookupResult> {
  const result = await getQuoteByPublicToken(rawToken);
  if (!result.quote) return result;

  if (collectFamilyVisibilityBlockers(result.quote).length > 0) {
    return { quote: null, reason: 'NOT_FOUND' };
  }

  if (result.quote.status !== 'DEVIS_ENVOYE') return result;

  try {
    const consultedAt = await markQuoteConsultedIfSent(result.quote.id);
    if (consultedAt) {
      return {
        ...result,
        quote: { ...result.quote, status: 'DEVIS_CONSULTE', consultedAt },
      };
    }
  } catch (error) {
    console.error('[quotes/public-view] auto-consult transition failed', serializeError(error));
  }

  return result;
}
