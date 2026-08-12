import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  listRecentReportReviews,
  listPendingReportReviews,
  rejectPendingReport,
  validateAndPublishPendingReport,
  previewPendingReport,
  renderPendingReportPdf,
} from '@/lib/bilans/staff/review-service';
import { BilanReportServiceError } from '@/lib/bilans/core/report-service';

const revision = {
  id: 'revision-1',
  status: 'PENDING_REVIEW',
  validationFailures: [] as string[],
  reportPackId: 'fixture-pack',
  reportPackVersion: '1',
  content: { ELEVE: {}, PARENTS: {}, NEXUS: {} },
  createdAt: new Date('2026-08-02T10:00:00.000Z'),
  reportArtifact: {
    id: 'artifact-1',
    assessmentAttemptId: 'attempt-1',
    studentId: 'student-1',
    status: 'PENDING_REVIEW',
    assessmentAttempt: { provenance: 'SAISIE_PAPIER' },
    student: {
      user: { firstName: 'Élise', lastName: 'Ben Salah' },
      parent: {
        user: {
          id: 'parent-user-1',
          email: 'parent@example.test',
          firstName: 'Sonia',
          lastName: 'Ben Salah',
          phoneNormalized: '99192829',
        },
      },
    },
    transmissions: [],
  },
  reviews: [],
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    listPending: jest.fn().mockResolvedValue([revision]),
    listRecent: jest.fn().mockResolvedValue([revision]),
    findPending: jest.fn().mockResolvedValue(revision),
    resolvePack: jest.fn().mockReturnValue({
      pack: { slug: 'fixture-pack', version: 1, level: 'SECONDE', subject: 'MATHS' },
    }),
    validate: jest.fn().mockResolvedValue({ status: 'COACH_VALIDATED' }),
    publish: jest.fn().mockResolvedValue({ status: 'PUBLISHED' }),
    preview: jest.fn().mockResolvedValue({ official: false, audiences: [] }),
    renderPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-test')),
    reject: jest.fn().mockResolvedValue({ status: 'COACH_REJECTED' }),
    requestCorrection: jest.fn().mockResolvedValue({ status: 'CORRECTION_REQUESTED' }),
    resumeReview: jest.fn().mockResolvedValue({ status: 'PENDING_REVIEW' }),
    findCorrectionRequested: jest.fn().mockResolvedValue(null),
    notifyParentPublished: jest.fn().mockResolvedValue(undefined),
    now: () => new Date('2026-08-02T11:00:00.000Z'),
    ...overrides,
  };
}

function serviceDependencies(value: ReturnType<typeof dependencies>): never {
  return value as never;
}

