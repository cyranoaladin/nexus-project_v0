import type {
  LifecycleActor,
  LifecycleStatus,
  LifecycleTransition,
  TransitionAction,
} from './types';

/**
 * The canonical and only source of truth for legal state changes.
 * A report regeneration always starts from the immutable score snapshot and
 * creates a new report revision when it returns to pending coach review.
 */
export const LEGAL_TRANSITIONS: readonly LifecycleTransition[] = [
  { from: 'DRAFT', action: 'SUBMIT', actor: 'STUDENT', to: 'SUBMITTED' },
  { from: 'SUBMITTED', action: 'SCORE', actor: 'WORKER', to: 'SCORED' },
  { from: 'SUBMITTED', action: 'MARK_SCORING_FAILED', actor: 'WORKER', to: 'SCORING_FAILED' },
  { from: 'SCORING_FAILED', action: 'RETRY_SCORING', actor: 'WORKER', to: 'SUBMITTED' },
  { from: 'SCORED', action: 'CREATE_REPORT', actor: 'WORKER', to: 'REPORT_PENDING_REVIEW' },
  { from: 'REPORT_PENDING_REVIEW', action: 'VALIDATE_REPORT', actor: 'COACH', to: 'COACH_VALIDATED' },
  { from: 'REPORT_PENDING_REVIEW', action: 'REJECT_REPORT', actor: 'COACH', to: 'COACH_REJECTED' },
  { from: 'COACH_REJECTED', action: 'REQUEST_REGENERATION', actor: 'COACH', to: 'SCORED' },
  { from: 'SCORED', action: 'REGENERATE_REPORT', actor: 'WORKER', to: 'REPORT_PENDING_REVIEW' },
  { from: 'COACH_VALIDATED', action: 'PUBLISH_REPORT', actor: 'COACH', to: 'PUBLISHED' },
];

export function getLegalTransition(
  from: LifecycleStatus,
  action: TransitionAction,
  actor: LifecycleActor,
): LifecycleTransition | undefined {
  return LEGAL_TRANSITIONS.find((transition) => (
    transition.from === from
    && transition.action === action
    && transition.actor === actor
  ));
}

export function isLegalTransition(candidate: LifecycleTransition): boolean {
  return LEGAL_TRANSITIONS.some((transition) => (
    transition.from === candidate.from
    && transition.action === candidate.action
    && transition.actor === candidate.actor
    && transition.to === candidate.to
  ));
}
