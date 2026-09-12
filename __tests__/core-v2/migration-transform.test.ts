/**
 * Pure transform of the migrator (§AP): deterministic, roster-bound, no
 * silent coercion. No database — a synthetic snapshot in, a plan + manifest
 * entries out.
 */
import { approvalDigest, parseApprovalFile } from '@/scripts/core-v2/migration/approval';
import type { SourceSnapshot, SourceUser } from '@/scripts/core-v2/migration/source';
import { buildTargetPlan, deriveAccount, objectHash } from '@/scripts/core-v2/migration/transform';
import { MigrationPolicy, TRANSFORM_VERSION } from '@/scripts/core-v2/migration/types';

const user = (id: string, role: SourceUser['role'], extra: Partial<SourceUser> = {}): SourceUser => ({
  id, role, email: `${id}@synthetic.test`, password: 'hash', firstName: 'F', lastName: 'L', phone: null, activatedAt: new Date('2026-01-01T00:00:00Z'), sessionVersion: 3, mergedIntoUserId: null, ...extra,
});

const approval = parseApprovalFile({
  schoolYear: '2026-2027',
  academicYear: { startYear: 2026, startsAt: '2026-09-01', endsAt: '2027-07-15' },
  approvedStudentIds: ['stu-a', 'stu-b', 'stu-ghost'],
  approvedBy: 'owner',
  approvedAt: '2026-09-12T00:00:00.000Z',
});

