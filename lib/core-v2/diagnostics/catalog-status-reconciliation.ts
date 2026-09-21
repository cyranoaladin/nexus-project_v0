import type { CatalogStatus } from '@/core-v2/generated/client';

/**
 * Reconciles the private catalog's authorities into the applicative
 * CatalogStatus (mission §2). This is the ONLY function allowed to compute
 * AUTHORIZED for a real form — a future real ingestion script
 * (scripts/core-v2/ingest-diagnostic-catalog.ts, not yet written: there is
 * nothing real to ingest as of this writing) MUST call this rather than
 * copy a manifest field directly. An unknown, empty, or contradictory input
 * resolves to UNAVAILABLE, never AUTHORIZED by default.
 *
 * Three independent authorities, none of which alone is sufficient:
 *
 * 1. **Statut pédagogique privé** — per-item lifecycle status
 *    (nexus-diagnostics-private/referentiels/item_lifecycle.json). Only
 *    ACTIVE/USED items may enter a real passation pack; DRAFT,
 *    INDEPENDENTLY_SOLVED, PEDAGOGICALLY_REVIEWED and RETIRED never do.
 * 2. **Statut de diffusion de la forme** — a distinct, form-level "go live"
 *    decision by the direction pédagogique, ABOVE item-level review.
 *    Confirmed as a separate, unexercised gate by BOTH
 *    review/form-a/EDS-MATH/README.md and review/form-a/FR-EAF/README.md:
 *    "Ils ne peuvent pas être tirés dans un pack de passation tant que la
 *    direction n'a pas validé cette forme." review/form-a/INDEX.md itself:
 *    "**Statut global : PEDAGOGICAL_REVIEW_BUILD, pas une release finale**"
 *    and "La promotion ACTIVE est une décision de la direction, pas une
 *    conséquence automatique de cet audit."
 * 3. **Disponibilité technique** — the rendering engine (PR #296, not yet
 *    merged as of 2026-09-21) and the confidential, role-scoped
 *    distribution storage review/form-a/INDEX.md itself flags as missing:
 *    "V3_OPERATIONAL_ARTIFACT_CONFIDENTIALITY=PENDING : aucun stockage de
 *    distribution à accès borné par rôle n'existe encore pour remettre
 *    réellement un PDF à un candidat ou un coach."
 *
 * Read on 2026-09-21 across all three of the above plus V3_PILOT_REVIEW.md:
 * both V3 pilot forms (EDS-MATH/N1, FR-EAF/ecrit_2027) have every item at
 * PEDAGOGICALLY_REVIEWED — authority 1 fails for both, so both resolve to
 * IN_REVIEW today regardless of 2/3 (see the fixed snapshot in this
 * module's test file). DiagnosticInstrumentRef stays a controlled mirror:
 * it never becomes a second authority able to grant pedagogical
 * authorization on its own.
 */
export type PedagogicalItemStatus =
  | 'DRAFT'
  | 'INDEPENDENTLY_SOLVED'
  | 'PEDAGOGICALLY_REVIEWED'
  | 'ACTIVE'
  | 'USED'
  | 'RETIRED'
  | 'COMPROMISED';

export interface FormReconciliationInput {
  /** Every item statuses composing this form/pack. Empty = unknown state. */
  readonly itemStatuses: readonly PedagogicalItemStatus[];
  /** A distinct, form-level "direction" decision — never inferred from item status alone. */
  readonly diffusionDecisionMade: boolean;
  /** Rendering engine + confidential distribution storage genuinely operational for this form. */
  readonly technicallyAvailable: boolean;
}

export function resolveCatalogStatus(input: FormReconciliationInput): CatalogStatus {
  if (input.itemStatuses.length === 0) {
    // Unknown/empty is never promoted by default.
    return 'UNAVAILABLE';
  }
  if (input.itemStatuses.some((status) => status === 'COMPROMISED')) {
    return 'COMPROMISED';
  }
  const everyItemReady = input.itemStatuses.every((status) => status === 'ACTIVE' || status === 'USED');
  if (!everyItemReady) {
    // Includes PEDAGOGICALLY_REVIEWED, DRAFT, INDEPENDENTLY_SOLVED, RETIRED —
    // consultable in an authorized review space, never attributable.
    return 'IN_REVIEW';
  }
  if (!input.diffusionDecisionMade) {
    // Item-level readiness alone never implies the form is diffusable.
    return 'IN_REVIEW';
  }
  if (!input.technicallyAvailable) {
    return 'UNAVAILABLE';
  }
  return 'AUTHORIZED';
}
