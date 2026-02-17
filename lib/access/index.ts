/**
 * Access Control — Public API.
 *
 * Re-exports feature catalog, rules, and guards:
 *   import { requireFeature, resolveAccess, FEATURES } from '@/lib/access';
 */

export {
  FEATURES,
  isValidFeatureKey,
  getFeatureDefinition,
  getAllFeatureKeys,
} from './features';
export type {
  FeatureKey,
  FallbackMode,
  FeatureDefinition,
} from './features';

export { resolveAccess } from './rules';
export type { AccessRequest, AccessResult } from './rules';

export { requireFeature, requireFeatureApi } from './guard';
export type { GuardOptions, GuardResult } from './guard';
