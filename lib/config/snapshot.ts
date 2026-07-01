/**
 * BusinessConfig in-memory snapshot — sync access, TTL-based passive refresh.
 *
 * Design (DOC-4 §2):
 * - Loaded at startup via loadConfigSnapshot()
 * - getOverride(namespace, key) returns the value synchronously or null
 * - TTL 60s: passive refresh coalesced via single-flight
 * - Invalidation on write: API awaits invalidateSnapshot() AFTER DB commit
 * - Mono-instance (PM2 fork mode, instances: 1) — no cross-process sync
 *
 * Two load paths with ASYMMETRIC guards:
 * 1. PASSIVE (TTL / startup): cedes to ANY swap (passive or write)
 * 2. WRITE (post-API-commit): cedes ONLY to a newer WRITE
 *
 * This ensures a write (authoritative post-commit) always wins over a
 * stale passive, but two concurrent writes still resolve correctly
 * (the later one wins).
 *
 * Order guards use monotonic counters (not wall-clock) to avoid
 * Date.now() resolution and NTP rewind issues.
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
let passiveInflight: Promise<void> | null = null;
let swapSequence = 0;  // Incremented on ANY swap (passive or write)
let writeSequence = 0; // Incremented only on WRITE swaps

// ── Internal ──

/**
 * Query DB, validate, build snapshot, conditionally assign.
 *
 * @param isWrite  true for invalidation (post-commit, authoritative).
 *                 false for passive (TTL refresh, can be stale).
 *
 * Guard logic:
 * - Passive load: cedes if swapSequence changed (any swap happened)
 * - Write load: cedes only if writeSequence changed (a newer write happened)
 *
 * A load that cedes still advances lastLoadedAt to prevent TTL storm.
 */
async function _doLoad(isWrite: boolean): Promise<void> {
  const seqAtStart = isWrite ? writeSequence : swapSequence;
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

  // Order guard — asymmetric:
  const currentSeq = isWrite ? writeSequence : swapSequence;
  if (currentSeq !== seqAtStart) {
    // Someone swapped since we started reading. Cede.
    lastLoadedAt = Date.now();
    return;
  }

  snapshot = newSnapshot;
  swapSequence++;
  if (isWrite) writeSequence++;
  lastLoadedAt = Date.now();
}

// ── Public API ──

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

  passiveInflight = _doLoad(false).catch((error) => {
    console.error('[config/snapshot] Passive refresh failed:', error);
  });

  try {
    await passiveInflight;
  } finally {
    passiveInflight = null;
  }
}

export async function ensureFresh(): Promise<void> {
  if (Date.now() - lastLoadedAt < TTL_MS) return;
  await loadConfigSnapshot();
}

// ── Lifecycle: write path ──

/**
 * Invalidate the snapshot after an API write.
 * RULE: The API must commit the DB update FIRST, then await this.
 */
export async function invalidateSnapshot(): Promise<void> {
  lastLoadedAt = 0;
  await _doLoad(true);
}

// ── Testing helpers (guarded: throw in production) ──

export function _resetForTest(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('_resetForTest is not available in production');
  }
  snapshot = new Map();
  lastLoadedAt = 0;
  passiveInflight = null;
  swapSequence = 0;
  writeSequence = 0;
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
  writeSequence++; // Keep both counters aligned to prevent test state inconsistency
  lastLoadedAt = Date.now();
}
