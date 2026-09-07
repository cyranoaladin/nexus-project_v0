import {
  main,
  planBackfill,
  runBackfill,
  type BackfillAssignmentCourseKeysPort,
  type CandidateAssignmentRow,
} from '@/scripts/core/backfill-assignment-course-keys';

const PREMIERE_EDS = {
  gradeLevel: 'PREMIERE',
  academicTrack: 'EDS_GENERALE',
  stmgPathway: null,
};

function row(overrides: Partial<CandidateAssignmentRow> & Pick<CandidateAssignmentRow, 'id'>): CandidateAssignmentRow {
  return {
    studentId: `${overrides.id}-student`,
    coachId: `${overrides.id}-coach`,
    subjects: [],
    courseScopeState: 'BACKFILL_UNRESOLVED',
    academicCourseKeys: [],
    studentIdentity: PREMIERE_EDS,
    enrollments: [],
    coachSubjects: [],
    ...overrides,
  };
}

const AUTO_ROW = row({
  id: 'auto',
  subjects: ['NSI'],
  enrollments: [{ courseKey: 'eds-nsi-premiere', kind: 'SPECIALTY', source: 'ADMIN' }],
  coachSubjects: ['NSI'],
});

const UNRESOLVED_ROW = row({
  id: 'unresolved',
  subjects: ['SES'],
  coachSubjects: ['SES'],
});

