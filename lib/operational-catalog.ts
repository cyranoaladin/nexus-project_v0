import {
  getFullPricingData,
  type OperationalAriaAddon,
  type OperationalSpecialPack,
  type OperationalSubscriptionPlan as PricingOperationalSubscriptionPlan,
} from '@/lib/pricing';

export type SubscriptionPlanKey = 'ACCES_PLATEFORME' | 'HYBRIDE' | 'IMMERSION';
export type AriaAddonKey = 'MATIERE_SUPPLEMENTAIRE' | 'ANALYSE_APPROFONDIE';
export type SpecialPackKey = 'GRAND_ORAL' | 'BAC_FRANCAIS' | 'ORIENTATION';
export type CreditCostKey = 'COURS_ONLINE' | 'COURS_PRESENTIEL' | 'ATELIER_GROUPE';

export type OperationalSubscriptionPlan = PricingOperationalSubscriptionPlan;
export type AriaAddonCatalogItem = OperationalAriaAddon;
export type SpecialPackCatalogItem = OperationalSpecialPack;

export function getOperationalSubscriptionPlans(): Record<SubscriptionPlanKey, OperationalSubscriptionPlan> {
  return getFullPricingData().operational_subscription_plans as Record<SubscriptionPlanKey, OperationalSubscriptionPlan>;
}

export function getOperationalSubscriptionPlan(planName: string | null | undefined): OperationalSubscriptionPlan | null {
  if (!planName) return null;
  return getOperationalSubscriptionPlans()[planName as SubscriptionPlanKey] ?? null;
}

export function getAriaAddonCatalog(): Record<AriaAddonKey, AriaAddonCatalogItem> {
  return getFullPricingData().operational_aria_addons as Record<AriaAddonKey, AriaAddonCatalogItem>;
}

export function getAriaAddonCatalogItem(addonName: string | null | undefined): AriaAddonCatalogItem | null {
  if (!addonName) return null;
  return getAriaAddonCatalog()[addonName as AriaAddonKey] ?? null;
}

export function getSpecialPackCatalog(): Record<SpecialPackKey, SpecialPackCatalogItem> {
  return getFullPricingData().operational_special_packs as Record<SpecialPackKey, SpecialPackCatalogItem>;
}

export function getSpecialPackCatalogItem(packName: string | null | undefined): SpecialPackCatalogItem | null {
  if (!packName) return null;
  return getSpecialPackCatalog()[packName as SpecialPackKey] ?? null;
}

export function getCreditCostCatalog(): Record<CreditCostKey, number> {
  return getFullPricingData().operational_credit_costs as Record<CreditCostKey, number>;
}

export function getCreditCost(serviceType: string | null | undefined): number | null {
  if (!serviceType) return null;
  return getCreditCostCatalog()[serviceType as CreditCostKey] ?? null;
}
