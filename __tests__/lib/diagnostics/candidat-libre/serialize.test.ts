jest.mock('server-only', () => ({}));

import { serializeCandidateDiagnostic } from '@/lib/diagnostics/candidat-libre/serialize.server';
import { canViewModuleDetail, isDocumentVisibleToViewer } from '@/lib/diagnostics/candidat-libre/access.server';

/**
 * Exhaustive cross-audience field matrix for the shared diagnostic view.
 *
 * `serializeCandidateDiagnostic` backs GET/PATCH routes reachable by both the
 * ELEVE and PARENT portals for the same diagnostic (a minor's record). This
 * suite asserts the *exact* key set and *exact* values returned per audience,
 * not just presence/absence of the two fields known to have leaked — a new
 * field added later without updating the allow-list here fails the test,
 * even if it forgets to redact.
 */

function buildDiagnostic() {
  return {
    id: 'diag-1',
    diagnosticKey: 'BAC_GENERAL_CANDIDAT_INDIVIDUEL_2027',
    definitionVersion: '2026.08.05-v1',
    status: 'ACTIVE',
    targetSession: 2027,
    student: {
      id: 'student-1',
      school: 'Lycée Test',
      gradeLevel: 'TERMINALE',
      user: { firstName: 'A', lastName: 'B', email: 'a@b.test' },
    },
    modules: [
      {
        moduleKey: 'mathematiques',
        audience: 'ELEVE',
        status: 'AUTO_SCORED',
        currentQuestionIndex: 28,
        elapsedMs: 1000,
        definitionSnapshot: { questions: new Array(28) },
        submittedAt: new Date('2026-08-06T10:00:00Z'),
        startedAt: new Date('2026-08-06T09:00:00Z'),
        availableAt: null,
        autoScore: { points: 20, maxPoints: 28, percentage: 71.4, evidence: [{ questionId: 'math-01', status: 'CORRECT' }] },
        reviewSummary: 'Bon niveau global.',
      },
      {
        moduleKey: 'questionnaire-parent',
        audience: 'PARENT',
        status: 'AUTO_SCORED',
        currentQuestionIndex: 22,
        elapsedMs: 500,
        definitionSnapshot: { questions: new Array(22) },
        submittedAt: new Date('2026-08-06T11:00:00Z'),
        startedAt: new Date('2026-08-06T10:30:00Z'),
        availableAt: null,
        autoScore: { points: 15, maxPoints: 22, percentage: 68.2, evidence: [{ questionId: 'parent-01', status: 'CORRECT' }] },
        reviewSummary: 'Contexte familial favorable.',
      },
    ],
    documents: [
      {
        id: 'doc-identity',
        category: 'IDENTITY',
        originalName: 'cni.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        status: 'ACCEPTED',
        reviewNote: null,
        createdAt: new Date('2026-08-06T08:30:00Z'),
      },
      {
        id: 'doc-written-copy',
        category: 'WRITTEN_COPY',
        originalName: 'dissertation.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2000,
        status: 'ACCEPTED',
        reviewNote: null,
        createdAt: new Date('2026-08-06T08:45:00Z'),
      },
      {
        id: 'doc-oral',
        category: 'ORAL_RECORDING',
        originalName: 'grand-oral.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 3000,
        status: 'ACCEPTED',
        reviewNote: null,
        createdAt: new Date('2026-08-06T08:50:00Z'),
      },
    ],
    studentConsentAt: null,
    parentConsentAt: null,
    submittedAt: null,
    retentionDueAt: null,
    createdAt: new Date('2026-08-06T08:00:00Z'),
    updatedAt: new Date('2026-08-06T08:00:00Z'),
  };
}

// Every field on a module view, and whether it's allowed to carry real
// content when the module's audience differs from the viewer's own.
// `true` = must survive redaction (status/progress-shaped, never content).
// `false` = must be nulled out when the module isn't the viewer's own audience.
const MODULE_FIELD_KEYS = ['key', 'status', 'progress', 'startedAt', 'submittedAt', 'availableAt', 'elapsedMs', 'autoScore', 'reviewSummary'] as const;
const MODULE_CROSS_AUDIENCE_SAFE_FIELDS = new Set(['key', 'status', 'progress', 'startedAt', 'submittedAt', 'availableAt', 'elapsedMs']);
const MODULE_CROSS_AUDIENCE_REDACTED_FIELDS = new Set(['autoScore', 'reviewSummary']);

