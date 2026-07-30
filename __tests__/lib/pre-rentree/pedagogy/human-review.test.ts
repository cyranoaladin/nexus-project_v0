import {
  PedagogyReviewError,
  advancePedagogyReview,
  assessPedagogyReviewChain,
  loadPedagogyCatalog,
  type HumanPedagogyReviewDecision,
} from '@/lib/pre-rentree/pedagogy';

const definition = loadPedagogyCatalog().getAssessment(
  'maths-entree-terminale',
  'INTERNAL_REVIEW',
);

function decision(
  overrides: Partial<HumanPedagogyReviewDecision> = {},
): HumanPedagogyReviewDecision {
  return {
    role: 'SUBJECT_TEACHER',
    reviewerId: 'staff:teacher-1',
    reviewerDisplayName: 'À renseigner par le validateur réel',
    reviewedAt: '2026-07-30T09:00:00.000Z',
    definitionSha256: definition.ref.sha256,
    decision: 'APPROVE',
    reservations: [],
    ...overrides,
  };
}

describe('hash-bound human pedagogy review contract', () => {
  it('requires the subject teacher, pedagogical owner and publication owner in order', () => {
    const subjectReview = advancePedagogyReview({
      definitionRef: definition.ref,
      currentStatus: 'HUMAN_VALIDATION_REQUIRED',
      decisions: [],
      decision: decision(),
    });
    expect(subjectReview.status).toBe('SUBJECT_REVIEW_APPROVED');

    const ownerReview = advancePedagogyReview({
      definitionRef: definition.ref,
      currentStatus: subjectReview.status,
      decisions: subjectReview.decisions,
      decision: decision({
        role: 'PEDAGOGICAL_OWNER',
        reviewerId: 'staff:owner-1',
      }),
    });
    expect(ownerReview.status).toBe('PEDAGOGICAL_OWNER_APPROVED');

    const publicationReview = advancePedagogyReview({
      definitionRef: definition.ref,
      currentStatus: ownerReview.status,
      decisions: ownerReview.decisions,
      decision: decision({
        role: 'PUBLICATION_OWNER',
        reviewerId: 'staff:publisher-1',
      }),
    });
    expect(publicationReview.status).toBe('PUBLICATION_APPROVED');
    expect(publicationReview.decisions).toHaveLength(3);
  });

  it('invalidates every approval when the definition hash changes', () => {
    const subjectReview = advancePedagogyReview({
      definitionRef: definition.ref,
      currentStatus: 'HUMAN_VALIDATION_REQUIRED',
      decisions: [],
      decision: decision(),
    });

    expect(assessPedagogyReviewChain({
      definitionRef: {
        ...definition.ref,
        sha256: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      decisions: subjectReview.decisions,
    })).toEqual({
      valid: false,
      status: 'HUMAN_VALIDATION_REQUIRED',
      reason: 'DEFINITION_HASH_CHANGED',
    });
  });

  it('rejects an out-of-order, anonymous or hash-mismatched approval', () => {
    for (const invalidDecision of [
      decision({ role: 'PEDAGOGICAL_OWNER' }),
      decision({ reviewerId: '' }),
      decision({
        definitionSha256:
          'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    ]) {
      expect(() => advancePedagogyReview({
        definitionRef: definition.ref,
        currentStatus: 'HUMAN_VALIDATION_REQUIRED',
        decisions: [],
        decision: invalidDecision,
      })).toThrow(PedagogyReviewError);
    }
  });

  it('returns to HUMAN_VALIDATION_REQUIRED after a rejection', () => {
    const rejected = advancePedagogyReview({
      definitionRef: definition.ref,
      currentStatus: 'HUMAN_VALIDATION_REQUIRED',
      decisions: [],
      decision: decision({
        decision: 'REJECT',
        reservations: ['Source officielle à confirmer.'],
      }),
    });

    expect(rejected.status).toBe('HUMAN_VALIDATION_REQUIRED');
    expect(rejected.decisions).toHaveLength(1);
  });
});
