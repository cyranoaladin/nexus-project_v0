import type { AssessmentDefinitionRef } from './types';

export const PEDAGOGY_REVIEW_STATUSES = [
  'HUMAN_VALIDATION_REQUIRED',
  'SUBJECT_REVIEW_APPROVED',
  'PEDAGOGICAL_OWNER_APPROVED',
  'PUBLICATION_APPROVED',
] as const;

export type PedagogyReviewStatus = (typeof PEDAGOGY_REVIEW_STATUSES)[number];
export type HumanPedagogyReviewerRole =
  | 'SUBJECT_TEACHER'
  | 'PEDAGOGICAL_OWNER'
  | 'PUBLICATION_OWNER';

export type HumanPedagogyReviewDecision = Readonly<{
  role: HumanPedagogyReviewerRole;
  reviewerId: string;
  reviewerDisplayName: string;
  reviewedAt: string;
  definitionSha256: `sha256:${string}`;
  decision: 'APPROVE' | 'REJECT';
  reservations: readonly string[];
}>;

export type PedagogyReviewChain = Readonly<{
  status: PedagogyReviewStatus;
  decisions: readonly HumanPedagogyReviewDecision[];
}>;

export type PedagogyReviewAssessment =
  | Readonly<{ valid: true; status: PedagogyReviewStatus }>
  | Readonly<{
    valid: false;
    status: 'HUMAN_VALIDATION_REQUIRED';
    reason: 'DEFINITION_HASH_CHANGED' | 'INVALID_REVIEW_CHAIN';
  }>;

export class PedagogyReviewError extends Error {
  readonly code = 'INVALID_PEDAGOGY_REVIEW';

  constructor() {
    super('INVALID_PEDAGOGY_REVIEW');
    this.name = 'PedagogyReviewError';
  }
}

const expectedRoles: readonly HumanPedagogyReviewerRole[] = [
  'SUBJECT_TEACHER',
  'PEDAGOGICAL_OWNER',
  'PUBLICATION_OWNER',
];

const statusesAfterApproval: readonly PedagogyReviewStatus[] = [
  'SUBJECT_REVIEW_APPROVED',
  'PEDAGOGICAL_OWNER_APPROVED',
  'PUBLICATION_APPROVED',
];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function validIdentity(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/.test(value);
}

function validInstant(value: string): boolean {
  return value.includes('T') && Number.isFinite(Date.parse(value));
}

function validDecision(decision: HumanPedagogyReviewDecision): boolean {
  return validIdentity(decision.reviewerId)
    && decision.reviewerDisplayName.trim().length >= 2
    && decision.reviewerDisplayName.length <= 160
    && validInstant(decision.reviewedAt)
    && /^sha256:[a-f0-9]{64}$/.test(decision.definitionSha256)
    && decision.reservations.every(
      (reservation) => reservation.trim().length > 0 && reservation.length <= 1_000,
    )
    && (decision.decision === 'APPROVE' || decision.reservations.length > 0);
}

function deriveStatus(
  decisions: readonly HumanPedagogyReviewDecision[],
): PedagogyReviewStatus | null {
  let approvals = 0;
  for (const review of decisions) {
    if (!validDecision(review) || review.role !== expectedRoles[approvals]) {
      return null;
    }
    if (review.decision === 'REJECT') return 'HUMAN_VALIDATION_REQUIRED';
    approvals += 1;
  }
  return approvals === 0
    ? 'HUMAN_VALIDATION_REQUIRED'
    : statusesAfterApproval[approvals - 1] ?? null;
}

export function assessPedagogyReviewChain(input: Readonly<{
  definitionRef: AssessmentDefinitionRef;
  decisions: readonly HumanPedagogyReviewDecision[];
}>): PedagogyReviewAssessment {
  if (input.decisions.some(
    ({ definitionSha256 }) => definitionSha256 !== input.definitionRef.sha256,
  )) {
    return deepFreeze({
      valid: false,
      status: 'HUMAN_VALIDATION_REQUIRED',
      reason: 'DEFINITION_HASH_CHANGED',
    });
  }

  const status = deriveStatus(input.decisions);
  return status
    ? deepFreeze({ valid: true, status })
    : deepFreeze({
      valid: false,
      status: 'HUMAN_VALIDATION_REQUIRED',
      reason: 'INVALID_REVIEW_CHAIN',
    });
}

export function advancePedagogyReview(input: Readonly<{
  definitionRef: AssessmentDefinitionRef;
  currentStatus: PedagogyReviewStatus;
  decisions: readonly HumanPedagogyReviewDecision[];
  decision: HumanPedagogyReviewDecision;
}>): PedagogyReviewChain {
  const current = assessPedagogyReviewChain({
    definitionRef: input.definitionRef,
    decisions: input.decisions,
  });
  const expectedRole = expectedRoles[input.decisions.length];
  if (!current.valid
    || current.status !== input.currentStatus
    || !validDecision(input.decision)
    || input.decision.definitionSha256 !== input.definitionRef.sha256
    || input.decision.role !== expectedRole) {
    throw new PedagogyReviewError();
  }

  const decisions = [...input.decisions, input.decision];
  const next = assessPedagogyReviewChain({
    definitionRef: input.definitionRef,
    decisions,
  });
  if (!next.valid) throw new PedagogyReviewError();

  return deepFreeze({
    status: next.status,
    decisions,
  });
}
