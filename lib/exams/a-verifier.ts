/**
 * Sentinel for a regulatory value that is not yet confirmed by a source
 * (note de service, arrêté). Never coded as a guessed number — every
 * consumer must call requireResolved() and handle the throw, which is the
 * fail-closed behavior mandated by CDC §15 ("ne comble jamais un trou par
 * une supposition plausible").
 */
export const A_VERIFIER = 'À_VERIFIER' as const;
export type AVerifiable<T> = T | typeof A_VERIFIER;

export function isAVerifier<T>(value: AVerifiable<T>): value is typeof A_VERIFIER {
  return value === A_VERIFIER;
}

export function requireResolved<T>(value: AVerifiable<T>, fieldPath: string): T {
  if (isAVerifier(value)) {
    throw new Error(
      `${fieldPath} is still À_VERIFIER — confirm the source (note de service) before this value can be used to price or display a coefficient.`,
    );
  }
  return value;
}
