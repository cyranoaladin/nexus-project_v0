import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { QuestionEvidence } from '@/lib/bilans/render/question-evidence';
import type { TeacherDossierDocument, TeacherDossierPdfResult } from '@/lib/bilans/teacher-dossier/render';
import {
  buildStaffTeacherDossierDocument,
  listStaffTeacherDossierGroups,
  selectApprovedBrief,
  StaffTeacherDossierError,
  type DossierCandidateRow,
} from '@/lib/bilans/staff/teacher-dossier-service';

function factSheet(alias: string, bankSlug = 'entree-terminale-maths-v1'): FactSheet {
  return {
    engineVersion: '1.1.0', bankSlug, bankVersion: 1, student: { alias, level: 'TERMINALE' },
    globalScore: 50, coverage: 100, calibrationIndex: 70, domains: [], flags: [], groupBand: 'RENFORCEMENT', nodes: [],
  };
}

function evidence(): QuestionEvidence {
  return { version: 'question-evidence.v1', packSlug: 'entree-terminale-maths-v1', packVersion: 1, confidenceLabels: ['a', 'b', 'c', 'd'], items: [] };
}

function row(id: string, firstName: string, lastName: string, packId = 'entree-terminale-maths-v1'): DossierCandidateRow {
  return {
    id, status: 'PENDING_REVIEW',
    assessmentAttempt: { answers: {}, assessmentPackId: packId, assessmentPackVersion: '1', assessmentPackChecksum: 'checksum' },
    student: { user: { firstName, lastName } },
    revisions: [{ content: { NEXUS: { identity: {} } }, scoreSnapshotId: 'snap-curr', scoreSnapshot: { result: {} } }],
    teacherBriefs: [],
  } as unknown as DossierCandidateRow;
}

function dependencies(rows: readonly DossierCandidateRow[]) {
  return {
    findCandidates: jest.fn(async () => rows),
    resolvePack: jest.fn(() => ({ pack: { slug: 'entree-terminale-maths-v1', version: 1, level: 'TERMINALE', subject: 'MATHS' } })),
    loadCatalog: jest.fn(() => null),
    buildEvidence: jest.fn(() => evidence()),
    parseFactSheet: jest.fn((_result: unknown, content: { alias?: string }) => factSheet(content?.alias ?? 'ELEVE_X')),
    renderHtml: jest.fn((_doc: TeacherDossierDocument) => '<html>dossier</html>'),
    renderPdf: jest.fn(async (_doc: TeacherDossierDocument): Promise<TeacherDossierPdfResult> => ({ status: 'AVAILABLE', html: '<html></html>', pdf: Buffer.from('%PDF-test') })),
    now: () => new Date('2026-08-14T08:00:00.000Z'),
  };
}

const baseInput = { userId: 'user-1', role: 'ASSISTANTE' as const, subject: 'MATHEMATIQUES' as const, level: 'TERMINALE' as const, format: 'html' as const };

