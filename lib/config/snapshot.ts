/**
 * BusinessConfig in-memory snapshot — sync access, TTL-based passive refresh.
 *
 * Design (DOC-4 §2):
 * - Loaded at startup via loadConfigSnapshot()
 * - getOverride(namespace, key) returns the value synchronously or null
 * - TTL 60s: passive refresh coalesced via single-flight
 * - Invalidation on write: API calls applyWrite() with the committed entry
 * - Mono-instance (PM2 fork mode, instances: 1) — no cross-process sync
 *
 * Two load paths:
 * 1. PASSIVE (TTL / startup): _doLoad() via loadConfigSnapshot() — single-flight.
 *    Order guard: swapSequence counter prevents stale overwrite.
 * 2. WRITE (post-API-commit): applyWrite() — applies a single entry directly
 *    into the snapshot, using the DB version as the order authority. No findMany,
 *    no race. version is monotone per key (incremented by Prisma upsert),
 *    so a concurrent apply with a lower version is discarded.
 *
 * This eliminates the concurrent-invalidation ordering problem: the DB
 * version IS the order, not an in-memory counter.
 */
import { prisma } from '@/lib/prisma';
import { validateConfigEntry } from './schemas';

// ── Types ──

export interface ConfigEntry {
  namespace: string;
  key: string;
  value: unknown;
  schemaVersion: string;
  version: number;
  updatedBy: string;
  updatedAt: Date;
}

// ── State ──

const TTL_MS = 60_000;

let snapshot = new Map<string, ConfigEntry>();
let lastLoadedAt = 0;
let hasLoadedOnce = false; // True after first successful full load (_doLoad)
let passiveInflight: Promise<void> | null = null;
let swapSequence = 0; // Monotonic: incremented on passive full-snapshot swap

// ── Internal: passive load ──

/**
 * Full snapshot load from DB. Used by passive path only.
 * Order guard: a passive load that started before a write (applyWrite)
 * or another passive swapped does not overwrite.
 */
async function _doLoad(): Promise<void> {
  const seqAtStart = swapSequence;
  const rows = await prisma.businessConfig.findMany();
  const newSnapshot = new Map<string, ConfigEntry>();
  for (const row of rows) {
    const validation = validateConfigEntry(row.namespace, row.key, row.value);
    if (!validation.valid) {
      console.error(
        `[config/snapshot] Discarding invalid entry ${row.namespace}::${row.key}: ${validation.error}`,
      );
      continue;
    }
    newSnapshot.set(`${row.namespace}::${row.key}`, {
      namespace: row.namespace,
      key: row.key,
      value: row.value,
      schemaVersion: row.schemaVersion,
      version: row.version,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    });
  }

  if (swapSequence !== seqAtStart) {
    lastLoadedAt = Date.now();
    return;
  }

  snapshot = newSnapshot;
  swapSequence++;
  hasLoadedOnce = true;
  lastLoadedAt = Date.now();
}

// ── Public API: reads ──

export function getOverride<T = unknown>(namespace: string, key: string): T | null {
  const entry = snapshot.get(`${namespace}::${key}`);
  if (!entry) return null;
  return entry.value as T;
}

export function getNamespaceEntries(namespace: string): ConfigEntry[] {
  const entries: ConfigEntry[] = [];
  for (const entry of snapshot.values()) {
    if (entry.namespace === namespace) entries.push(entry);
  }
  return entries;
}

export function getOverrideOr<T>(namespace: string, key: string, fallback: T): T {
  const override = getOverride<T>(namespace, key);
  return override !== null ? override : fallback;
}

export function getAllEntries(): ConfigEntry[] {
  return Array.from(snapshot.values());
}

// ── Lifecycle: passive path ──

export async function loadConfigSnapshot(): Promise<void> {
  if (passiveInflight) {
    await passiveInflight;
    return;
  }

  passiveInflight = _doLoad().catch((error) => {
    console.error('[config/snapshot] Passive refresh failed:', error);
  });

  try {
    await passiveInflight;
  } finally {
    passiveInflight = null;
  }
}

export async function ensureFresh(): Promise<void> {
  // Must have completed at least one full load AND be within TTL.
  // Without hasLoadedOnce check, a cold passive that lost the guard
  // (updating lastLoadedAt without hasLoadedOnce) would suppress the
  // first full load for one TTL window.
  if (hasLoadedOnce && Date.now() - lastLoadedAt < TTL_MS) return;
  await loadConfigSnapshot();
}

// ── Lifecycle: write path ──

/**
 * Apply a single committed entry to the snapshot (WRITE path).
 *
 * Called by the API AFTER the DB commit with the upserted row.
 * Uses the DB version as order authority: only applies if the entry's
 * version is higher than what's currently in the snapshot for that key.
 * This is synchronous — no DB round-trip, no race.
 *
 * RULE: The API must commit the DB upsert FIRST, then call this.
 */
export function applyWrite(entry: ConfigEntry): void {
  const mapKey = `${entry.namespace}::${entry.key}`;
  const existing = snapshot.get(mapKey);

  // Version guard: only apply if this entry is newer than what we have.
  // version is monotone per (namespace, key), incremented by the DB upsert.
  if (existing && existing.version >= entry.version) {
    return; // A more recent write already applied — discard this one.
  }

  // Validate before applying (defense in depth)
  const validation = validateConfigEntry(entry.namespace, entry.key, entry.value);
  if (!validation.valid) {
    console.error(
      `[config/snapshot] applyWrite rejected invalid entry ${entry.namespace}::${entry.key}: ${validation.error}`,
    );
    return;
  }

  // Apply to current snapshot (mutate the existing Map — atomic in single-thread)
  snapshot.set(mapKey, entry);
  swapSequence++;
  // Only mark as fresh if we've done a full load at least once.
  // On a cold snapshot, applyWrite sets ONE key but other overrides
  // in the DB are still missing — ensureFresh must trigger a full load.
  if (hasLoadedOnce) {
    lastLoadedAt = Date.now();
  }
}

// ── Testing helpers (guarded: throw in production) ──

export function _resetForTest(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('_resetForTest is not available in production');
  }
  snapshot = new Map();
  lastLoadedAt = 0;
  hasLoadedOnce = false;
  passiveInflight = null;
  swapSequence = 0;
}

export function _setForTest(entries: ConfigEntry[]): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('_setForTest is not available in production');
  }
  snapshot = new Map();
  for (const entry of entries) {
    snapshot.set(`${entry.namespace}::${entry.key}`, entry);
  }
  swapSequence++;
  lastLoadedAt = Date.now();
}
