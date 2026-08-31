import { planAriaEntitlementBackfill } from '@/scripts/aria/backfill-entitlements';

const subscription = {
  id: 'subscription-private-id',
  studentId: 'student-private-id',
  userId: 'user-private-id',
  gradeLevel: 'PREMIERE' as const,
  academicTrack: 'EDS_GENERALE' as const,
  stmgPathway: null,
  status: 'ACTIVE' as const,
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  endDate: new Date('2027-07-31T00:00:00.000Z'),
  ariaSubjects: JSON.stringify(['eds-maths-premiere']),
};

const nsiEnrollment = {
  studentId: subscription.studentId,
  courseKey: 'eds-nsi-premiere',
  kind: 'SPECIALTY' as const,
  source: 'ADMIN' as const,
};

const mathsEnrollment = {
  studentId: subscription.studentId,
  courseKey: 'eds-maths-premiere',
  kind: 'SPECIALTY' as const,
  source: 'ADMIN' as const,
};

const enrollments = [mathsEnrollment, nsiEnrollment];

const now = new Date('2026-08-30T12:00:00.000Z');

describe('ARIA entitlement backfill planner', () => {
  it('B3_SNAPSHOT_BINDS_ACADEMIC_MAP_EXISTING_ENTITLEMENT_LINEAGE_AND_AUDITED_NOW', () => {
    const maths = planAriaEntitlementBackfill({
      subscriptions: [subscription],
      enrollments,
      existingEntitlements: new Map(),
      priorGenerations: new Map([[subscription.id, 0]]),
      now,
    });
    const nsi = planAriaEntitlementBackfill({
      subscriptions: [{
        ...subscription,
        ariaSubjects: JSON.stringify(['eds-nsi-premiere']),
      }],
      enrollments,
      existingEntitlements: new Map(),
      priorGenerations: new Map([[subscription.id, 0]]),
      now,
    });
    const existing = {
      id: 'entitlement-private-id',
      productCode: 'ARIA_ACCESS',
      userId: subscription.userId,
      status: 'SUSPENDED',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2027-07-31T00:00:00.000Z',
      suspendedAt: '2026-08-20T00:00:00.000Z',
      revokedAt: null,
      scopes: [{ kind: 'COURSE' as const, courseKey: 'eds-maths-premiere' }],
    };
    const withExisting = planAriaEntitlementBackfill({
      subscriptions: [subscription],
      enrollments,
      existingEntitlements: new Map([[subscription.id, existing]]),
      priorGenerations: new Map([[subscription.id, 1]]),
      now,
    });
    const nextGeneration = planAriaEntitlementBackfill({
      subscriptions: [subscription],
      enrollments,
      existingEntitlements: new Map([[subscription.id, existing]]),
      priorGenerations: new Map([[subscription.id, 2]]),
      now,
    });
    const cancelledAtDifferentClock = planAriaEntitlementBackfill({
      subscriptions: [{ ...subscription, status: 'CANCELLED' }],
      enrollments,
      existingEntitlements: new Map(),
      priorGenerations: new Map([[subscription.id, 0]]),
      now: new Date('2026-08-31T12:00:00.000Z'),
    });
    const cancelled = planAriaEntitlementBackfill({
      subscriptions: [{ ...subscription, status: 'CANCELLED' }],
      enrollments,
      existingEntitlements: new Map(),
      priorGenerations: new Map([[subscription.id, 0]]),
      now,
    });

    for (const plan of [maths, nsi, withExisting, nextGeneration, cancelled, cancelledAtDifferentClock]) {
      expect(plan.report).toMatchObject({
        scanned: 1,
        deterministic: 1,
        archived: 0,
        manualReview: 0,
        mutated: 0,
      });
    }
    expect(nsi.sourceDigest).not.toBe(maths.sourceDigest);
    expect(withExisting.sourceDigest).not.toBe(maths.sourceDigest);
    expect(nextGeneration.sourceDigest).not.toBe(withExisting.sourceDigest);
    expect(cancelledAtDifferentClock.sourceDigest).not.toBe(cancelled.sourceDigest);
    expect(maths.decisions[0].desired.scopes).toEqual([
      { kind: 'COURSE', courseKey: 'eds-maths-premiere' },
    ]);
    expect(nsi.decisions[0].desired.scopes).toEqual([
      { kind: 'COURSE', courseKey: 'eds-nsi-premiere' },
    ]);
    expect(JSON.stringify(withExisting.sourceSnapshot)).not.toContain(subscription.studentId);
    expect(JSON.stringify(withExisting.sourceSnapshot)).not.toContain(existing.id);
  });

  it('B3_PLAN_DETACHES_AND_FREEZES_SOURCE_TARGET_AND_ACADEMIC_ROWS', () => {
    const mutableSubscription = { ...subscription };
    const mutableEnrollment = { ...nsiEnrollment };
    const plan = planAriaEntitlementBackfill({
      subscriptions: [mutableSubscription],
      enrollments: [mathsEnrollment, mutableEnrollment],
      existingEntitlements: new Map(),
      priorGenerations: new Map(),
      now,
    });
    mutableSubscription.ariaSubjects = JSON.stringify(['eds-nsi-premiere']);
    mutableSubscription.startDate.setUTCFullYear(2030);
    mutableEnrollment.courseKey = 'eds-maths-premiere';

    expect(plan.decisions[0].subscription).toMatchObject({
      ariaSubjects: JSON.stringify(['eds-maths-premiere']),
      startDate: '2026-08-01T00:00:00.000Z',
    });
    expect(Object.isFrozen(plan.decisions)).toBe(true);
    expect(Object.isFrozen(plan.decisions[0])).toBe(true);
    expect(Object.isFrozen(plan.decisions[0].subscription)).toBe(true);
    expect(Object.isFrozen(plan.decisions[0].desired)).toBe(true);
    expect(Object.isFrozen(plan.decisions[0].desired.scopes)).toBe(true);
  });

  it('B3_SNAPSHOT_IGNORES_TARGET_LINEAGE_AND_CLOCK_WHEN_CLASSIFICATION_CANNOT_MUTATE', () => {
    const manualSubscription = {
      ...subscription,
      ariaSubjects: JSON.stringify(['unknown-entitlement-key']),
      status: 'CANCELLED' as const,
    };
    const baseline = planAriaEntitlementBackfill({
      subscriptions: [manualSubscription],
      enrollments,
      existingEntitlements: new Map(),
      priorGenerations: new Map(),
      now,
    });
    const unrelatedTargetState = planAriaEntitlementBackfill({
      subscriptions: [manualSubscription],
      enrollments,
      existingEntitlements: new Map([[subscription.id, {
        id: 'unconsulted-entitlement',
        productCode: 'WRONG_PRODUCT',
        userId: 'unconsulted-user',
        status: 'ACTIVE',
        startsAt: '2025-01-01T00:00:00.000Z',
        endsAt: null,
        suspendedAt: null,
        revokedAt: null,
        scopes: [],
      }]]),
      priorGenerations: new Map([[subscription.id, -1]]),
      now: new Date('2030-01-01T00:00:00.000Z'),
    });

    expect(baseline.report).toMatchObject({ manualReview: 1, deterministic: 0 });
    expect(unrelatedTargetState.sourceDigest).toBe(baseline.sourceDigest);
    expect(unrelatedTargetState.decisions[0]).toMatchObject({
      existing: null,
      generation: 0,
      desired: null,
    });
  });

  it('B3_SNAPSHOT_IGNORES_ACADEMIC_ROWS_NOT_CONSULTED_FOR_EMPTY_OR_MALFORMED_GRANT', () => {
    for (const ariaSubjects of ['', JSON.stringify([42])]) {
      const withoutAcademicRows = planAriaEntitlementBackfill({
        subscriptions: [{ ...subscription, ariaSubjects }],
        enrollments: [],
        existingEntitlements: new Map(),
        priorGenerations: new Map(),
        now,
      });
      const withUnconsultedAcademicRows = planAriaEntitlementBackfill({
        subscriptions: [{ ...subscription, ariaSubjects }],
        enrollments,
        existingEntitlements: new Map(),
        priorGenerations: new Map(),
        now,
      });

      expect(withUnconsultedAcademicRows.sourceDigest).toBe(withoutAcademicRows.sourceDigest);
      expect(withUnconsultedAcademicRows.decisions[0].enrollments).toEqual([]);
    }
  });
});