const AMBIGUOUS_ROW = row({
  id: 'ambiguous',
  subjects: ['MATHEMATIQUES'],
  enrollments: [{ courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', source: 'ADMIN' }],
  coachSubjects: ['MATHEMATIQUES'],
});

const ALREADY_AUTO_ROW = row({
  id: 'already-auto',
  subjects: ['NSI'],
  enrollments: [{ courseKey: 'eds-nsi-premiere', kind: 'SPECIALTY', source: 'ADMIN' }],
  coachSubjects: ['NSI'],
  courseScopeState: 'BACKFILL_AUTO',
  academicCourseKeys: ['eds-nsi-premiere'],
});

describe('planBackfill', () => {
  it('classe un candidat unique en BACKFILL_AUTO et marque la ligne changée', () => {
    const summary = planBackfill([AUTO_ROW]);
    expect(summary.scanned).toBe(1);
    expect(summary.auto).toBe(1);
    expect(summary.unresolved).toBe(0);
    expect(summary.ambiguous).toBe(0);
    expect(summary.rows[0]).toMatchObject({
      assignmentId: 'auto',
      nextState: 'BACKFILL_AUTO',
      nextCourseKeys: ['eds-nsi-premiere'],
      changed: true,
    });
  });

  it('classe zéro candidat en BACKFILL_UNRESOLVED — déjà l’état par défaut, aucun changement', () => {
    const summary = planBackfill([UNRESOLVED_ROW]);
    expect(summary.unresolved).toBe(1);
    expect(summary.rows[0]).toMatchObject({
      nextState: 'BACKFILL_UNRESOLVED',
      nextCourseKeys: [],
      changed: false,
    });
  });

  it('classe plusieurs candidats en BACKFILL_AMBIGUOUS sans jamais choisir — fixture Première maths', () => {
    const summary = planBackfill([AMBIGUOUS_ROW]);
    expect(summary.ambiguous).toBe(1);
    expect(summary.rows[0]).toMatchObject({
      nextState: 'BACKFILL_AMBIGUOUS',
      nextCourseKeys: [],
      changed: true,
    });
  });

  it('ne marque aucun changement pour une ligne déjà correctement classée BACKFILL_AUTO', () => {
    const summary = planBackfill([ALREADY_AUTO_ROW]);
    expect(summary.changed).toBe(0);
    expect(summary.rows[0]!.changed).toBe(false);
  });

  it('agrège plusieurs lignes indépendamment', () => {
    const summary = planBackfill([AUTO_ROW, UNRESOLVED_ROW, AMBIGUOUS_ROW, ALREADY_AUTO_ROW]);
    expect(summary.scanned).toBe(4);
    expect(summary.auto).toBe(2);
    expect(summary.unresolved).toBe(1);
    expect(summary.ambiguous).toBe(1);
    expect(summary.changed).toBe(2);
  });
});

function createFakePort(initialRows: readonly CandidateAssignmentRow[]) {
  let rows = [...initialRows];
  const applyDecision = jest.fn(async (decision: { assignmentId: string; nextState: string; nextCourseKeys: readonly string[] }) => {
    rows = rows.map((existing) => (existing.id === decision.assignmentId
      ? { ...existing, courseScopeState: decision.nextState as CandidateAssignmentRow['courseScopeState'], academicCourseKeys: [...decision.nextCourseKeys] }
      : existing));
  });
  const port: BackfillAssignmentCourseKeysPort = {
    loadCandidateAssignments: jest.fn(async () => rows),
    applyDecision,
  };
  return port;
}

describe('runBackfill', () => {
  it('dry-run: rapporte sans jamais écrire', async () => {
    const port = createFakePort([AUTO_ROW, AMBIGUOUS_ROW]);
    const summary = await runBackfill(port, { apply: false });
    expect(summary.auto).toBe(1);
    expect(summary.ambiguous).toBe(1);
    expect(port.applyDecision).not.toHaveBeenCalled();
  });

  it('--apply: écrit uniquement les lignes changées, jamais une clé devinée pour AMBIGUOUS/UNRESOLVED', async () => {
    const port = createFakePort([AUTO_ROW, UNRESOLVED_ROW, AMBIGUOUS_ROW, ALREADY_AUTO_ROW]);
    await runBackfill(port, { apply: true });

    expect(port.applyDecision).toHaveBeenCalledTimes(2);
    expect(port.applyDecision).toHaveBeenCalledWith({
      assignmentId: 'auto',
      nextState: 'BACKFILL_AUTO',
      nextCourseKeys: ['eds-nsi-premiere'],
    });
    expect(port.applyDecision).toHaveBeenCalledWith({
      assignmentId: 'ambiguous',
      nextState: 'BACKFILL_AMBIGUOUS',
      nextCourseKeys: [],
    });
  });

  it('est idempotent: une deuxième exécution --apply ne réécrit plus rien', async () => {
    const port = createFakePort([AUTO_ROW, UNRESOLVED_ROW, AMBIGUOUS_ROW]);
    await runBackfill(port, { apply: true });
    (port.applyDecision as jest.Mock).mockClear();
    (port.loadCandidateAssignments as jest.Mock).mockClear();

    const secondSummary = await runBackfill(port, { apply: true });

    expect(port.applyDecision).not.toHaveBeenCalled();
    expect(secondSummary.changed).toBe(0);
    expect(secondSummary.auto).toBe(1);
    expect(secondSummary.ambiguous).toBe(1);
    expect(secondSummary.unresolved).toBe(1);
  });
});

describe('main', () => {
  it('refuse un argument inconnu ou dupliqué', async () => {
    const stderr: string[] = [];
    await expect(main(['--bogus'], { port: createFakePort([]), stderr: (l) => stderr.push(l) })).resolves.toBe(2);
    expect(stderr).toEqual(['Usage: tsx scripts/core/backfill-assignment-course-keys.ts [--apply]']);

    const stderr2: string[] = [];
    await expect(main(['--apply', '--apply'], { port: createFakePort([]), stderr: (l) => stderr2.push(l) })).resolves.toBe(2);
  });

  it('mode dry-run par défaut: n’écrit rien et rapporte les compteurs', async () => {
    const port = createFakePort([AUTO_ROW, AMBIGUOUS_ROW, UNRESOLVED_ROW]);
    const stdout: string[] = [];
    const code = await main([], { port, stdout: (l) => stdout.push(l) });
    expect(code).toBe(0);
    expect(port.applyDecision).not.toHaveBeenCalled();
    const parsed = JSON.parse(stdout[0]!);
    expect(parsed).toMatchObject({
      event: 'ASSIGNMENT_COURSE_SCOPE_BACKFILL',
      mode: 'DRY_RUN',
      scanned: 3,
      auto: 1,
      ambiguous: 1,
      unresolved: 1,
    });
  });

  it('--apply écrit les décisions et rapporte le mode APPLY', async () => {
    const port = createFakePort([AUTO_ROW]);
    const stdout: string[] = [];
    const code = await main(['--apply'], { port, stdout: (l) => stdout.push(l) });
    expect(code).toBe(0);
    expect(port.applyDecision).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(stdout[0]!);
    expect(parsed).toMatchObject({ mode: 'APPLY', changed: 1 });
  });

  it('rapporte un échec sans faire planter le process', async () => {
    const port: BackfillAssignmentCourseKeysPort = {
      loadCandidateAssignments: jest.fn().mockRejectedValue(new Error('BOOM')),
      applyDecision: jest.fn(),
    };
    const stderr: string[] = [];
    const code = await main([], { port, stderr: (l) => stderr.push(l) });
    expect(code).toBe(1);
    expect(JSON.parse(stderr[0]!)).toMatchObject({
      event: 'ASSIGNMENT_COURSE_SCOPE_BACKFILL_FAILED',
      code: 'BOOM',
    });
  });
});
