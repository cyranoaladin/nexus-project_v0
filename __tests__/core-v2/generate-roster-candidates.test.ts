import { classify, schoolYearWindow, type RosterSignals } from '@/scripts/core-v2/generate-roster-candidates';

function signals(overrides: Partial<RosterSignals> = {}): RosterSignals {
  return {
    current_subscription: false,
    payment_2026_2027: false,
    current_quote_contract: false,
    future_planning: false,
    explicit_2026_2027_registration: false,
    recent_enrollment_workflow: false,
    legacy_assignment_ignored_for_roster: true,
    ...overrides,
  };
}

describe('classify — no weak signal alone becomes a roster candidate', () => {
  test('all signals false → NOT_MIGRATED_CANDIDATE', () => {
    expect(classify(signals())).toBe('NOT_MIGRATED_CANDIDATE');
  });

  test('explicit_2026_2027_registration alone is NOT sufficient (recency is descriptive only, owner-rejected as authority)', () => {
    expect(classify(signals({ explicit_2026_2027_registration: true }))).toBe('NOT_MIGRATED_CANDIDATE');
  });

  test('recent_enrollment_workflow alone is NOT sufficient', () => {
    expect(classify(signals({ recent_enrollment_workflow: true }))).toBe('NOT_MIGRATED_CANDIDATE');
  });

  test('current_subscription alone IS sufficient (genuine contractual signal)', () => {
    expect(classify(signals({ current_subscription: true }))).toBe('ROSTER_2026_2027_CANDIDATE');
  });

  test('payment_2026_2027 alone IS sufficient', () => {
    expect(classify(signals({ payment_2026_2027: true }))).toBe('ROSTER_2026_2027_CANDIDATE');
  });

  test('current_quote_contract alone IS sufficient', () => {
    expect(classify(signals({ current_quote_contract: true }))).toBe('ROSTER_2026_2027_CANDIDATE');
  });

  test('future_planning alone IS sufficient', () => {
    expect(classify(signals({ future_planning: true }))).toBe('ROSTER_2026_2027_CANDIDATE');
  });

  test('Case A/Case B student shape: legacy assignment flag present but all other signals false → NOT_MIGRATED_CANDIDATE', () => {
    // Regression guard for mission §14: an old coach_student_assignments row
    // must never, by itself, produce a roster candidate. This test encodes
    // the exact signal shape both Case A and Case B students had in the real run.
    expect(classify(signals({ legacy_assignment_ignored_for_roster: true }))).toBe('NOT_MIGRATED_CANDIDATE');
  });
});

describe('schoolYearWindow', () => {
  test('2026-2027 spans 1 Sept 2026 to 31 Aug 2027 (UTC)', () => {
    const { start, end } = schoolYearWindow('2026-2027');
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(end.toISOString().slice(0, 10)).toBe('2027-08-31');
  });
});
