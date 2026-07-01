export {
  getOverride,
  getOverrideOr,
  getNamespaceEntries,
  getAllEntries,
  loadConfigSnapshot,
  invalidateSnapshot,
  ensureFresh,
  type ConfigEntry,
} from './snapshot';

// _resetForTest and _setForTest are intentionally NOT re-exported here.
// Tests that need them import directly from './snapshot' to make the
// test-only dependency explicit and prevent accidental prod usage.

export {
  validateConfigEntry,
  validateCrossInvariants,
  getCurrentMinPrice,
  getValidNamespaces,
  getNamespaceKeys,
  SCHEMA_VERSION,
  type NamespaceId,
} from './schemas';
