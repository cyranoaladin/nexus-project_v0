import 'server-only';

import { getQuoteByPublicToken, markQuoteConsultedIfSent, type QuoteLookupResult } from './persistence.server';
import { serializeError } from '@/lib/utils/serialize-error';

/**
 * Single family-facing quote read path for both the HTML page and JSON API.
 * Recording a first consultation is best-effort: an audit write must never
 * make an otherwise valid family link unavailable.
 */
export async function getQuoteForFamilyView(rawToken: string): Promise<QuoteLookupResult> {
  const result = await getQuoteByPublicToken(rawToken);
  if (!result.quote || result.quote.status !== 'DEVIS_ENVOYE') return result;

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
