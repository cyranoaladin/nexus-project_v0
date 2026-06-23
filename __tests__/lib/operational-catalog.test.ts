import {
  getAriaAddonCatalog,
  getAriaAddonCatalogItem,
  getCreditCost,
  getCreditCostCatalog,
  getSpecialPackCatalog,
  getSpecialPackCatalogItem,
  getOperationalSubscriptionPlan,
  getOperationalSubscriptionPlans,
} from '@/lib/operational-catalog';
import { getFullPricingData } from '@/lib/pricing';

describe('operational catalog', () => {
  it('loads operational subscription plans from canonical pricing data', () => {
    const pricing = getFullPricingData();

    expect(getOperationalSubscriptionPlans()).toEqual(pricing.operational_subscription_plans);
    expect(getOperationalSubscriptionPlan('HYBRIDE')).toEqual(
      expect.objectContaining({
        name: 'HYBRIDE',
        price: 450,
        credits: 4,
      })
    );
    expect(getOperationalSubscriptionPlan('IMMERSION')).toEqual(
      expect.objectContaining({
        name: 'IMMERSION',
        price: 750,
        credits: 8,
      })
    );
    expect(getOperationalSubscriptionPlan('Plan A')).toBeNull();
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

  it('loads operational special packs from canonical pricing data', () => {
    const pricing = getFullPricingData();

    expect(getSpecialPackCatalog()).toEqual(pricing.operational_special_packs);
    expect(getSpecialPackCatalogItem('GRAND_ORAL')).toEqual(
      expect.objectContaining({
        name: 'Pack Grand Oral',
        price: 750,
      })
    );
    expect(getSpecialPackCatalogItem('BAC_FRANCAIS')).toEqual(
      expect.objectContaining({
        name: 'Pack Bac de Français',
        price: 1200,
      })
    );
    expect(getSpecialPackCatalogItem('PACK_FAKE')).toBeNull();
  });

  it('loads operational credit costs from canonical pricing data', () => {
    const pricing = getFullPricingData();

    expect(getCreditCostCatalog()).toEqual(pricing.operational_credit_costs);
    expect(getCreditCost('COURS_ONLINE')).toBe(1);
    expect(getCreditCost('COURS_PRESENTIEL')).toBe(1.25);
    expect(getCreditCost('ATELIER_GROUPE')).toBe(1.5);
    expect(getCreditCost('COURS_FAKE')).toBeNull();
  });
});
