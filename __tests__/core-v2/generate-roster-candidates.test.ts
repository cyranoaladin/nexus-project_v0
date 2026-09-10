import {
  classify,
  computePaymentAttribution,
  schoolYearWindow,
  type RosterSignals,
} from '@/scripts/core-v2/generate-roster-candidates';

function student(id: string, parentUserId: string) {
  return { id, parent: { userId: parentUserId } };
}

function payment(userId: string | null, metadata: unknown = {}) {
  return { userId, metadata };
}

function signals(overrides: Partial<RosterSignals> = {}): RosterSignals {
  return {
    current_subscription: false,
    payment_2026_2027: false,
    payment_2026_2027_ambiguous_sibling: false,
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

  test('payment_2026_2027 alone, unambiguous (only child, or a specific metadata.studentId attribution) IS sufficient → ROSTER_2026_2027_CANDIDATE', () => {
    // Mirrors generateRosterCandidates()'s output for a parent with a single
    // child + a completed payment: household size 1, nothing to disambiguate.
    expect(classify(signals({ payment_2026_2027: true }))).toBe('ROSTER_2026_2027_CANDIDATE');
  });

  test('payment_2026_2027 that is ambiguous across siblings is NOT auto-approved → NEEDS_OWNER_REVIEW, never NOT_MIGRATED_CANDIDATE', () => {
    // Mirrors a parent with two children and only an unattributed
    // (no metadata.studentId) completed payment: BOTH children get this
    // exact signal shape from generateRosterCandidates().
    expect(
      classify(signals({ payment_2026_2027: true, payment_2026_2027_ambiguous_sibling: true })),
    ).toBe('NEEDS_OWNER_REVIEW');
  });

  test('an ambiguous sibling payment plus another unambiguous contractual signal still resolves to ROSTER_2026_2027_CANDIDATE for that child', () => {
    // Mirrors the sibling in the two-children scenario above who ALSO has
    // an active subscription: the ambiguous payment must never downgrade
    // an otherwise-clear candidate.
    expect(
      classify(
        signals({
          current_subscription: true,
          payment_2026_2027: true,
          payment_2026_2027_ambiguous_sibling: true,
        }),
      ),
    ).toBe('ROSTER_2026_2027_CANDIDATE');
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

describe('computePaymentAttribution — the actual DB-facing logic that was buggy (per-parent bleeding onto every sibling)', () => {
  test('parent with a single child + a completed payment (no metadata.studentId) → unambiguous candidate signal', () => {
    const students = [student('s1', 'parent-1')];
    const payments = [payment('parent-1')];
    const { paymentSignalByStudentId, paymentAmbiguousByStudentId } = computePaymentAttribution(
      students,
      payments,
    );
    expect(paymentSignalByStudentId.get('s1')).toBe(true);
    expect(paymentAmbiguousByStudentId.get('s1')).toBe(false);
  });

  test('parent with two children + only an unattributed payment → BOTH get the ambiguous signal, neither is silently dropped', () => {
    const students = [student('s1', 'parent-1'), student('s2', 'parent-1')];
    const payments = [payment('parent-1')]; // no metadata.studentId
    const { paymentSignalByStudentId, paymentAmbiguousByStudentId } = computePaymentAttribution(
      students,
      payments,
    );
    expect(paymentSignalByStudentId.get('s1')).toBe(true);
    expect(paymentSignalByStudentId.get('s2')).toBe(true);
    expect(paymentAmbiguousByStudentId.get('s1')).toBe(true);
    expect(paymentAmbiguousByStudentId.get('s2')).toBe(true);
  });

  test('parent with two children + a payment carrying a valid metadata.studentId → attributed child is unambiguous, sibling gets no signal at all', () => {
    const students = [student('s1', 'parent-1'), student('s2', 'parent-1')];
    const payments = [payment('parent-1', { studentId: 's1' })];
    const { paymentSignalByStudentId, paymentAmbiguousByStudentId } = computePaymentAttribution(
      students,
      payments,
    );
    expect(paymentSignalByStudentId.get('s1')).toBe(true);
    expect(paymentAmbiguousByStudentId.get('s1')).toBe(false);
    expect(paymentSignalByStudentId.get('s2')).toBe(false);
    expect(paymentAmbiguousByStudentId.get('s2')).toBe(false);
  });

  test('a metadata.studentId naming a student who is NOT a child of the paying parent (data-integrity anomaly) is ignored, falls back to unattributed', () => {
    const students = [student('s1', 'parent-1'), student('s2', 'parent-1')];
    // References a student that exists (in a different household) but is not
    // a child of parent-1 — must never be trusted as attribution.
    const payments = [payment('parent-1', { studentId: 'foreign-student-in-another-household' })];
    const { paymentSignalByStudentId, paymentAmbiguousByStudentId } = computePaymentAttribution(
      students,
      payments,
    );
    expect(paymentSignalByStudentId.get('s1')).toBe(true);
    expect(paymentSignalByStudentId.get('s2')).toBe(true);
    expect(paymentAmbiguousByStudentId.get('s1')).toBe(true);
    expect(paymentAmbiguousByStudentId.get('s2')).toBe(true);
  });

  test('no completed payments at all → no signal for anyone', () => {
    const students = [student('s1', 'parent-1'), student('s2', 'parent-2')];
    const { paymentSignalByStudentId, paymentAmbiguousByStudentId } = computePaymentAttribution(
      students,
      [],
    );
    expect(paymentSignalByStudentId.get('s1')).toBe(false);
    expect(paymentSignalByStudentId.get('s2')).toBe(false);
    expect(paymentAmbiguousByStudentId.get('s1')).toBe(false);
    expect(paymentAmbiguousByStudentId.get('s2')).toBe(false);
  });

  test('a payment with a null userId is skipped without throwing', () => {
    const students = [student('s1', 'parent-1')];
    expect(() => computePaymentAttribution(students, [payment(null)])).not.toThrow();
    const { paymentSignalByStudentId } = computePaymentAttribution(students, [payment(null)]);
    expect(paymentSignalByStudentId.get('s1')).toBe(false);
  });
});

describe('schoolYearWindow', () => {
  test('2026-2027 spans 1 Sept 2026 to 31 Aug 2027 (UTC)', () => {
    const { start, end } = schoolYearWindow('2026-2027');
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(end.toISOString().slice(0, 10)).toBe('2027-08-31');
  });
});
