import {
  attemptSubmissionSchema,
  catalogRefSchema,
  evidenceItemSchema,
  notificationEventSchema,
  reportRegenerationSchema,
  reportRevisionSchema,
  scoreSnapshotSchema,
} from '@/lib/bilans/core/schemas';
import {
  getLegalTransition,
  isFreshReportRevision,
  isLegalTransition,
} from '@/lib/bilans/core/state-machine';
import type {
  LifecycleActor,
  LifecycleStatus,
  TransitionAction,
} from '@/lib/bilans/core/types';

type TransitionFixture = {
  from: LifecycleStatus;
  action: TransitionAction;
  actor: LifecycleActor;
  to: LifecycleStatus;
};

describe('canonical bilan lifecycle', () => {
  // This fixture intentionally does not import or derive from production data.
  const legalTransitions: TransitionFixture[] = [
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

  const illegalTransitions: TransitionFixture[] = [
    { from: 'DRAFT', action: 'SUBMIT', actor: 'PARENT', to: 'SUBMITTED' },
    { from: 'SUBMITTED', action: 'SCORE', actor: 'STUDENT', to: 'SCORED' },
    { from: 'REPORT_PENDING_REVIEW', action: 'PUBLISH_REPORT', actor: 'COACH', to: 'PUBLISHED' },
    { from: 'COACH_REJECTED', action: 'CREATE_REPORT', actor: 'WORKER', to: 'REPORT_PENDING_REVIEW' },
    { from: 'PUBLISHED', action: 'VALIDATE_REPORT', actor: 'COACH', to: 'COACH_VALIDATED' },
  ];

  it.each(legalTransitions)('allows $from --$action/$actor--> $to', (transition) => {
    expect(isLegalTransition(transition)).toBe(true);
    expect(getLegalTransition(transition.from, transition.action, transition.actor)).toMatchObject({
      to: transition.to,
    });
  });

  it.each(illegalTransitions)('denies $from --$action/$actor--> $to', (transition) => {
    expect(isLegalTransition(transition)).toBe(false);
  });
});

describe('canonical bilan schemas', () => {
  it('rejects unknown keys on every external contract', () => {
    expect(catalogRefSchema.safeParse({
      id: 'catalog-2026', subject: 'MATHEMATIQUES', level: 'SECONDE', version: '2026.1', unexpected: true,
    }).success).toBe(false);
    expect(attemptSubmissionSchema.safeParse({
      attemptId: 'attempt-1', catalog: { id: 'catalog-2026', subject: 'MATHEMATIQUES', level: 'SECONDE', version: '2026.1' },
      answers: [{ questionId: 'q1', answer: '42' }], submittedAt: '2026-07-14T09:00:00.000Z', unexpected: true,
    }).success).toBe(false);
    expect(scoreSnapshotSchema.safeParse({
      attemptId: 'attempt-1', algorithmVersion: '1.0.0', totalScore: 80, maxScore: 100, scoredAt: '2026-07-14T09:00:00.000Z', unexpected: true,
    }).success).toBe(false);
    expect(evidenceItemSchema.safeParse({
      skillId: 'algebra.linear', status: 'MASTERED', rationale: 'Réponse exacte.', unexpected: true,
    }).success).toBe(false);
    expect(reportRevisionSchema.safeParse({
      id: 'report-1', attemptId: 'attempt-1', revision: 1, status: 'REPORT_PENDING_REVIEW', generatedAt: '2026-07-14T09:00:00.000Z', evidence: [], unexpected: true,
    }).success).toBe(false);
    expect(notificationEventSchema.safeParse({
      id: 'notification-1', type: 'QUESTIONNAIRE_SUBMITTED', recipientRole: 'COACH', channel: 'WHATSAPP', occurredAt: '2026-07-14T09:00:00.000Z', unexpected: true,
    }).success).toBe(false);
  });

  it('accepts a publishable, coach-validated report revision', () => {
    expect(reportRevisionSchema.safeParse({
      id: 'report-1',
      attemptId: 'attempt-1',
      revision: 2,
      status: 'COACH_VALIDATED',
      generatedAt: '2026-07-14T09:00:00.000Z',
      validatedAt: '2026-07-14T09:10:00.000Z',
      evidence: [{ skillId: 'algebra.linear', status: 'MASTERED', rationale: 'Réponse exacte.' }],
    }).success).toBe(true);
  });

  it('requires regeneration to create the next pending revision with a fresh identity', () => {
    const previousRevision = {
      id: 'report-1',
      attemptId: 'attempt-1',
      revision: 1,
      status: 'COACH_REJECTED' as const,
      generatedAt: '2026-07-14T09:00:00.000Z',
      evidence: [],
    };
    const nextRevision = {
      ...previousRevision,
      id: 'report-2',
      revision: 2,
      status: 'REPORT_PENDING_REVIEW' as const,
      generatedAt: '2026-07-14T09:05:00.000Z',
    };

    expect(isFreshReportRevision(previousRevision, nextRevision)).toBe(true);
    expect(reportRegenerationSchema.safeParse({ previousRevision, nextRevision }).success).toBe(true);
    expect(reportRegenerationSchema.safeParse({
      previousRevision,
      nextRevision: { ...nextRevision, id: previousRevision.id },
    }).success).toBe(false);
    expect(reportRegenerationSchema.safeParse({
      previousRevision,
      nextRevision: { ...nextRevision, revision: previousRevision.revision },
    }).success).toBe(false);
  });
});
