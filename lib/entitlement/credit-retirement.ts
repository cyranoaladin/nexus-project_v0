import { getProductDefinition, isValidProductCode } from './types';

/** Historical purchases require a staff decision, never silent paid-without-service
 * settlement. No credit grant, replacement entitlement or refund is inferred. */
export class LegacyCreditPurchaseError extends Error {
  readonly code = 'LEGACY_CREDIT_PURCHASE_REQUIRES_REVIEW';
  constructor() {
    super('Cet achat historique contient des crédits retirés. L’assistante doit traiter sa régularisation avant de confirmer le paiement.');
  }
}

export function assertNoRetiredCreditProducts(items: readonly { productCode?: string | null }[]): void {
  if (items.some(({ productCode }) => productCode && (
    /^CREDIT_PACK_/i.test(productCode)
    || (isValidProductCode(productCode) && getProductDefinition(productCode)?.category === 'credits')
  ))) throw new LegacyCreditPurchaseError();
}
