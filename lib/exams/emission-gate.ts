/**
 * The single, tested composition point for the future automatic-emission
 * gate (mission Lot 4 correctif §5). validateProfilCandidat and
 * genererCarteExamen each expose their own emissionAutomatiqueAutorisee —
 * neither is sufficient alone (a profile can be structurally valid while
 * its carte still resolves an épreuve to A_VERIFIER, and vice versa is not
 * possible today but must not be assumed to stay that way). The gate is an
 * AND, never an OR — whichever future caller wires the engine/wizard must
 * use this function instead of recomputing the boolean logic itself.
 */
export function canEmitAutomatically(
  validation: { emissionAutomatiqueAutorisee: boolean },
  carte: { emissionAutomatiqueAutorisee: boolean },
): boolean {
  return validation.emissionAutomatiqueAutorisee && carte.emissionAutomatiqueAutorisee;
}