describe('buildStaffTeacherDossierDocument', () => {
  it('rejects a non-staff actor before querying anything', async () => {
    const deps = dependencies([row('a', 'Yasmine', 'Ben Ali')]);
    await expect(buildStaffTeacherDossierDocument({ ...baseInput, userId: 'user-1', role: 'COACH' }, deps as never))
      .rejects.toEqual(expect.objectContaining<Partial<StaffTeacherDossierError>>({ code: 'NOT_FOUND' }));
    expect(deps.findCandidates).not.toHaveBeenCalled();
  });

  it('rejects when no bilan exists for the subject/level', async () => {
    const deps = dependencies([]);
    await expect(buildStaffTeacherDossierDocument(baseInput, deps as never))
      .rejects.toEqual(expect.objectContaining<Partial<StaffTeacherDossierError>>({ code: 'NOT_FOUND' }));
  });

  it('builds the dossier from every student sharing the majority pack', async () => {
    const rows = [row('a', 'Yasmine', 'Ben Ali'), row('b', 'Karim', 'Trabelsi'), row('c', 'Nour', 'Gharbi')];
    const deps = dependencies(rows);
    await buildStaffTeacherDossierDocument(baseInput, deps as never);
    const doc = deps.renderHtml.mock.calls[0][0];
    expect(doc.students).toHaveLength(3);
    expect(doc.students.map((student: { displayName: string }) => student.displayName)).toEqual(['Yasmine Ben Ali', 'Karim Trabelsi', 'Nour Gharbi']);
    expect(doc.excludedStudents).toEqual([]);
  });

  it('excludes a minority-pack student by name and reason instead of dropping it silently', async () => {
    const rows = [row('a', 'Yasmine', 'Ben Ali'), row('b', 'Karim', 'Trabelsi'), row('c', 'Nour', 'Gharbi', 'other-pack-v1')];
    const deps = dependencies(rows);
    await buildStaffTeacherDossierDocument(baseInput, deps as never);
    const doc = deps.renderHtml.mock.calls[0][0];
    expect(doc.students).toHaveLength(2);
    expect(doc.excludedStudents).toEqual([{ displayName: 'Nour Gharbi', reason: expect.stringContaining('pack différent') }]);
  });

  it('excludes a student whose evidence cannot be rebuilt, with a stated reason', async () => {
    const rows = [row('a', 'Yasmine', 'Ben Ali'), row('b', 'Karim', 'Trabelsi'), row('c', 'Nour', 'Gharbi')];
    const deps = dependencies(rows);
    deps.buildEvidence.mockImplementationOnce(() => { throw new Error('REPORT_EVIDENCE_PACK_MISMATCH'); });
    await buildStaffTeacherDossierDocument(baseInput, deps as never);
    const doc = deps.renderHtml.mock.calls[0][0];
    expect(doc.students).toHaveLength(2);
    expect(doc.excludedStudents[0].displayName).toBe('Yasmine Ben Ali');
  });

  it('passes brief:null for a student with no generated brief, never a fabricated one', async () => {
    const deps = dependencies([row('a', 'Yasmine', 'Ben Ali'), row('b', 'Karim', 'Trabelsi'), row('c', 'Nour', 'Gharbi')]);
    await buildStaffTeacherDossierDocument(baseInput, deps as never);
    const doc = deps.renderHtml.mock.calls[0][0];
    expect(doc.students.every((student: { brief: unknown }) => student.brief === null)).toBe(true);
  });

  it('leaves sessionPlan null and still renders when the pack has no CPS catalog', async () => {
    const deps = dependencies([row('a', 'Yasmine', 'Ben Ali'), row('b', 'Karim', 'Trabelsi'), row('c', 'Nour', 'Gharbi')]);
    await buildStaffTeacherDossierDocument(baseInput, deps as never);
    const doc = deps.renderHtml.mock.calls[0][0];
    expect(doc.sessionPlan).toBeNull();
  });

  it('returns UNAVAILABLE from the PDF renderer as a thrown, typed error', async () => {
    const deps = dependencies([row('a', 'Yasmine', 'Ben Ali'), row('b', 'Karim', 'Trabelsi'), row('c', 'Nour', 'Gharbi')]);
    deps.renderPdf.mockResolvedValueOnce({ status: 'UNAVAILABLE' as const, html: '<html></html>', errorCode: 'TEACHER_DOSSIER_PDF_RENDER_FAILED' as const });
    await expect(buildStaffTeacherDossierDocument({ ...baseInput, format: 'pdf' }, deps as never))
      .rejects.toEqual(expect.objectContaining<Partial<StaffTeacherDossierError>>({ code: 'TEACHER_DOSSIER_PDF_RENDER_FAILED' }));
  });

  it('ignores PENDING_REVIEW, CORRECTION_REQUESTED, and SUPERSEDED briefs', async () => {
    const candidateRow = row('a', 'Yasmine', 'Ben Ali');
    candidateRow.revisions = [{ content: { NEXUS: { identity: {} } }, scoreSnapshotId: 'snap-1', scoreSnapshot: { result: {} } }] as never;
    candidateRow.teacherBriefs = [
      { status: 'PENDING_REVIEW', scoreSnapshotId: 'snap-1', content: {} },
      { status: 'CORRECTION_REQUESTED', scoreSnapshotId: 'snap-1', content: {} },
      { status: 'SUPERSEDED', scoreSnapshotId: 'snap-1', content: {} },
    ] as never;
    const deps = dependencies([candidateRow]);
    await buildStaffTeacherDossierDocument(baseInput, deps as never);
    const doc = deps.renderHtml.mock.calls[0][0];
    expect(doc.students[0].brief).toBeNull();
  });

  it('ignores APPROVED brief linked to an obsolete scoreSnapshot', async () => {
    const candidateRow = row('a', 'Yasmine', 'Ben Ali');
    candidateRow.revisions = [{ content: { NEXUS: { identity: {} } }, scoreSnapshotId: 'snap-new', scoreSnapshot: { result: {} } }] as never;
    candidateRow.teacherBriefs = [
      {
        status: 'APPROVED',
        scoreSnapshotId: 'snap-old',
        content: {
          summary: 'Brief old',
          domaines: [{ domainId: 'second-degre', erreursTypiques: [], prerequisAVerifier: [], activite: { titre: 'a', objectif: 'b', materiel: 'c', deroule: [], differenciation: 'd' }, indicateurProgres: 'e' }],
        },
      },
    ] as never;
    const deps = dependencies([candidateRow]);
    await buildStaffTeacherDossierDocument(baseInput, deps as never);
    const doc = deps.renderHtml.mock.calls[0][0];
    expect(doc.students[0].brief).toBeNull();
  });

  it('includes APPROVED current brief and attaches safety marker', async () => {
    const candidateRow = row('a', 'Yasmine', 'Ben Ali');
    candidateRow.revisions = [{ content: { NEXUS: { identity: {} } }, scoreSnapshotId: 'snap-curr', scoreSnapshot: { result: {} } }] as never;
    candidateRow.teacherBriefs = [
      {
        status: 'APPROVED',
        scoreSnapshotId: 'snap-curr',
        content: {
          version: 'teacher-brief.v2',
          domaines: [
            {
              domainId: 'second-degre',
              erreursTypiques: [{ constat: 'Constat valide 1', origine: 'Origine valide 1', itemIds: [] }],
              prerequisAVerifier: ['Prérequis 1'],
              activite: {
                titre: 'Titre 1', objectif: 'Objectif 1', materiel: 'Matériel 1',
                deroule: [
                  { nom: 'Phase 1', dureeMin: 10, consigne: 'Consigne 1' },
                  { nom: 'Phase 2', dureeMin: 10, consigne: 'Consigne 2' },
                  { nom: 'Phase 3', dureeMin: 10, consigne: 'Consigne 3' },
                ],
                differenciation: 'Différenciation 1',
              },
              indicateurProgres: 'Indicateur 1',
            },
            {
              domainId: 'trigonometrie',
              erreursTypiques: [{ constat: 'Constat valide 2', origine: 'Origine valide 2', itemIds: [] }],
              prerequisAVerifier: ['Prérequis 2'],
              activite: {
                titre: 'Titre 2', objectif: 'Objectif 2', materiel: 'Matériel 2',
                deroule: [
                  { nom: 'Phase 1', dureeMin: 10, consigne: 'Consigne 1' },
                  { nom: 'Phase 2', dureeMin: 10, consigne: 'Consigne 2' },
                  { nom: 'Phase 3', dureeMin: 10, consigne: 'Consigne 3' },
                ],
                differenciation: 'Différenciation 2',
              },
              indicateurProgres: 'Indicateur 2',
            },
          ],
        },
      },
    ] as never;
    const deps = dependencies([candidateRow]);
    await buildStaffTeacherDossierDocument(baseInput, deps as never);
    const doc = deps.renderHtml.mock.calls[0][0];
    expect(doc.students[0].brief).not.toBeNull();
    expect(doc.students[0].briefSafetyMarker).toBe('APPROVED_AND_CURRENT_VERIFIED');
  });

  it('selects highest version APPROVED brief matching current scoreSnapshotId (cases A, B, C, D)', async () => {
    const validContent = {
      version: 'teacher-brief.v2',
      domaines: [
        { domainId: 'd1', erreursTypiques: [{ constat: 'Constat 1', origine: 'Origine 1', itemIds: [] }], prerequisAVerifier: ['P1'], activite: { titre: 'T1', objectif: 'O1', materiel: 'M1', deroule: [{ nom: 'P1', dureeMin: 10, consigne: 'C1' }, { nom: 'P2', dureeMin: 10, consigne: 'C2' }, { nom: 'P3', dureeMin: 10, consigne: 'C3' }], differenciation: 'D1' }, indicateurProgres: 'I1' },
        { domainId: 'd2', erreursTypiques: [{ constat: 'Constat 2', origine: 'Origine 2', itemIds: [] }], prerequisAVerifier: ['P2'], activite: { titre: 'T2', objectif: 'O2', materiel: 'M2', deroule: [{ nom: 'P1', dureeMin: 10, consigne: 'C1' }, { nom: 'P2', dureeMin: 10, consigne: 'C2' }, { nom: 'P3', dureeMin: 10, consigne: 'C3' }], differenciation: 'D2' }, indicateurProgres: 'I2' },
      ],
    };

    // Case A: v1 APPROVED current, v2 APPROVED obsolete -> v1 chosen
    const briefsA: Parameters<typeof selectApprovedBrief>[0] = [
      { id: 'b2', version: 2, status: 'APPROVED', scoreSnapshotId: 'snap-old', content: validContent, editedContent: null },
      { id: 'b1', version: 1, status: 'APPROVED', scoreSnapshotId: 'snap-curr', content: validContent, editedContent: null },
    ];
    expect(selectApprovedBrief(briefsA, 'snap-curr')?.id).toBe('b1');

    // Case B: v1 APPROVED obsolete, v2 APPROVED current -> v2 chosen
    const briefsB: Parameters<typeof selectApprovedBrief>[0] = [
      { id: 'b2', version: 2, status: 'APPROVED', scoreSnapshotId: 'snap-curr', content: validContent, editedContent: null },
      { id: 'b1', version: 1, status: 'APPROVED', scoreSnapshotId: 'snap-old', content: validContent, editedContent: null },
    ];
    expect(selectApprovedBrief(briefsB, 'snap-curr')?.id).toBe('b2');

    // Case C: multiple APPROVED current (v1 and v3) -> highest version (v3) chosen
    const briefsC: Parameters<typeof selectApprovedBrief>[0] = [
      { id: 'b3', version: 3, status: 'APPROVED', scoreSnapshotId: 'snap-curr', content: validContent, editedContent: null },
      { id: 'b1', version: 1, status: 'APPROVED', scoreSnapshotId: 'snap-curr', content: validContent, editedContent: null },
    ];
    expect(selectApprovedBrief(briefsC, 'snap-curr')?.id).toBe('b3');

    // Case D: no APPROVED current -> undefined
    const briefsD: Parameters<typeof selectApprovedBrief>[0] = [
      { id: 'b1', version: 1, status: 'APPROVED', scoreSnapshotId: 'snap-other', content: validContent, editedContent: null },
    ];
    expect(selectApprovedBrief(briefsD, 'snap-curr')).toBeUndefined();
  });

  it('handles editedContent legacy cases (valid JSON, free text, invalid schema)', async () => {
    const validContent = {
      version: 'teacher-brief.v2',
      domaines: [
        { domainId: 'd1', erreursTypiques: [{ constat: 'Constat 1', origine: 'Origine 1', itemIds: [] }], prerequisAVerifier: ['P1'], activite: { titre: 'T1', objectif: 'O1', materiel: 'M1', deroule: [{ nom: 'P1', dureeMin: 10, consigne: 'C1' }, { nom: 'P2', dureeMin: 10, consigne: 'C2' }, { nom: 'P3', dureeMin: 10, consigne: 'C3' }], differenciation: 'D1' }, indicateurProgres: 'I1' },
        { domainId: 'd2', erreursTypiques: [{ constat: 'Constat 2', origine: 'Origine 2', itemIds: [] }], prerequisAVerifier: ['P2'], activite: { titre: 'T2', objectif: 'O2', materiel: 'M2', deroule: [{ nom: 'P1', dureeMin: 10, consigne: 'C1' }, { nom: 'P2', dureeMin: 10, consigne: 'C2' }, { nom: 'P3', dureeMin: 10, consigne: 'C3' }], differenciation: 'D2' }, indicateurProgres: 'I2' },
      ],
    };

    // 1. editedContent valid JSON -> parses and uses edited content
    const candidateRowEdited = row('a', 'Yasmine', 'Ben Ali');
    candidateRowEdited.revisions = [{ content: { NEXUS: { identity: {} } }, scoreSnapshotId: 'snap-curr', scoreSnapshot: { result: {} } }] as never;
    candidateRowEdited.teacherBriefs = [{
      status: 'APPROVED',
      scoreSnapshotId: 'snap-curr',
      content: validContent,
      editedContent: JSON.stringify(validContent),
    }] as never;
    const deps1 = dependencies([candidateRowEdited]);
    await buildStaffTeacherDossierDocument(baseInput, deps1 as never);
    expect(deps1.renderHtml.mock.calls[0][0].students[0].brief).not.toBeNull();

    // 2. editedContent free text -> return null brief (fallback to deterministic)
    const candidateRowFreeText = row('b', 'Karim', 'Trabelsi');
    candidateRowFreeText.revisions = [{ content: { NEXUS: { identity: {} } }, scoreSnapshotId: 'snap-curr', scoreSnapshot: { result: {} } }] as never;
    candidateRowFreeText.teacherBriefs = [{
      status: 'APPROVED',
      scoreSnapshotId: 'snap-curr',
      content: validContent,
      editedContent: 'Texte libre rédigé manuellement sans JSON SENTINELLE-ERR-1234',
    }] as never;
    const deps2 = dependencies([candidateRowFreeText]);
    await buildStaffTeacherDossierDocument(baseInput, deps2 as never);
    expect(deps2.renderHtml.mock.calls[0][0].students[0].brief).toBeNull();
  });
});