describe('serializeCandidateDiagnostic — exhaustive audience matrix', () => {
  it('module view exposes exactly the documented field set (no undocumented field can slip through)', () => {
    const view = serializeCandidateDiagnostic(buildDiagnostic(), 'ELEVE');
    for (const moduleView of view.modules) {
      expect(Object.keys(moduleView).sort()).toEqual([...MODULE_FIELD_KEYS].sort());
    }
    // every field is classified as either safe-to-cross or must-be-redacted — none left unclassified
    expect(new Set([...MODULE_CROSS_AUDIENCE_SAFE_FIELDS, ...MODULE_CROSS_AUDIENCE_REDACTED_FIELDS])).toEqual(new Set(MODULE_FIELD_KEYS));
  });

  it.each(['ELEVE', 'PARENT'] as const)('%s viewer: cross-audience module keeps only status-shaped fields, redacts content', (viewer) => {
    const view = serializeCandidateDiagnostic(buildDiagnostic(), viewer);
    const otherAudience = viewer === 'ELEVE' ? 'questionnaire-parent' : 'mathematiques';
    const crossModule = view.modules.find((m) => m.key === otherAudience)!;

    for (const field of MODULE_CROSS_AUDIENCE_REDACTED_FIELDS) {
      expect((crossModule as any)[field]).toBeNull();
    }
    for (const field of MODULE_CROSS_AUDIENCE_SAFE_FIELDS) {
      expect((crossModule as any)[field]).not.toBeUndefined();
    }
  });

  it.each(['ELEVE', 'PARENT'] as const)('%s viewer: own-audience module keeps full detail', (viewer) => {
    const view = serializeCandidateDiagnostic(buildDiagnostic(), viewer);
    const ownKey = viewer === 'ELEVE' ? 'mathematiques' : 'questionnaire-parent';
    const ownModule = view.modules.find((m) => m.key === ownKey)!;

    expect(ownModule.autoScore).not.toBeNull();
    expect(ownModule.reviewSummary).not.toBeNull();
  });

  // Arbitrated 2026-08-07: canEditAudience (WRITE) and read visibility are
  // distinct rules — a COACH cannot edit either module but CAN read the
  // ELEVE-audience one (their working material); questionnaire-parent stays
  // out of reach. ADMIN and internal callers (no role) keep full access
  // everywhere, unchanged. ASSISTANTE is new here: no academic detail on
  // any module, stricter than the "staff sees everything" default this
  // suite used to assert.
  it('COACH sees full detail on the ELEVE-audience module but not on questionnaire-parent', () => {
    const view = serializeCandidateDiagnostic(buildDiagnostic(), 'COACH');
    const eleveModule = view.modules.find((m) => m.key === 'mathematiques')!;
    const parentModule = view.modules.find((m) => m.key === 'questionnaire-parent')!;
    expect(eleveModule.autoScore).not.toBeNull();
    expect(eleveModule.reviewSummary).not.toBeNull();
    expect(parentModule.autoScore).toBeNull();
    expect(parentModule.reviewSummary).toBeNull();
  });

  it('ADMIN and internal callers (no role) see full detail on every module', () => {
    for (const viewer of ['ADMIN', undefined] as const) {
      const view = serializeCandidateDiagnostic(buildDiagnostic(), viewer);
      expect(view.modules.every((m) => m.autoScore !== null && m.reviewSummary !== null)).toBe(true);
    }
  });

  it('ASSISTANTE sees no academic detail on any module', () => {
    const view = serializeCandidateDiagnostic(buildDiagnostic(), 'ASSISTANTE');
    expect(view.modules.every((m) => m.autoScore === null && m.reviewSummary === null)).toBe(true);
  });

  it('PARENT viewer never receives the student academic production documents (written copy, oral recording)', () => {
    const view = serializeCandidateDiagnostic(buildDiagnostic(), 'PARENT');
    const categories = view.documents.map((d) => d.category).sort();
    expect(categories).toEqual(['IDENTITY']);
  });

  it('ELEVE viewer receives both their own productions and shared administrative documents', () => {
    const view = serializeCandidateDiagnostic(buildDiagnostic(), 'ELEVE');
    const categories = view.documents.map((d) => d.category).sort();
    expect(categories).toEqual(['IDENTITY', 'ORAL_RECORDING', 'WRITTEN_COPY']);
  });

  it('COACH, ADMIN and internal callers see every document regardless of category', () => {
    for (const viewer of ['COACH', 'ADMIN', undefined] as const) {
      const view = serializeCandidateDiagnostic(buildDiagnostic(), viewer);
      expect(view.documents).toHaveLength(3);
    }
  });

  it('ASSISTANTE never receives the student academic production documents, same boundary as PARENT', () => {
    const view = serializeCandidateDiagnostic(buildDiagnostic(), 'ASSISTANTE');
    const categories = view.documents.map((d) => d.category).sort();
    expect(categories).toEqual(['IDENTITY']);
  });
});

