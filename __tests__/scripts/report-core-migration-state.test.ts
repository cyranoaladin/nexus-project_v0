import {
  summarizeCoreMigrationState,
  loadCoreMigrationState,
  type CourseScopeStateGroup,
} from '@/scripts/core/report-core-migration-state';

describe('summarizeCoreMigrationState (pure)', () => {
  it('retourne des compteurs à zéro pour une entrée vide', () => {
    const report = summarizeCoreMigrationState([]);

    expect(report.ACTIVE_ASSIGNMENT_UNRESOLVED).toBe(0);
    expect(report.ACTIVE_ASSIGNMENT_AMBIGUOUS).toBe(0);
    expect(report.activeAssignmentsByCourseScopeState).toEqual({
      STAFF_VERIFIED: 0,
      BACKFILL_AUTO: 0,
      BACKFILL_UNRESOLVED: 0,
      BACKFILL_AMBIGUOUS: 0,
    });
    expect(report.allAssignmentsByCourseScopeState).toEqual({
      STAFF_VERIFIED: 0,
      BACKFILL_AUTO: 0,
      BACKFILL_UNRESOLVED: 0,
      BACKFILL_AMBIGUOUS: 0,
    });
  });

  it('exclut SUSPENDED et ENDED des compteurs actifs mais les compte dans le total', () => {
    const groups: readonly CourseScopeStateGroup[] = [
      { status: 'ACTIVE', courseScopeState: 'BACKFILL_UNRESOLVED', count: 2 },
      { status: 'SUSPENDED', courseScopeState: 'BACKFILL_UNRESOLVED', count: 5 },
      { status: 'ENDED', courseScopeState: 'BACKFILL_AMBIGUOUS', count: 3 },
    ];

    const report = summarizeCoreMigrationState(groups);

    expect(report.ACTIVE_ASSIGNMENT_UNRESOLVED).toBe(2);
    expect(report.ACTIVE_ASSIGNMENT_AMBIGUOUS).toBe(0);
    expect(report.activeAssignmentsByCourseScopeState.BACKFILL_UNRESOLVED).toBe(2);
    expect(report.activeAssignmentsByCourseScopeState.BACKFILL_AMBIGUOUS).toBe(0);
    expect(report.allAssignmentsByCourseScopeState.BACKFILL_UNRESOLVED).toBe(7);
    expect(report.allAssignmentsByCourseScopeState.BACKFILL_AMBIGUOUS).toBe(3);
  });

  it('additionne plusieurs groupes portant le même état actif', () => {
    const groups: readonly CourseScopeStateGroup[] = [
      { status: 'ACTIVE', courseScopeState: 'BACKFILL_AMBIGUOUS', count: 4 },
      { status: 'ACTIVE', courseScopeState: 'BACKFILL_AMBIGUOUS', count: 6 },
    ];

    const report = summarizeCoreMigrationState(groups);

    expect(report.ACTIVE_ASSIGNMENT_AMBIGUOUS).toBe(10);
    expect(report.activeAssignmentsByCourseScopeState.BACKFILL_AMBIGUOUS).toBe(10);
    expect(report.allAssignmentsByCourseScopeState.BACKFILL_AMBIGUOUS).toBe(10);
  });

  it('rapporte un scope entièrement STAFF_VERIFIED avec des gates à zéro', () => {
    const groups: readonly CourseScopeStateGroup[] = [
      { status: 'ACTIVE', courseScopeState: 'STAFF_VERIFIED', count: 12 },
      { status: 'ACTIVE', courseScopeState: 'BACKFILL_AUTO', count: 3 },
    ];

    const report = summarizeCoreMigrationState(groups);

    expect(report.ACTIVE_ASSIGNMENT_UNRESOLVED).toBe(0);
    expect(report.ACTIVE_ASSIGNMENT_AMBIGUOUS).toBe(0);
    expect(report.activeAssignmentsByCourseScopeState.STAFF_VERIFIED).toBe(12);
    expect(report.activeAssignmentsByCourseScopeState.BACKFILL_AUTO).toBe(3);
  });
});

describe('loadCoreMigrationState (adaptateur Prisma)', () => {
  it('rejette un courseScopeState inconnu au lieu de le compter silencieusement', async () => {
    const client = {
      coachStudentAssignment: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'ACTIVE', courseScopeState: 'SOME_FUTURE_STATE', _count: { _all: 1 } },
        ]),
      },
    };

    await expect(loadCoreMigrationState(client)).rejects.toThrow(
      'CORE_MIGRATION_STATE_UNKNOWN_COURSE_SCOPE_STATE:SOME_FUTURE_STATE',
    );
  });

  it('convertit un groupBy Prisma réaliste en rapport agrégé', async () => {
    const client = {
      coachStudentAssignment: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'ACTIVE', courseScopeState: 'STAFF_VERIFIED', _count: { _all: 8 } },
          { status: 'ACTIVE', courseScopeState: 'BACKFILL_UNRESOLVED', _count: { _all: 1 } },
          { status: 'ENDED', courseScopeState: 'BACKFILL_AMBIGUOUS', _count: { _all: 2 } },
        ]),
      },
    };

    const report = await loadCoreMigrationState(client);

    expect(client.coachStudentAssignment.groupBy).toHaveBeenCalledWith({
      by: ['status', 'courseScopeState'],
      _count: { _all: true },
    });
    expect(report.ACTIVE_ASSIGNMENT_UNRESOLVED).toBe(1);
    expect(report.ACTIVE_ASSIGNMENT_AMBIGUOUS).toBe(0);
    expect(report.allAssignmentsByCourseScopeState.BACKFILL_AMBIGUOUS).toBe(2);
  });
});
