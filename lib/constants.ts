/**
 * Business Constants for Nexus Réussite Platform
 *
 * NOTE: Design tokens (colors, typography, spacing) are now centralized in:
 * - lib/theme/tokens.ts - Single source of truth for all design values
 * - tailwind.config.mjs - Tailwind integration
 *
 * This file contains only business logic constants (pricing, features, credits).
 */
import {
  getAriaAddonCatalog,
  getCreditCostCatalog,
  getSpecialPackCatalog,
  getSubscriptionCatalogPlans,
} from "@/lib/subscription-catalog";

// Formules d'abonnement
export const SUBSCRIPTION_PLANS = getSubscriptionCatalogPlans();

// Packs spécifiques
export const SPECIAL_PACKS = getSpecialPackCatalog();

// Add-ons ARIA
export const ARIA_ADDONS = getAriaAddonCatalog();

// Coûts des prestations en crédits
export const CREDIT_COSTS = getCreditCostCatalog();

// Emails techniques
export const SYSTEM_PARENT_EMAIL = "parent-technique@nexusreussite.academy";
