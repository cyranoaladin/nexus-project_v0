import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { QuestionEvidence } from '@/lib/bilans/render/question-evidence';
import type { TeacherDossierDocument, TeacherDossierPdfResult } from '@/lib/bilans/teacher-dossier/render';
import {
  buildStaffTeacherDossierDocument,
  listStaffTeacherDossierGroups,
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
    revisions: [{ content: { NEXUS: { identity: {} } }, scoreSnapshot: { result: {} } }],
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
});

describe('listStaffTeacherDossierGroups', () => {
  it('rejects a non-staff actor', async () => {
    await expect(listStaffTeacherDossierGroups(
      { userId: 'user-1', role: 'ELEVE' },
      { reportArtifact: { findMany: jest.fn() }, jobOutbox: { findMany: jest.fn() }, teacherBriefAttempt: { findMany: jest.fn() } } as never,
    )).rejects.toEqual(expect.objectContaining<Partial<StaffTeacherDossierError>>({ code: 'NOT_FOUND' }));
  });

  it('groups by subject and level, with distinct, non-ambiguous counters (§12 de l’incident P0)', async () => {
    const findMany = jest.fn(async () => [
      // MATHEMATIQUES/TERMINALE : un brief APPROVED et courant (snapshot identique).
      {
        id: 'art-approved', assessmentAttempt: { subject: 'MATHEMATIQUES', gradeLevel: 'TERMINALE' },
        revisions: [{ scoreSnapshotId: 'snap-1' }],
        teacherBriefs: [{ status: 'APPROVED', scoreSnapshotId: 'snap-1' }],
      },
      // MATHEMATIQUES/TERMINALE : jamais généré => actionnable.
      {
        id: 'art-never', assessmentAttempt: { subject: 'MATHEMATIQUES', gradeLevel: 'TERMINALE' },
        revisions: [{ scoreSnapshotId: 'snap-2' }],
        teacherBriefs: [],
      },
      // FRANCAIS/SECONDE : PENDING_REVIEW => à relire, jamais "manquant".
      {
        id: 'art-pending', assessmentAttempt: { subject: 'FRANCAIS', gradeLevel: 'SECONDE' },
        revisions: [{ scoreSnapshotId: 'snap-3' }],
        teacherBriefs: [{ status: 'PENDING_REVIEW', scoreSnapshotId: 'snap-3' }],
      },
    ]);
    const jobOutboxFindMany = jest.fn(async () => []);
    const teacherBriefAttemptFindMany = jest.fn(async () => []);
    const database = { reportArtifact: { findMany }, jobOutbox: { findMany: jobOutboxFindMany }, teacherBriefAttempt: { findMany: teacherBriefAttemptFindMany } };

    const groups = await listStaffTeacherDossierGroups({ userId: 'user-1', role: 'ADMIN' }, database as never);

    const maths = groups.find((g) => g.subject === 'MATHEMATIQUES' && g.level === 'TERMINALE')!;
    expect(maths.eligibleCount).toBe(2);
    expect(maths.approvedCount).toBe(1);
    expect(maths.toGenerateCount).toBe(1);
    expect(maths.completenessTier).toBe('ENRICHI_SECURISE_PARTIEL');

    const francais = groups.find((g) => g.subject === 'FRANCAIS' && g.level === 'SECONDE')!;
    expect(francais.eligibleCount).toBe(1);
    expect(francais.toReviewCount).toBe(1);
    expect(francais.toGenerateCount).toBe(0);
    expect(francais.approvedCount).toBe(0);
  });
});
