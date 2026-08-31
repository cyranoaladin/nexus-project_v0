import { planAriaFeedbackProfileBackfill } from '@/scripts/aria/backfill-feedback-profile';

const legacyFeedback = {
  messageId: 'message-private-id',
  conversationId: 'conversation-private-id',
  studentId: 'student-private-id',
  feedback: true,
};

const canonicalFeedback = {
  id: 'feedback-private-id',
  messageId: legacyFeedback.messageId,
  studentId: legacyFeedback.studentId,
  useful: true,
};

const profile = {
  profileId: 'profile-private-id',
  studentId: legacyFeedback.studentId,
  selectedCourseKeys: [],
  uiPreferences: {},
  preferencesVersion: 1,
  pinnedCourseKeys: [],
  focusedCourseKey: null,
  courseOrder: [],
  showCitations: true,
};

describe('ARIA feedback/profile backfill planner', () => {
  it('B4_PLAN_BINDS_FEEDBACK_SOURCE_AND_CONSULTED_TARGET_STATE', () => {
    const create = planAriaFeedbackProfileBackfill({
      feedbackSources: [legacyFeedback],
      canonicalFeedbacks: [],
      profiles: [],
    });
    const existing = planAriaFeedbackProfileBackfill({
      feedbackSources: [legacyFeedback],
      canonicalFeedbacks: [canonicalFeedback],
      profiles: [],
    });
    const changedTarget = planAriaFeedbackProfileBackfill({
      feedbackSources: [legacyFeedback],
      canonicalFeedbacks: [{ ...canonicalFeedback, useful: false }],
      profiles: [],
    });
    const wrongOwner = planAriaFeedbackProfileBackfill({
      feedbackSources: [legacyFeedback],
      canonicalFeedbacks: [{ ...canonicalFeedback, studentId: 'other-student' }],
      profiles: [],
    });

    expect(create.feedbackDecisions[0]).toMatchObject({
      classification: 'DETERMINISTIC_BACKFILL', action: 'CREATE', reasonCode: 'TARGET_ABSENT',
    });
    expect(existing.feedbackDecisions[0]).toMatchObject({
      classification: 'DETERMINISTIC_BACKFILL', action: 'CANONICAL_NOOP', reasonCode: 'TARGET_MATCHES',
    });
    expect(changedTarget.feedbackDecisions[0]).toMatchObject({
      classification: 'MANUAL_REVIEW_REQUIRED', action: 'MANUAL_NOOP', reasonCode: 'TARGET_VALUE_CONFLICT',
    });
    expect(wrongOwner.feedbackDecisions[0]).toMatchObject({
      classification: 'MANUAL_REVIEW_REQUIRED', action: 'MANUAL_NOOP', reasonCode: 'TARGET_OWNER_CONFLICT',
    });
    expect(existing.sourceDigest).not.toBe(create.sourceDigest);
    expect(changedTarget.sourceDigest).not.toBe(existing.sourceDigest);
    expect(wrongOwner.sourceDigest).not.toBe(existing.sourceDigest);
  });

  it('B4_PLAN_CLASSIFIES_EMPTY_LEGACY_PROFILE_ONLY_WHEN_UI_BAG_EMPTY_AND_CANONICAL_V1_VALID', () => {
    const valid = planAriaFeedbackProfileBackfill({
      feedbackSources: [], canonicalFeedbacks: [], profiles: [profile],
    });
    expect(valid.profileDecisions[0]).toMatchObject({
      classification: 'DETERMINISTIC_BACKFILL',
      action: 'CANONICAL_NOOP',
      reasonCode: 'LEGACY_EMPTY_CANONICAL_VALID',
    });

    const cases: Array<[unknown, unknown, Record<string, unknown>, string]> = [
      [['eds-maths-terminale'], {}, {}, 'LEGACY_SELECTED_COURSES_PRESENT'],
      ['malformed', {}, {}, 'LEGACY_SELECTED_COURSES_INVALID'],
      [[], { theme: 'dark' }, {}, 'LEGACY_UI_PREFERENCES_PRESENT'],
      [[], [], {}, 'LEGACY_UI_PREFERENCES_INVALID'],
      [[], {}, { preferencesVersion: 2 }, 'CANONICAL_PREFERENCES_INVALID'],
      [[], {}, { pinnedCourseKeys: ['duplicate', 'duplicate'] }, 'CANONICAL_PREFERENCES_INVALID'],
    ];
    for (const [selectedCourseKeys, uiPreferences, canonicalOverride, reasonCode] of cases) {
      const plan = planAriaFeedbackProfileBackfill({
        feedbackSources: [],
        canonicalFeedbacks: [],
        profiles: [{ ...profile, selectedCourseKeys, uiPreferences, ...canonicalOverride }],
      });
      expect(plan.profileDecisions[0]).toMatchObject({
        classification: 'MANUAL_REVIEW_REQUIRED', action: 'MANUAL_NOOP', reasonCode,
      });
    }
  });

  it('B4_PLAN_IS_ORDER_STABLE_BINDS_SEMANTICS_AND_IGNORES_UNUSED_FIELDS', () => {
    const secondFeedback = {
      ...legacyFeedback,
      messageId: 'message-second-id',
      conversationId: 'conversation-second-id',
      feedback: false,
    };
    const baseline = planAriaFeedbackProfileBackfill({
      feedbackSources: [legacyFeedback, secondFeedback],
      canonicalFeedbacks: [canonicalFeedback],
      profiles: [profile],
    });
    const reorderedWithUnusedFields = planAriaFeedbackProfileBackfill({
      feedbackSources: [
        { ...secondFeedback, content: 'ignored-message-content' },
        { ...legacyFeedback, role: 'ignored-role', createdAt: 'ignored-date' },
      ] as never,
      canonicalFeedbacks: [{
        ...canonicalFeedback,
        reason: 'ignored-reason',
        updatedAt: 'ignored-date',
      }] as never,
      profiles: [{ ...profile, updatedAt: 'ignored-date' }] as never,
    });
    const changedSourceSameCounts = planAriaFeedbackProfileBackfill({
      feedbackSources: [{ ...legacyFeedback, feedback: false }, secondFeedback],
      canonicalFeedbacks: [{ ...canonicalFeedback, useful: false }],
      profiles: [profile],
    });
    const changedCanonicalPreferences = planAriaFeedbackProfileBackfill({
      feedbackSources: [legacyFeedback, secondFeedback],
      canonicalFeedbacks: [canonicalFeedback],
      profiles: [{ ...profile, showCitations: false }],
    });

    expect(reorderedWithUnusedFields.sourceDigest).toBe(baseline.sourceDigest);
    expect(changedSourceSameCounts.report.feedback).toEqual(baseline.report.feedback);
    expect(changedSourceSameCounts.report.profiles).toEqual(baseline.report.profiles);
    expect(changedSourceSameCounts.sourceDigest).not.toBe(baseline.sourceDigest);
    expect(changedCanonicalPreferences.sourceDigest).not.toBe(baseline.sourceDigest);
  });

  it('B4_PLAN_DETACHES_DEEP_FREEZES_AND_PERSISTS_NO_RAW_IDENTIFIERS', () => {
    const mutableProfile = {
      ...profile,
      selectedCourseKeys: [] as string[],
      uiPreferences: {} as Record<string, unknown>,
      pinnedCourseKeys: [] as string[],
      courseOrder: [] as string[],
    };
    const mutableCanonical = { ...canonicalFeedback };
    const plan = planAriaFeedbackProfileBackfill({
      feedbackSources: [legacyFeedback],
      canonicalFeedbacks: [mutableCanonical],
      profiles: [mutableProfile],
    });
    mutableCanonical.useful = false;
    mutableProfile.pinnedCourseKeys.push('eds-maths-terminale');
    mutableProfile.uiPreferences.theme = 'dark';

    expect(plan.feedbackDecisions[0].targets).toEqual([canonicalFeedback]);
    expect(plan.profileDecisions[0].canonicalPreferences).toEqual({
      preferencesVersion: 1,
      pinnedCourseKeys: [],
      focusedCourseKey: null,
      courseOrder: [],
      showCitations: true,
    });
    expect(Object.isFrozen(plan.feedbackDecisions)).toBe(true);
    expect(Object.isFrozen(plan.feedbackDecisions[0])).toBe(true);
    expect(Object.isFrozen(plan.feedbackDecisions[0].source)).toBe(true);
    expect(Object.isFrozen(plan.feedbackDecisions[0].targets)).toBe(true);
    expect(Object.isFrozen(plan.profileDecisions[0].canonicalPreferences)).toBe(true);
    expect(Object.isFrozen(plan.profileDecisions[0].canonicalPreferences?.pinnedCourseKeys)).toBe(true);
    const persisted = JSON.stringify(plan.sourceSnapshot);
    for (const raw of [
      legacyFeedback.messageId,
      legacyFeedback.studentId,
      legacyFeedback.conversationId,
      canonicalFeedback.id,
      profile.profileId,
    ]) {
      expect(persisted).not.toContain(raw);
    }
  });

  it('B4_PLAN_REJECTS_DUPLICATE_SOURCE_IDENTITIES', () => {
    expect(() => planAriaFeedbackProfileBackfill({
      feedbackSources: [legacyFeedback, legacyFeedback],
      canonicalFeedbacks: [],
      profiles: [],
    })).toThrow('ARIA_FEEDBACK_PROFILE_PLAN_DUPLICATE_SOURCE');
    expect(() => planAriaFeedbackProfileBackfill({
      feedbackSources: [],
      canonicalFeedbacks: [],
      profiles: [profile, profile],
    })).toThrow('ARIA_FEEDBACK_PROFILE_PLAN_DUPLICATE_SOURCE');
  });

  it.each([
    ['NON_FINITE_NUMBER', Number.NaN],
    ['UNDEFINED', undefined],
    ['FUNCTION', () => true],
    ['SYMBOL', Symbol('invalid')],
    ['CYCLIC_OBJECT', (() => {
      const value: Record<string, unknown> = {};
      value.self = value;
      return value;
    })()],
    ['CUSTOM_OBJECT_PROTOTYPE', Object.create({ inherited: true })],
    ['CUSTOM_ARRAY_PROTOTYPE', (() => {
      const value: unknown[] = [];
      Object.setPrototypeOf(value, null);
      return value;
    })()],
  ])('B4_PLAN_REJECTS_NON_JSON_PREFERENCES_%s', (_name, selectedCourseKeys) => {
    expect(() => planAriaFeedbackProfileBackfill({
      feedbackSources: [], canonicalFeedbacks: [],
      profiles: [{ ...profile, selectedCourseKeys }],
    })).toThrow('ARIA_FEEDBACK_PROFILE_PLAN_JSON_INVALID');
  });

  it('B4_PLAN_CLASSIFIES_MULTIPLE_CANONICAL_FEEDBACK_TARGETS_FOR_MANUAL_REVIEW', () => {
    const plan = planAriaFeedbackProfileBackfill({
      feedbackSources: [legacyFeedback],
      canonicalFeedbacks: [
        { ...canonicalFeedback, id: 'feedback-z' },
        { ...canonicalFeedback, id: 'feedback-a' },
      ],
      profiles: [],
    });

    expect(plan.feedbackDecisions[0]).toMatchObject({
      classification: 'MANUAL_REVIEW_REQUIRED',
      action: 'MANUAL_NOOP',
      reasonCode: 'TARGET_MULTIPLE',
      targets: [{ id: 'feedback-a' }, { id: 'feedback-z' }],
    });
  });
});