describe('canViewModuleDetail — read-visibility matrix, single source of truth for 4 routes', () => {
  const ROLES = ['ELEVE', 'PARENT', 'COACH', 'ADMIN', 'ASSISTANTE'] as const;
  const AUDIENCES = ['ELEVE', 'PARENT'] as const;

  // One explicit expectation per (role, audience) pair — a role or audience
  // added later without updating this table fails type-checking on the
  // ROLES/AUDIENCES arrays above before it can silently pass a test.
  const EXPECTED: Record<(typeof ROLES)[number], Record<(typeof AUDIENCES)[number], boolean>> = {
    ELEVE: { ELEVE: true, PARENT: false },
    PARENT: { ELEVE: false, PARENT: true },
    COACH: { ELEVE: true, PARENT: false },
    ADMIN: { ELEVE: true, PARENT: true },
    ASSISTANTE: { ELEVE: false, PARENT: false },
  };

  for (const role of ROLES) {
    for (const audience of AUDIENCES) {
      it(`${role} on a ${audience}-audience module → ${EXPECTED[role][audience]}`, () => {
        expect(canViewModuleDetail(role as any, audience)).toBe(EXPECTED[role][audience]);
      });
    }
  }
});

describe('isDocumentVisibleToViewer — category × audience matrix', () => {
  const ALL_CATEGORIES = [
    'IDENTITY', 'CYCLADES', 'FRENCH_BAC_TRANSCRIPT', 'TUNISIAN_BAC_TRANSCRIPT',
    'SCHOOL_REPORT', 'EXAM_ACCOMMODATION', 'WRITTEN_COPY', 'ORAL_RECORDING', 'OTHER',
  ] as const;
  const STUDENT_ACADEMIC_CATEGORIES = new Set(['WRITTEN_COPY', 'ORAL_RECORDING']);

  it.each(ALL_CATEGORIES)('ELEVE always sees category %s', (category) => {
    expect(isDocumentVisibleToViewer(category, 'ELEVE')).toBe(true);
  });

  it.each(ALL_CATEGORIES)('COACH/ADMIN always see category %s — student productions are their working material', (category) => {
    expect(isDocumentVisibleToViewer(category, 'COACH')).toBe(true);
    expect(isDocumentVisibleToViewer(category, 'ADMIN')).toBe(true);
  });

  it.each(ALL_CATEGORIES)('PARENT sees category %s only when it is not a student academic production', (category) => {
    expect(isDocumentVisibleToViewer(category, 'PARENT')).toBe(!STUDENT_ACADEMIC_CATEGORIES.has(category));
  });

  it.each(ALL_CATEGORIES)('ASSISTANTE sees category %s only when it is not a student academic production — same boundary as PARENT', (category) => {
    expect(isDocumentVisibleToViewer(category, 'ASSISTANTE')).toBe(!STUDENT_ACADEMIC_CATEGORIES.has(category));
  });
});
