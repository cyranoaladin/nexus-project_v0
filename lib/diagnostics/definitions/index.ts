/**
 * DiagnosticDefinition Registry
 *
 * Central registry of all available diagnostic definitions.
 * Add new definitions here as they are created.
 */

import type { DiagnosticDefinition } from '../types';
import { MATHS_PREMIERE_P2 } from './maths-premiere-p2';

/** All registered diagnostic definitions, keyed by definitionKey */
const DEFINITIONS: Record<string, DiagnosticDefinition> = {
  'maths-premiere-p2': MATHS_PREMIERE_P2,
};

/**
 * Get a diagnostic definition by key.
 * @throws Error if definition not found
 */
export function getDefinition(key: string): DiagnosticDefinition {
  const def = DEFINITIONS[key];
  if (!def) {
    throw new Error(`Unknown diagnostic definition: "${key}". Available: ${Object.keys(DEFINITIONS).join(', ')}`);
  }
  return def;
}

/**
 * Get a diagnostic definition by key, or null if not found.
 */
export function getDefinitionOrNull(key: string): DiagnosticDefinition | null {
  return DEFINITIONS[key] ?? null;
}

/**
 * List all available diagnostic definition keys.
 */
export function listDefinitionKeys(): string[] {
  return Object.keys(DEFINITIONS);
}

/**
 * List all available diagnostic definitions with metadata.
 */
export function listDefinitions(): Array<{ key: string; label: string; track: string; level: string; version: string }> {
  return Object.values(DEFINITIONS).map((d) => ({
    key: d.key,
    label: d.label,
    track: d.track,
    level: d.level,
    version: d.version,
  }));
}

/**
 * Resolve a legacy type string to a definition key.
 * Maps old "PALLIER2_MATHS" / "DIAGNOSTIC_PRE_STAGE_MATHS" to new keys.
 */
export function resolveDefinitionKey(legacyType: string): string {
  const LEGACY_MAP: Record<string, string> = {
    'PALLIER2_MATHS': 'maths-premiere-p2',
    'DIAGNOSTIC_PRE_STAGE_MATHS': 'maths-premiere-p2',
  };
  return LEGACY_MAP[legacyType] ?? legacyType;
}