function snapshot(): SourceSnapshot {
  const parent = user('par-1', 'PARENT');
  const coach = user('coach-u', 'COACH');
  return {
    fingerprint: 'v1:test',
    approvedIdsNotFound: ['stu-ghost'],
    students: [
      {
        id: 'stu-a', user: user('stu-a-u', 'ELEVE', { password: 'hash', activatedAt: null }), parentProfileId: 'pp-1', parentUser: parent,
        gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', stmgPathway: null, schoolingStatus: 'SCHOOL_ENROLLED', school: 'Lycée', birthDate: null,
        courseEnrollments: [
          { id: 'ce-1', courseKey: 'maths-premiere', kind: 'SPECIALTY', source: 'ASSISTANTE' },
          { id: 'ce-2', courseKey: 'nsi-premiere', kind: 'SPECIALTY', source: 'BACKFILL_LEGACY_SPECIALTIES' },
        ],
      },
      {
        id: 'stu-b', user: user('stu-b-u', 'ELEVE', { password: null, activatedAt: null }), parentProfileId: 'pp-1', parentUser: parent,
        gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE', stmgPathway: null, schoolingStatus: null, school: null, birthDate: new Date('2008-02-03T00:00:00Z'),
        courseEnrollments: [{ id: 'ce-3', courseKey: 'maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
      },
    ],
    assignments: [
      { id: 'as-1', coachProfileId: 'cp-1', coachUser: coach, studentId: 'stu-a', status: 'ACTIVE', courseScopeState: 'STAFF_VERIFIED', academicCourseKeys: ['maths-premiere', 'physique-premiere'], startsAt: new Date('2026-09-05T00:00:00Z'), endsAt: null },
      { id: 'as-2', coachProfileId: 'cp-1', coachUser: coach, studentId: 'stu-b', status: 'ACTIVE', courseScopeState: 'BACKFILL_AMBIGUOUS', academicCourseKeys: ['maths-terminale'], startsAt: new Date('2026-09-05T00:00:00Z'), endsAt: null },
    ],
    planningSeries: [
      { id: 'ps-1', assignmentId: 'as-1', academicCourseKey: 'maths-premiere', timezone: 'Africa/Tunis', startDate: new Date('2026-09-15T00:00:00Z'), localStartTime: '18:00', localEndTime: '19:00', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', recurrenceCount: null, recurrenceUntil: null, modality: 'ONLINE', location: null, status: 'ACTIVE' },
      { id: 'ps-2', assignmentId: 'as-1', academicCourseKey: 'physique-premiere', timezone: 'Africa/Tunis', startDate: new Date('2026-09-15T00:00:00Z'), localStartTime: '10:00', localEndTime: '11:00', recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE', recurrenceCount: null, recurrenceUntil: null, modality: 'ONLINE', location: null, status: 'ACTIVE' },
      { id: 'ps-3', assignmentId: 'as-1', academicCourseKey: 'maths-premiere', timezone: 'Africa/Tunis', startDate: new Date('2026-01-05T00:00:00Z'), localStartTime: '10:00', localEndTime: '11:00', recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO', recurrenceCount: null, recurrenceUntil: new Date('2026-06-30T00:00:00Z'), modality: 'ONLINE', location: null, status: 'ACTIVE' },
    ],
  };
}

const migratedAt = new Date('2026-09-12T08:00:00Z');

describe('buildTargetPlan', () => {
  const plan = buildTargetPlan(snapshot(), approval, migratedAt);
  const by = (entity: string, result?: string) => plan.entries.filter((e) => e.entity === entity && (!result || e.result === result));

  test('roster-bound: the approved-but-missing id is REJECTED, both real students are planned with one ACTIVE-year enrollment each', () => {
    expect(by('Student', 'REJECTED').map((e) => e.reason)).toEqual(['APPROVED_ID_NOT_IN_SOURCE']);
    expect(plan.students.map((s) => s.id)).toEqual(['stu-a', 'stu-b']);
    expect(plan.enrollments.map((e) => e.id)).toEqual(['aye-stu-a-2026', 'aye-stu-b-2026']);
    expect(plan.households).toHaveLength(1); // same parent profile → one household
    expect(plan.householdParents[0]).toMatchObject({ userId: 'par-1', isPrimaryContact: true });
  });

  test('account status is derived, never guessed; never-activated family passwords are dropped with a warning', () => {
    const users = Object.fromEntries(plan.users.map((u) => [u.id, u]));
    expect(users['par-1']).toMatchObject({ accountStatus: 'ACTIVE', password: 'hash', sessionVersion: 3 });
    expect(users['stu-a-u']).toMatchObject({ accountStatus: 'PENDING_ACTIVATION', password: null, activatedAt: null });
    expect(users['stu-b-u']).toMatchObject({ accountStatus: 'PENDING_ACTIVATION', password: null });
    expect(by('User').find((e) => e.sourceId === 'stu-a-u')!.warnings).toContain('PASSWORD_DROPPED_PENDING_ACTIVATION');
    expect(deriveAccount(user('c', 'COACH', { activatedAt: null })).accountStatus).toBe('ACTIVE'); // staff/coach never had the activation gate
  });

  test('course enrollments: human/seed sources migrate, legacy backfill is SKIPPED for review', () => {
    expect(plan.courseEnrollments.map((c) => c.courseKey)).toEqual(['maths-premiere', 'maths-terminale']);
    expect(by('StudentCourseEnrollment', 'SKIPPED').map((e) => e.reason)).toEqual(['SOURCE_BACKFILL_LEGACY_SPECIALTIES_NEEDS_REVIEW']);
  });

  test('assignments are REBUILT per verified course key the student is enrolled in; ambiguous scopes are SKIPPED, unknown courses REJECTED', () => {
    expect(plan.assignments.map((a) => a.id)).toEqual(['as-1-maths-premiere']);
    expect(plan.capabilities.map((c) => c.id)).toEqual(['cap-cp-1-maths-premiere']);
    expect(plan.coachProfiles).toEqual([{ id: 'cp-1', userId: 'coach-u' }]);
    expect(by('CoachStudentCourseAssignment', 'REJECTED').map((e) => [e.sourceId, e.reason])).toEqual([['as-1:physique-premiere', 'COURSE_NOT_ENROLLED']]);
    expect(by('CoachStudentCourseAssignment', 'SKIPPED').map((e) => e.reason)).toEqual(['SCOPE_BACKFILL_AMBIGUOUS_NEEDS_REVIEW']);
  });

  test('planning series: only those on a rebuilt assignment for the same course and still ahead of migratedAt', () => {
    expect(plan.planningSeries.map((p) => p.id)).toEqual(['ps-1']);
    expect(plan.planningSeries[0]).toMatchObject({ assignmentId: 'as-1-maths-premiere', timezone: 'Africa/Tunis' });
    expect(by('PlanningSeries', 'REJECTED').map((e) => [e.sourceId, e.reason])).toEqual([['ps-2', 'ASSIGNMENT_NOT_REBUILT_FOR_COURSE']]);
    expect(by('PlanningSeries', 'SKIPPED').map((e) => [e.sourceId, e.reason])).toEqual([['ps-3', 'ENDED_BEFORE_MIGRATION']]);
  });

  test('every entry carries the transform version, a hash when written, and a reason when not', () => {
    for (const e of plan.entries) {
      expect(e.transformVersion).toBe(TRANSFORM_VERSION);
      if (e.result === 'PLANNED') expect(e.hash).toMatch(/^[a-f0-9]{64}$/);
      else expect(e.reason).toBeTruthy();
    }
  });

  test('deterministic: same inputs → identical plan and hashes; a changed source field changes exactly that object’s hash', () => {
    const again = buildTargetPlan(snapshot(), approval, migratedAt);
    expect(objectHash(again.entries)).toBe(objectHash(plan.entries));
    const changed = snapshot();
    (changed.students[1] as { school: string | null }).school = 'Autre lycée';
    const plan2 = buildTargetPlan(changed, approval, migratedAt);
    const diff = plan2.entries.filter((e, i) => e.hash !== plan.entries[i]!.hash);
    expect(diff.map((e) => e.targetId)).toEqual(['aye-stu-b-2026']);
  });

  test('case-insensitive e-mail collisions and merged accounts are REJECTED (and their students with them)', () => {
    const s = snapshot();
    const collided: SourceSnapshot = {
      ...s,
      students: [
        { ...s.students[0]!, user: { ...s.students[0]!.user, email: 'Shared@Synthetic.test' } },
        { ...s.students[1]!, user: { ...s.students[1]!.user, email: 'shared@synthetic.test' } },
      ],
    };
    const p = buildTargetPlan(collided, approval, migratedAt);
    expect(p.students).toHaveLength(0);
    expect(p.entries.filter((e) => e.reason === 'EMAIL_CI_DUPLICATE')).toHaveLength(2);
    expect(p.entries.filter((e) => e.entity === 'Student' && e.reason === 'ACCOUNT_REJECTED')).toHaveLength(2);
    const mergedParent = { ...s.students[0]!.parentUser, mergedIntoUserId: 'other' };
    const merged: SourceSnapshot = { ...s, students: s.students.map((st) => ({ ...st, parentUser: mergedParent })) };
    expect(buildTargetPlan(merged, approval, migratedAt).entries.some((e) => e.reason === 'MERGED_INTO_OTHER_ACCOUNT')).toBe(true);
  });
});

describe('approval file', () => {
  test('digest is order-independent over ids and stable', () => {
    const a = parseApprovalFile({ ...approval, approvedStudentIds: ['b', 'a'] });
    const b = parseApprovalFile({ ...approval, approvedStudentIds: ['a', 'b'] });
    expect(approvalDigest(a)).toBe(approvalDigest(b));
    expect(approvalDigest(a)).not.toBe(approvalDigest(approval));
  });

  test('refuses duplicates, a year mismatch, unknown keys and PII-shaped fields', () => {
    expect(() => parseApprovalFile({ ...approval, approvedStudentIds: ['a', 'a'] })).toThrow();
    expect(() => parseApprovalFile({ ...approval, schoolYear: '2025-2026' })).toThrow();
    expect(() => parseApprovalFile({ ...approval, names: ['x'] })).toThrow();
  });
});

test('policy: never auto-migrates ambiguous/unresolved scopes, never copies courseScopeState, keeps billing in Core v1', () => {
  const doesNot = MigrationPolicy.doesNotMigrateAutomatically.join(' ');
  expect(doesNot).toMatch(/BACKFILL_UNRESOLVED/);
  expect(doesNot).toMatch(/BACKFILL_AMBIGUOUS/);
  expect(doesNot).toMatch(/never a copy of courseScopeState/);
  expect(doesNot).toMatch(/stay in Core v1/);
  expect(MigrationPolicy.migrates.join(' ')).toMatch(/REBUILT/);
});
