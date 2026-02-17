/**
 * Entitlement Engine — Public API.
 *
 * Re-exports all entitlement utilities for clean imports:
 *   import { activateEntitlements, hasEntitlement } from '@/lib/entitlement';
 */

export {
  activateEntitlements,
  suspendEntitlements,
  hasEntitlement,
  hasFeature,
  getUserEntitlements,
  getInvoiceEntitlements,
} from './engine';
export type { ActivationResult, SuspensionResult } from './engine';

export {
  PRODUCT_REGISTRY,
  isValidProductCode,
  getProductDefinition,
  computeEndsAt,
} from './types';
export type {
  ProductCode,
  ProductDefinition,
  ActivationMode,
  EntitlementStatusType,
  CreateEntitlementInput,
} from './types';