describe('staff Canonical report review service', () => {
  test('lists every pending revision whose pack remains enabled -- no assignment filter for an administrative reviewer', async () => {
    const disabled = { ...revision, id: 'revision-off', reportPackId: 'pack-off' };
    const deps = dependencies({
      listPending: jest.fn().mockResolvedValue([revision, disabled]),
      resolvePack: jest.fn((slug: string) => slug === 'fixture-pack' ? { pack: { slug } } : null),
    });

    await expect(listPendingReportReviews({ userId: 'user-assistante', role: 'ASSISTANTE' }, serviceDependencies(deps)))
      .resolves.toEqual([revision]);
  });

  test.each(['ELEVE', 'PARENT', 'COACH', 'ADMIN'])('returns NOT_FOUND to role %s -- coach is out of the review circuit', async (role) => {
    await expect(listPendingReportReviews({ userId: 'user-1', role }, serviceDependencies(dependencies())))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('projects recent pending, published and rejected revisions as readable cards', async () => {
    const published = {
      ...revision,
      id: 'revision-published',
      status: 'COACH_VALIDATED',
      reportArtifact: { ...revision.reportArtifact, status: 'PUBLISHED' },
    };
    const rejected = { ...revision, id: 'revision-rejected', status: 'REJECTED' };
    const deps = dependencies({ listRecent: jest.fn().mockResolvedValue([revision, published, rejected]) });

    await expect(listRecentReportReviews(
      { userId: 'user-assistante', role: 'ASSISTANTE' },
      serviceDependencies(deps),
    )).resolves.toEqual([
      expect.objectContaining({ studentName: 'Élise Ben Salah', displayStatus: 'En attente de diffusion', actionable: true }),
      expect.objectContaining({ studentName: 'Élise Ben Salah', displayStatus: 'Diffusé', actionable: false }),
      expect.objectContaining({ studentName: 'Élise Ben Salah', displayStatus: 'Rejeté', actionable: false }),
    ]);
  });

  test('blocks a review before validation when the student human identity is missing', async () => {
    const missingIdentity = {
      ...revision,
      reportArtifact: {
        ...revision.reportArtifact,
        student: { user: { firstName: null, lastName: null } },
      },
    };
    const deps = dependencies({
      findPending: jest.fn().mockResolvedValue(missingIdentity),
      listRecent: jest.fn().mockResolvedValue([missingIdentity]),
    });

    await expect(validateAndPublishPendingReport({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id, motif: 'Rapport relu intégralement.',
    }, serviceDependencies(deps))).rejects.toMatchObject({
      code: 'REPORT_STUDENT_IDENTITY_REQUIRED',
    });
    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.publish).not.toHaveBeenCalled();

    await expect(listRecentReportReviews(
      { userId: 'user-assistante', role: 'ASSISTANTE' },
      serviceDependencies(deps),
    )).resolves.toEqual([
      expect.objectContaining({
        studentName: 'Identité élève à compléter',
        actionable: false,
        validationFailures: expect.arrayContaining(['Identité élève incomplète : prénom ou nom requis avant rendu.']),
      }),
    ]);
  });

  test('validates then publishes through the report service with reviewer identity and time', async () => {
    const deps = dependencies();

    await expect(validateAndPublishPendingReport({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id, motif: 'Rapport relu intégralement.',
    }, serviceDependencies(deps))).resolves.toMatchObject({ status: 'PUBLISHED' });

    expect(deps.validate).toHaveBeenCalledWith(expect.objectContaining({
      revisionId: revision.id,
      reviewerId: 'user-assistante',
      motif: 'Rapport relu intégralement.',
      reviewedAt: new Date('2026-08-02T11:00:00.000Z'),
    }));
    expect(deps.publish).toHaveBeenCalledWith(expect.objectContaining({ revisionId: revision.id, reviewerId: 'user-assistante' }));
    expect(deps.validate.mock.invocationCallOrder[0]).toBeLessThan(deps.publish.mock.invocationCallOrder[0]);
  });

  test('distingue un bilan prêt dont l’e-mail parent manque et garde sa prévisualisation disponible', async () => {
    const missingEmail = {
      ...revision,
      reportArtifact: {
        ...revision.reportArtifact,
        student: {
          ...revision.reportArtifact.student,
          parent: { user: { email: null } },
        },
      },
    };
    const deps = dependencies({
      listRecent: jest.fn().mockResolvedValue([missingEmail]),
      findPending: jest.fn().mockResolvedValue(missingEmail),
    });

    await expect(listRecentReportReviews(
      { userId: 'user-assistante', role: 'ASSISTANTE' },
      serviceDependencies(deps),
    )).resolves.toEqual([
      expect.objectContaining({
        displayStatus: 'Prêt — e-mail parent manquant',
        parentEmailMissing: true,
        diffusable: false,
        actionable: true,
      }),
    ]);

    await expect(previewPendingReport({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id,
    }, serviceDependencies(deps))).resolves.toMatchObject({ official: false });
    expect(deps.preview).toHaveBeenCalled();
  });

  test('refuse la diffusion sans e-mail avant toute validation ou publication', async () => {
    const missingEmail = {
      ...revision,
      reportArtifact: {
        ...revision.reportArtifact,
        student: {
          ...revision.reportArtifact.student,
          parent: { user: { email: null } },
        },
      },
    };
    const deps = dependencies({ findPending: jest.fn().mockResolvedValue(missingEmail) });

    await expect(validateAndPublishPendingReport({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id, motif: 'Rapport relu intégralement.',
    }, serviceDependencies(deps))).rejects.toMatchObject({ code: 'REPORT_PARENT_EMAIL_REQUIRED' });
    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.publish).not.toHaveBeenCalled();
  });

  test('blocks validationFailures before either validation or publication', async () => {
    const deps = dependencies({
      findPending: jest.fn().mockResolvedValue({ ...revision, validationFailures: ['V2_NUMBER_FORBIDDEN'] }),
    });

    await expect(validateAndPublishPendingReport({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id, motif: 'Ne doit pas passer.',
    }, serviceDependencies(deps))).rejects.toMatchObject({ code: 'REPORT_VALIDATION_FAILURES' });
    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.publish).not.toHaveBeenCalled();
  });

  test('previews without validating, publishing or persisting an artifact', async () => {
    const deps = dependencies();
    await expect(previewPendingReport({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id,
    }, serviceDependencies(deps))).resolves.toMatchObject({ official: false });
    expect(deps.preview).toHaveBeenCalledWith({ revisionId: revision.id });
    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.publish).not.toHaveBeenCalled();
  });

  test.each(['ELEVE', 'PARENTS', 'NEXUS'] as const)('renders the %s PDF only for an assistante and an actionable revision', async (audience) => {
    const deps = dependencies();
    await expect(renderPendingReportPdf({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id, audience,
    }, serviceDependencies(deps))).resolves.toEqual({
      pdf: Buffer.from('%PDF-test'),
      filename: `bilan-nexus-${audience.toLowerCase()}.pdf`,
    });
    expect(deps.renderPdf).toHaveBeenCalledWith({ revisionId: revision.id, audience });
    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.publish).not.toHaveBeenCalled();
  });

  test.each(['PARENT', 'ELEVE'])('does not render a review PDF for role %s', async (role) => {
    const deps = dependencies();
    await expect(renderPendingReportPdf({
      userId: 'user-1', role, revisionId: revision.id, audience: 'ELEVE',
    }, serviceDependencies(deps))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(deps.renderPdf).not.toHaveBeenCalled();
  });

  test('maps a Chromium outage to a review-safe PDF unavailable error', async () => {
    const deps = dependencies({
      renderPdf: jest.fn().mockRejectedValue(new BilanReportServiceError('REPORT_PDF_UNAVAILABLE')),
    });
    await expect(renderPendingReportPdf({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id, audience: 'NEXUS',
    }, serviceDependencies(deps))).rejects.toMatchObject({
      name: 'StaffReviewError',
      code: 'REPORT_PDF_UNAVAILABLE',
    });
  });

  test('rejects through the report service and preserves a non-empty motif', async () => {
    const deps = dependencies();
    await rejectPendingReport({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id, motif: 'Priorité pédagogique incorrecte.',
    }, serviceDependencies(deps));
    expect(deps.reject).toHaveBeenCalledWith(expect.objectContaining({ motif: 'Priorité pédagogique incorrecte.' }));
  });

  test('retries publication for a stranded COACH_VALIDATED revision without re-validating', async () => {
    // A revision reaches COACH_VALIDATED and materialization=null when
    // validateReportRevision() succeeded but publishReportRevision() then
    // threw (e.g. a Chromium render failure) -- the two are separate
    // service calls, not one transaction (see the "Chromium and all other
    // rendering happen before opening the final, short transaction"
    // comment in report-service.ts). Retrying must skip validate (it would
    // fail: its own DB guard only matches status='PENDING_REVIEW') and go
    // straight to publish.
    const stranded = { ...revision, status: 'COACH_VALIDATED' };
    const deps = dependencies({ findPending: jest.fn().mockResolvedValue(stranded) });

    await expect(validateAndPublishPendingReport({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id, motif: 'Nouvelle tentative.',
    }, serviceDependencies(deps))).resolves.toMatchObject({ status: 'PUBLISHED' });

    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.publish).toHaveBeenCalledWith(expect.objectContaining({ revisionId: revision.id, reviewerId: 'user-assistante' }));
  });

  test('lets another assistante request the retry of a stranded validated revision', async () => {
    const stranded = { ...revision, status: 'COACH_VALIDATED' };
    const deps = dependencies({ findPending: jest.fn().mockResolvedValue(stranded) });

    await expect(validateAndPublishPendingReport({
      userId: 'second-assistante', role: 'ASSISTANTE', revisionId: revision.id, motif: 'Reprise après incident PDF.',
    }, serviceDependencies(deps))).resolves.toMatchObject({ status: 'PUBLISHED' });

    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.publish).toHaveBeenCalledWith(expect.objectContaining({
      revisionId: revision.id,
      reviewerId: 'second-assistante',
    }));
  });

  test('lists stranded COACH_VALIDATED revisions alongside genuinely pending ones', async () => {
    const stranded = { ...revision, id: 'revision-stranded', status: 'COACH_VALIDATED' };
    const deps = dependencies({ listPending: jest.fn().mockResolvedValue([revision, stranded]) });

    await expect(listPendingReportReviews({ userId: 'user-assistante', role: 'ASSISTANTE' }, serviceDependencies(deps)))
      .resolves.toEqual([revision, stranded]);
  });

  test('refuses to reject an already-validated revision instead of surfacing a confusing DB-guard error', async () => {
    const stranded = { ...revision, status: 'COACH_VALIDATED' };
    const deps = dependencies({ findPending: jest.fn().mockResolvedValue(stranded) });

    await expect(rejectPendingReport({
      userId: 'user-assistante', role: 'ASSISTANTE', revisionId: revision.id, motif: 'Trop tard.',
    }, serviceDependencies(deps))).rejects.toMatchObject({ code: 'REPORT_ALREADY_VALIDATED' });
    expect(deps.reject).not.toHaveBeenCalled();
  });

  test('contains no direct Prisma status mutation in the staff surface', () => {
    const paths = [
      'lib/bilans/staff/review-service.ts',
      'app/dashboard/assistante/bilans/actions.ts',
      'app/dashboard/assistante/bilans/page.tsx',
    ];
    const source = paths.map((path) => readFileSync(resolve(process.cwd(), path), 'utf8')).join('\n');
    expect(source).not.toMatch(/canonicalAssessmentAttempt\.(?:update|updateMany)/);
    expect(source).not.toMatch(/reportRevision\.(?:update|updateMany)/);
    expect(source).not.toMatch(/reportArtifact\.(?:update|updateMany)/);
    expect(source).not.toMatch(/reportMaterialization\.(?:update|updateMany)/);
    expect(source).not.toMatch(/reportAudienceArtifact\.(?:update|updateMany)/);
    expect(source).not.toMatch(/['"]\/api\//);
    expect(source).toContain('Prévisualiser le PDF');
    expect(source).toContain('Télécharger le PDF');
    expect(source).toContain('En attente de diffusion');
    expect(source).toContain('Prêt — e-mail parent manquant');
    expect(source).toContain('bilans prêts en attente d’e-mail parent');
    expect(source).toContain('Ajouter l’e-mail du parent');
    expect(source).toContain('Diffusé');
    expect(source).toContain('Rejeté');
    expect(source).toContain('Corrigez les blocages signalés avant de reprendre la diffusion.');
    expect(source).toContain('revision.studentName');
    expect(source).not.toContain('JSON.stringify');
    expect(source).not.toContain('<pre');
  });
});