describe('listStaffTeacherDossierGroups', () => {
  it('rejects a non-staff actor', async () => {
    await expect(listStaffTeacherDossierGroups({ userId: 'user-1', role: 'ELEVE' }, { reportArtifact: { findMany: jest.fn() } } as never))
      .rejects.toEqual(expect.objectContaining<Partial<StaffTeacherDossierError>>({ code: 'NOT_FOUND' }));
  });

  it('groups by subject and level, counting bilans without a brief', async () => {
    const findMany = jest.fn(async () => [
      { assessmentAttempt: { subject: 'MATHEMATIQUES', gradeLevel: 'TERMINALE' }, teacherBriefs: [] },
      { assessmentAttempt: { subject: 'MATHEMATIQUES', gradeLevel: 'TERMINALE' }, teacherBriefs: [{ id: 'brief-1' }] },
      { assessmentAttempt: { subject: 'FRANCAIS', gradeLevel: 'SECONDE' }, teacherBriefs: [] },
    ]);
    const groups = await listStaffTeacherDossierGroups({ userId: 'user-1', role: 'ADMIN' }, { reportArtifact: { findMany } } as never);
    expect(groups).toEqual([
      { subject: 'FRANCAIS', level: 'SECONDE', count: 1, briefsMissing: 1 },
      { subject: 'MATHEMATIQUES', level: 'TERMINALE', count: 2, briefsMissing: 1 },
    ]);
  });
});
