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
    expect(maths.decisions[0].desired!.scopes).toEqual([
      { kind: 'COURSE', courseKey: 'eds-maths-premiere' },
    ]);
    expect(nsi.decisions[0].desired!.scopes).toEqual([
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
    expect(Object.isFrozen(plan.decisions[0].desired!.scopes)).toBe(true);
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

  it.each([
    ['NOW', { now: 'not-an-instant' }],
    ['START', { subscriptions: [{ ...subscription, startDate: 'not-an-instant' }] }],
    ['END', { subscriptions: [{ ...subscription, endDate: 'not-an-instant' }] }],
  ] as const)('B3_PLAN_REJECTS_INVALID_%s_DATE', (_name, override) => {
    expect(() => planAriaEntitlementBackfill({
      subscriptions: [subscription],
      enrollments,
      existingEntitlements: new Map(),
      priorGenerations: new Map(),
      now,
      ...override,
    })).toThrow('ARIA_ENTITLEMENT_BACKFILL_DATE_INVALID');
  });

  it.each([
    ['PRODUCT', { productCode: 'OTHER_PRODUCT', userId: subscription.userId }],
    ['OWNER', { productCode: 'ARIA_ACCESS', userId: 'different-user' }],
  ] as const)('B3_PLAN_REJECTS_EXISTING_TARGET_%s_DRIFT', (_name, ownership) => {
    expect(() => planAriaEntitlementBackfill({
      subscriptions: [subscription], enrollments,
      existingEntitlements: new Map([[subscription.id, {
        id: 'existing-entitlement',
        ...ownership,
        status: 'ACTIVE', startsAt: '2026-08-01T00:00:00.000Z', endsAt: null,
        suspendedAt: null, revokedAt: null, scopes: [],
      }]]),
      priorGenerations: new Map(), now,
    })).toThrow('ARIA_ENTITLEMENT_BACKFILL_TARGET_OWNERSHIP_CONFLICT');
  });

  it.each([Number.NaN, -1, 1.5])(
    'B3_PLAN_REJECTS_INVALID_GENERATION_%s',
    (generation) => {
      expect(() => planAriaEntitlementBackfill({
        subscriptions: [subscription], enrollments,
        existingEntitlements: new Map(),
        priorGenerations: new Map([[subscription.id, generation]]),
        now,
      })).toThrow('ARIA_ENTITLEMENT_BACKFILL_GENERATION_INVALID');
    },
  );

  it('B3_SCOPE_RESOLUTION_COVERS_GLOBAL_LEGACY_DEDUP_AND_NOT_ENROLLED', () => {
    const global = planAriaEntitlementBackfill({
      subscriptions: [{ ...subscription, ariaSubjects: JSON.stringify(['ALL', 'aria_global']) }],
      enrollments: [], existingEntitlements: new Map(), priorGenerations: new Map(), now,
    }).decisions[0];
    expect(global).toMatchObject({
      classification: 'DETERMINISTIC_BACKFILL', academicMapConsulted: false,
      desired: { scopes: [{ kind: 'GLOBAL', courseKey: null }] },
    });

    const legacyMaths = planAriaEntitlementBackfill({
      subscriptions: [{ ...subscription, ariaSubjects: 'aria_maths' }],
      enrollments, existingEntitlements: new Map(), priorGenerations: new Map(), now,
    }).decisions[0];
    expect(legacyMaths).toMatchObject({
      classification: 'DETERMINISTIC_BACKFILL', academicMapConsulted: true,
      desired: { scopes: [{ kind: 'COURSE', courseKey: 'eds-maths-premiere' }] },
    });

    const duplicate = planAriaEntitlementBackfill({
      subscriptions: [{
        ...subscription,
        ariaSubjects: JSON.stringify(['eds-maths-premiere', 'eds-maths-premiere']),
      }],
      enrollments, existingEntitlements: new Map(), priorGenerations: new Map(), now,
    }).decisions[0];
    expect(duplicate.desired?.scopes).toEqual([
      { kind: 'COURSE', courseKey: 'eds-maths-premiere' },
    ]);

    const notEnrolled = planAriaEntitlementBackfill({
      subscriptions: [{ ...subscription, ariaSubjects: JSON.stringify(['eds-nsi-premiere']) }],
      enrollments: [mathsEnrollment], existingEntitlements: new Map(),
      priorGenerations: new Map(), now,
    }).decisions[0];
    expect(notEnrolled).toMatchObject({
      classification: 'MANUAL_REVIEW_REQUIRED', academicMapConsulted: true,
      desired: null,
    });
  });

  it.each([
    ['ACTIVE', 'ACTIVE', null, null],
    ['INACTIVE', 'SUSPENDED', now.toISOString(), null],
    ['CANCELLED', 'REVOKED', null, now.toISOString()],
    ['EXPIRED', 'EXPIRED', null, null],
  ] as const)(
    'B3_STATUS_%s_MAPS_TO_%s_WITH_AUDITED_INSTANTS',
    (sourceStatus, expectedStatus, suspendedAt, revokedAt) => {
      const decision = planAriaEntitlementBackfill({
        subscriptions: [{ ...subscription, status: sourceStatus }],
        enrollments, existingEntitlements: new Map(), priorGenerations: new Map(), now,
      }).decisions[0];

      expect(decision.desired).toMatchObject({
        status: expectedStatus, suspendedAt, revokedAt,
      });
    },
  );

  it('B3_STMG_BROAD_GRANT_REMAINS_MANUAL_WHEN_MULTIPLE_CAPABLE_COURSES_EXIST', () => {
    const decision = planAriaEntitlementBackfill({
      subscriptions: [{
        ...subscription,
        academicTrack: 'STMG',
        stmgPathway: 'GF',
        ariaSubjects: JSON.stringify(['STMG']),
      }],
      enrollments: [], existingEntitlements: new Map(), priorGenerations: new Map(), now,
    }).decisions[0];

    expect(decision).toMatchObject({
      classification: 'MANUAL_REVIEW_REQUIRED',
      academicMapConsulted: true,
      desired: null,
    });
  });
});
