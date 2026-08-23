import 'server-only';

import { getQuoteByPublicToken, transitionQuoteStatus, type QuoteLookupResult } from './persistence.server';
import { canTransition } from './status';
import { serializeError } from '@/lib/utils/serialize-error';

/**
 * Single family-facing quote read path for both the HTML page and JSON API.
 * Recording a first consultation is best-effort: an audit write must never
 * make an otherwise valid family link unavailable.
 */
export async function getQuoteForFamilyView(rawToken: string): Promise<QuoteLookupResult> {
  const result = await getQuoteByPublicToken(rawToken);
  if (!result.quote || !canTransition(result.quote.status, 'DEVIS_CONSULTE')) return result;

  try {
    await transitionQuoteStatus({ quoteId: result.quote.id, toStatus: 'DEVIS_CONSULTE' });
  } catch (error) {
    console.error('[quotes/public-view] auto-consult transition failed', serializeError(error));
  }

  return result;
}
