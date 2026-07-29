import {
  BILAN_REQUEST_ACTORS,
  BILAN_REQUEST_STATUSES,
  type BilanRequestActor,
  type BilanRequestStatus,
} from '@/lib/bilans/requests/types';
import {
  BILAN_REQUEST_TRANSITIONS,
  transition,
} from '@/lib/bilans/requests/state-machine';

const EXPECTED_TRANSITIONS = new Set([
  'NEW:READY_FOR_ASSESSMENT:SYSTEM',
  'READY_FOR_ASSESSMENT:ASSESSMENT_IN_PROGRESS:PARENT_FLOW',
  'ASSESSMENT_IN_PROGRESS:ASSESSMENT_SUBMITTED:PARENT_FLOW',
  'ASSESSMENT_SUBMITTED:SCORED:WORKER',
  'SCORED:REVIEW_PENDING:WORKER',
  'REVIEW_PENDING:PUBLISHED:COACH',
  'REVIEW_PENDING:PUBLISHED:ADMIN',
  'NEW:HUMAN_FOLLOWUP_REQUIRED:SYSTEM',
  'READY_FOR_ASSESSMENT:HUMAN_FOLLOWUP_REQUIRED:SYSTEM',
  'HUMAN_FOLLOWUP_REQUIRED:READY_FOR_ASSESSMENT:ASSISTANTE',
  'HUMAN_FOLLOWUP_REQUIRED:READY_FOR_ASSESSMENT:ADMIN',
  'ASSESSMENT_SUBMITTED:TECHNICAL_ACTION_REQUIRED:WORKER',
  'SCORED:TECHNICAL_ACTION_REQUIRED:WORKER',
  'TECHNICAL_ACTION_REQUIRED:ASSESSMENT_SUBMITTED:ASSISTANTE',
  'TECHNICAL_ACTION_REQUIRED:ASSESSMENT_SUBMITTED:ADMIN',
  'TECHNICAL_ACTION_REQUIRED:SCORED:ASSISTANTE',
  'TECHNICAL_ACTION_REQUIRED:SCORED:ADMIN',
  ...BILAN_REQUEST_STATUSES
    .filter((status) => status !== 'PUBLISHED' && status !== 'CANCELLED')
    .map((status) => `${status}:CANCELLED:ADMIN`),
]);

describe('bilan request state machine', () => {
  it.each([
    ['NEW', 'READY_FOR_ASSESSMENT', 'SYSTEM'],
    ['READY_FOR_ASSESSMENT', 'ASSESSMENT_IN_PROGRESS', 'PARENT_FLOW'],
    ['ASSESSMENT_IN_PROGRESS', 'ASSESSMENT_SUBMITTED', 'PARENT_FLOW'],
    ['ASSESSMENT_SUBMITTED', 'SCORED', 'WORKER'],
    ['SCORED', 'REVIEW_PENDING', 'WORKER'],
    ['REVIEW_PENDING', 'PUBLISHED', 'COACH'],
    ['REVIEW_PENDING', 'PUBLISHED', 'ADMIN'],
  ] as const)(
    'allows %s -> %s for %s',
    (from, to, actor) => {
      expect(transition(from, to, actor)).toEqual({ from, to, actor });
    },
  );

  it('does not let an assistante publish a reviewed assessment', () => {
    expect(transition('REVIEW_PENDING', 'PUBLISHED', 'ASSISTANTE')).toBeUndefined();
  });

  it('keeps published and cancelled requests terminal', () => {
    for (const from of ['PUBLISHED', 'CANCELLED'] as const) {
      for (const to of BILAN_REQUEST_STATUSES) {
        for (const actor of BILAN_REQUEST_ACTORS) {
          expect(transition(from, to, actor)).toBeUndefined();
        }
      }
    }
  });

  it('restricts cancellation to an admin', () => {
    const activeStatuses = BILAN_REQUEST_STATUSES.filter(
      (status) => status !== 'PUBLISHED' && status !== 'CANCELLED',
    );

    for (const from of activeStatuses) {
      expect(transition(from, 'CANCELLED', 'ADMIN')).toBeDefined();

      for (const actor of BILAN_REQUEST_ACTORS.filter((candidate) => candidate !== 'ADMIN')) {
        expect(transition(from, 'CANCELLED', actor)).toBeUndefined();
      }
    }
  });

  it('uses explicit conservative actors for intervention and retry transitions', () => {
    expect(transition('NEW', 'HUMAN_FOLLOWUP_REQUIRED', 'SYSTEM')).toBeDefined();
    expect(transition('READY_FOR_ASSESSMENT', 'HUMAN_FOLLOWUP_REQUIRED', 'SYSTEM')).toBeDefined();
    expect(transition('HUMAN_FOLLOWUP_REQUIRED', 'READY_FOR_ASSESSMENT', 'ASSISTANTE')).toBeDefined();
    expect(transition('HUMAN_FOLLOWUP_REQUIRED', 'READY_FOR_ASSESSMENT', 'ADMIN')).toBeDefined();
    expect(transition('HUMAN_FOLLOWUP_REQUIRED', 'READY_FOR_ASSESSMENT', 'PARENT_FLOW')).toBeUndefined();

    expect(transition('ASSESSMENT_SUBMITTED', 'TECHNICAL_ACTION_REQUIRED', 'WORKER')).toBeDefined();
    expect(transition('SCORED', 'TECHNICAL_ACTION_REQUIRED', 'WORKER')).toBeDefined();
    expect(transition('TECHNICAL_ACTION_REQUIRED', 'ASSESSMENT_SUBMITTED', 'ASSISTANTE')).toBeDefined();
    expect(transition('TECHNICAL_ACTION_REQUIRED', 'SCORED', 'ADMIN')).toBeDefined();
    expect(transition('TECHNICAL_ACTION_REQUIRED', 'SCORED', 'PARENT_FLOW')).toBeUndefined();
  });

  it('has a unique canonical entry for every allowed transition', () => {
    const keys = BILAN_REQUEST_TRANSITIONS.map(
      ({ from, to, actor }) => `${from}:${to}:${actor}`,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('matches the canonical matrix exhaustively', () => {
    for (const from of BILAN_REQUEST_STATUSES) {
      for (const to of BILAN_REQUEST_STATUSES) {
        for (const actor of BILAN_REQUEST_ACTORS) {
          const result = transition(
            from as BilanRequestStatus,
            to as BilanRequestStatus,
            actor as BilanRequestActor,
          );
          const key = `${from}:${to}:${actor}`;

          if (EXPECTED_TRANSITIONS.has(key)) {
            expect(result).toEqual({ from, to, actor });
            expect(result).not.toHaveProperty('accountVerificationState');
          } else {
            expect(result).toBeUndefined();
          }
        }
      }
    }
  });
});
