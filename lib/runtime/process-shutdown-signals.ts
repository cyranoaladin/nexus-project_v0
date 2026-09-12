/**
 * Process-level "register once" for SIGTERM/SIGINT shutdown handlers.
 *
 * A `globalThis` flag is NOT a per-process guard: Jest gives every test file
 * a fresh global object while `process` stays the one real, shared process
 * object of the worker, so a globalThis-guarded `process.once(...)` is
 * re-added by every file that evaluates the module (observed in CI as
 * `MaxListenersExceededWarning: 11 SIGTERM/SIGINT listeners added to
 * [process]`). The registry therefore lives on `process` itself, keyed by a
 * stable name, so the second module instance is a no-op.
 */
const REGISTRY = Symbol.for('nexus.process-shutdown-signals.registry');

type ProcessWithRegistry = NodeJS.Process & { [REGISTRY]?: Set<string> };

function registry(): Set<string> {
  const proc = process as ProcessWithRegistry;
  proc[REGISTRY] ??= new Set<string>();
  return proc[REGISTRY];
}

/** Registers `handler` for SIGTERM and SIGINT exactly once per process for `key`. Returns false when already registered. */
export function registerProcessShutdownOnce(key: string, handler: () => void): boolean {
  const registered = registry();
  if (registered.has(key)) return false;
  registered.add(key);
  process.once('SIGTERM', handler);
  process.once('SIGINT', handler);
  return true;
}
