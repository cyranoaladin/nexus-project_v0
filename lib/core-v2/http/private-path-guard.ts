/**
 * Last line of defence at the HTTP boundary: no private storage path may ever
 * reach a client.
 *
 * The primary protection is the positive projection at the source
 * (`SUBMISSION_PUBLIC_FIELDS` in lib/core-v2/services/diagnostics.ts). This
 * guard exists because a projection can be forgotten on a NEW read path, and a
 * minor's private storage path must not escape just because someone added a
 * query without a `select`.
 *
 * It lives in the HTTP layer, not in a service: `respond.ts` must not import a
 * service module (that would pull Prisma and the whole domain into the response
 * layer).
 *
 * A guard that nothing calls protects nothing — this one is invoked from
 * `ok()`, the single success-response exit point of Core v2.
 */

/** Model fields that must never cross the HTTP boundary. */
const PRIVATE_FIELDS = Object.freeze(['storageKey'] as const);

/** Bounded so a deep or cyclic structure can never turn a response into a hang. */
const MAX_DEPTH = 12;

export class PrivateStoragePathExposedError extends Error {
  readonly code = 'PRIVATE_STORAGE_PATH_EXPOSED';
  constructor(field: string) {
    super(`PRIVATE_STORAGE_PATH_EXPOSED:${field}`);
    this.name = 'PrivateStoragePathExposedError';
  }
}

/**
 * Throws if `payload` carries a private storage path at any depth. The key's
 * presence is what matters, not its value: a `storageKey: null` still leaks the
 * internal schema.
 */
export function assertNoPrivateStoragePath(payload: unknown, depth = 0): void {
  if (depth > MAX_DEPTH || payload === null || typeof payload !== 'object') return;
  if (payload instanceof Date) return;
  if (Array.isArray(payload)) {
    for (const item of payload) assertNoPrivateStoragePath(item, depth + 1);
    return;
  }
  for (const field of PRIVATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      throw new PrivateStoragePathExposedError(field);
    }
  }
  for (const value of Object.values(payload as Record<string, unknown>)) {
    assertNoPrivateStoragePath(value, depth + 1);
  }
}
