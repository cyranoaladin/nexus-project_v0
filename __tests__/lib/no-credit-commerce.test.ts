import { PRODUCT_REGISTRY, getProductDefinition } from '@/lib/entitlement/types';
import { getOperationalSubscriptionPlans, getCreditCostCatalog } from '@/lib/operational-catalog';
import { createPaymentSchema } from '@/lib/validation/payments';
import { getFeatureDefinition } from '@/lib/access/features';
import { getValidNamespaces, validateConfigEntry } from '@/lib/config/schemas';

describe('Commercial contracts without academic credits', () => {
  it('does not grant credits or credit capabilities for any known product', () => {
    for (const product of Object.values(PRODUCT_REGISTRY)) {
      expect(product.grantsCredits).toBeNull();
      expect(product.features).not.toContain('credits_use');
    }
  });
  it('keeps historical product labels readable without granting a new right', () => {
    expect(getProductDefinition('CREDIT_PACK_5')?.label).toBe('Pack 5 crédits');
    expect(getProductDefinition('CREDIT_PACK_5')?.features).toEqual([]);
  });
  it('does not advertise credit allowances or charge credit costs', () => {
    for (const plan of Object.values(getOperationalSubscriptionPlans())) {
      expect(plan.credits).toBe(0);
      expect(plan.features.join(' ')).not.toMatch(/crédits?/i);
    }
    expect(Object.values(getCreditCostCatalog()).every(value => value === 0)).toBe(true);
  });
  it('rejects creation of new credit-pack payments while allowing service payments', () => {
    const payment = {userId:'clh1234567890abcdefghijklm', method:'cash', amount:100, currency:'TND'};
    expect(createPaymentSchema.safeParse({...payment,type:'CREDIT_PACK'}).success).toBe(false);
    expect(createPaymentSchema.safeParse({...payment,type:'SUBSCRIPTION'}).success).toBe(true);
  });
  it('does not expose a credit capability or editable credit configuration', () => {
    expect(getFeatureDefinition('credits_use')).toBeNull();
    expect(getValidNamespaces()).not.toContain('products.credits');
    expect(validateConfigEntry('products.credits', 'CREDIT_PACK_5', 5).valid).toBe(false);
  });
});
