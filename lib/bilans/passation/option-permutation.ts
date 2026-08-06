export type AttemptSeed = string | number;

function normalizeSeed(seed: AttemptSeed): string {
  if (typeof seed === 'number') {
    if (!Number.isSafeInteger(seed)) throw new TypeError('ATTEMPT_SEED_INVALID');
    return String(seed);
  }
  if (seed.trim().length === 0) throw new TypeError('ATTEMPT_SEED_INVALID');
  return seed;
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function xorshift32(state: number): () => number {
  let current = state === 0 ? 0x9e3779b9 : state;
  return () => {
    current ^= current << 13;
    current ^= current >>> 17;
    current ^= current << 5;
    return current >>> 0;
  };
}

/**
 * Returns the display-only option order for one item in one attempt.
 * The source array and its option objects are never mutated.
 */
export function permuteOptionsForDisplay<T>(
  options: readonly T[],
  attemptSeed: AttemptSeed,
  itemId: string,
): readonly T[] {
  if (itemId.trim().length === 0) throw new TypeError('ITEM_ID_REQUIRED');

  const shuffled = [...options];
  const next = xorshift32(fnv1a32(`${normalizeSeed(attemptSeed)}\u0000${itemId}`));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = next() % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return Object.freeze(shuffled);
}
