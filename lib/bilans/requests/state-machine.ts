import {
  BILAN_REQUEST_STATUSES,
  type BilanRequestActor,
  type BilanRequestStatus,
  type BilanRequestTransition,
} from './types';

const ACTIVE_STATUSES = BILAN_REQUEST_STATUSES.filter(
  (status): status is Exclude<BilanRequestStatus, 'PUBLISHED' | 'CANCELLED'> => (
    status !== 'PUBLISHED' && status !== 'CANCELLED'
  ),
);

/**
 * Canonical actor/status matrix for the public free-assessment request.
 * Account verification deliberately lives outside this state machine.
 */
export const BILAN_REQUEST_TRANSITIONS: readonly BilanRequestTransition[] = [
  { from: 'NEW', to: 'READY_FOR_ASSESSMENT', actor: 'SYSTEM' },
  { from: 'READY_FOR_ASSESSMENT', to: 'ASSESSMENT_IN_PROGRESS', actor: 'PARENT_FLOW' },
  { from: 'ASSESSMENT_IN_PROGRESS', to: 'ASSESSMENT_SUBMITTED', actor: 'PARENT_FLOW' },
  { from: 'ASSESSMENT_SUBMITTED', to: 'SCORED', actor: 'WORKER' },
  { from: 'SCORED', to: 'REVIEW_PENDING', actor: 'WORKER' },
  { from: 'REVIEW_PENDING', to: 'PUBLISHED', actor: 'COACH' },
  { from: 'REVIEW_PENDING', to: 'PUBLISHED', actor: 'ADMIN' },

  { from: 'NEW', to: 'HUMAN_FOLLOWUP_REQUIRED', actor: 'SYSTEM' },
  { from: 'READY_FOR_ASSESSMENT', to: 'HUMAN_FOLLOWUP_REQUIRED', actor: 'SYSTEM' },
  { from: 'HUMAN_FOLLOWUP_REQUIRED', to: 'READY_FOR_ASSESSMENT', actor: 'ASSISTANTE' },
  { from: 'HUMAN_FOLLOWUP_REQUIRED', to: 'READY_FOR_ASSESSMENT', actor: 'ADMIN' },

  { from: 'ASSESSMENT_SUBMITTED', to: 'TECHNICAL_ACTION_REQUIRED', actor: 'WORKER' },
  { from: 'SCORED', to: 'TECHNICAL_ACTION_REQUIRED', actor: 'WORKER' },
  {
    from: 'TECHNICAL_ACTION_REQUIRED',
    to: 'ASSESSMENT_SUBMITTED',
    actor: 'WORKER',
  },
  { from: 'TECHNICAL_ACTION_REQUIRED', to: 'SCORED', actor: 'WORKER' },

  ...ACTIVE_STATUSES.map((from): BilanRequestTransition => ({
    from,
    to: 'CANCELLED',
    actor: 'ADMIN',
  })),
];

export function transition(
  from: BilanRequestStatus,
  to: BilanRequestStatus,
  actor: BilanRequestActor,
): BilanRequestTransition | undefined {
  return BILAN_REQUEST_TRANSITIONS.find((candidate) => (
    candidate.from === from
    && candidate.to === to
    && candidate.actor === actor
  ));
}
