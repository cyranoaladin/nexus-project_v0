import {
  getFullPricingData,
  type OperationalAriaAddon,
  type OperationalSubscriptionPlan,
} from '@/lib/pricing';

export type SubscriptionPlanKey = 'ACCES_PLATEFORME' | 'HYBRIDE' | 'IMMERSION';
export type AriaAddonKey = 'MATIERE_SUPPLEMENTAIRE' | 'ANALYSE_APPROFONDIE';

export type SubscriptionCatalogPlan = OperationalSubscriptionPlan;
export type AriaAddonCatalogItem = OperationalAriaAddon;

export function getSubscriptionCatalogPlans(): Record<SubscriptionPlanKey, SubscriptionCatalogPlan> {
  return getFullPricingData().operational_subscription_plans as Record<SubscriptionPlanKey, SubscriptionCatalogPlan>;
}

export function getSubscriptionCatalogPlan(planName: string | null | undefined): SubscriptionCatalogPlan | null {
  if (!planName) return null;
  return getSubscriptionCatalogPlans()[planName as SubscriptionPlanKey] ?? null;
}

export function getAriaAddonCatalog(): Record<AriaAddonKey, AriaAddonCatalogItem> {
  return getFullPricingData().operational_aria_addons as Record<AriaAddonKey, AriaAddonCatalogItem>;
}

export function getAriaAddonCatalogItem(addonName: string | null | undefined): AriaAddonCatalogItem | null {
  if (!addonName) return null;
  return getAriaAddonCatalog()[addonName as AriaAddonKey] ?? null;
}
