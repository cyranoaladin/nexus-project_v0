import {
  getAriaAddonCatalog,
  getAriaAddonCatalogItem,
  getSubscriptionCatalogPlan,
  getSubscriptionCatalogPlans,
} from '@/lib/subscription-catalog';
import { getFullPricingData } from '@/lib/pricing';

describe('subscription catalog', () => {
  it('loads operational subscription plans from canonical pricing data', () => {
    const pricing = getFullPricingData();

    expect(getSubscriptionCatalogPlans()).toEqual(pricing.operational_subscription_plans);
    expect(getSubscriptionCatalogPlan('HYBRIDE')).toEqual(
      expect.objectContaining({
        name: 'HYBRIDE',
        price: 450,
        credits: 4,
      })
    );
    expect(getSubscriptionCatalogPlan('IMMERSION')).toEqual(
      expect.objectContaining({
        name: 'IMMERSION',
        price: 750,
        credits: 8,
      })
    );
    expect(getSubscriptionCatalogPlan('Plan A')).toBeNull();
  });

  it('loads operational ARIA add-ons from canonical pricing data', () => {
    const pricing = getFullPricingData();

    expect(getAriaAddonCatalog()).toEqual(pricing.operational_aria_addons);
    expect(getAriaAddonCatalogItem('MATIERE_SUPPLEMENTAIRE')).toEqual(
      expect.objectContaining({
        price: 50,
      })
    );
    expect(getAriaAddonCatalogItem('ANALYSE_APPROFONDIE')).toEqual(
      expect.objectContaining({
        price: 75,
      })
    );
    expect(getAriaAddonCatalogItem('ARIA_FAKE')).toBeNull();
  });
});
