/**
 * Operational catalog — client-safe accessors for subscription plans,
 * ARIA addons, special packs, and credit costs.
 *
 * Reads from the generated client JSON (not the full canonical),
 * so it can be safely imported in 'use client' components.
 */
import clientData from '@/data/pricing-client-data.generated.json';

export interface OperationalSubscriptionPlan {
  name: string;
  price: number;
  credits: number;
  popular?: boolean;
  features: string[];
}

export interface OperationalAriaAddon {
  name: string;
  price: number;
  description: string;
  features: string[];
}

export interface OperationalSpecialPack {
  name: string;
  price: number;
  description: string;
  features: string[];
}

export type SubscriptionPlanKey = 'ACCES_PLATEFORME' | 'HYBRIDE' | 'IMMERSION';
export type AriaAddonKey = 'MATIERE_SUPPLEMENTAIRE' | 'ANALYSE_APPROFONDIE';
export type SpecialPackKey = 'GRAND_ORAL' | 'BAC_FRANCAIS' | 'ORIENTATION';
export type CreditCostKey = 'COURS_ONLINE' | 'COURS_PRESENTIEL' | 'ATELIER_GROUPE';

export type AriaAddonCatalogItem = OperationalAriaAddon;
export type SpecialPackCatalogItem = OperationalSpecialPack;

const opPlans = clientData.operational_subscription_plans as unknown as Record<string, OperationalSubscriptionPlan>;
const opAddons = clientData.operational_aria_addons as unknown as Record<string, OperationalAriaAddon>;
const opPacks = clientData.operational_special_packs as unknown as Record<string, OperationalSpecialPack>;
const opCosts = clientData.operational_credit_costs as unknown as Record<string, number>;

export function getOperationalSubscriptionPlans(): Record<SubscriptionPlanKey, OperationalSubscriptionPlan> {
  return opPlans as Record<SubscriptionPlanKey, OperationalSubscriptionPlan>;
}

export function getOperationalSubscriptionPlan(planName: string | null | undefined): OperationalSubscriptionPlan | null {
  if (!planName) return null;
  return opPlans[planName] ?? null;
}

export function getAriaAddonCatalog(): Record<AriaAddonKey, AriaAddonCatalogItem> {
  return opAddons as Record<AriaAddonKey, AriaAddonCatalogItem>;
}

export function getAriaAddonCatalogItem(addonName: string | null | undefined): AriaAddonCatalogItem | null {
  if (!addonName) return null;
  return opAddons[addonName] ?? null;
}

export function getSpecialPackCatalog(): Record<SpecialPackKey, SpecialPackCatalogItem> {
  return opPacks as Record<SpecialPackKey, SpecialPackCatalogItem>;
}

export function getSpecialPackCatalogItem(packName: string | null | undefined): SpecialPackCatalogItem | null {
  if (!packName) return null;
  return opPacks[packName] ?? null;
}

export function getCreditCostCatalog(): Record<CreditCostKey, number> {
  return opCosts as Record<CreditCostKey, number>;
}

export function getCreditCost(serviceType: string | null | undefined): number | null {
  if (!serviceType) return null;
  return opCosts[serviceType] ?? null;
}
