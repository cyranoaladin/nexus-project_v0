import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  listPendingReportReviews,
  rejectPendingReport,
  validateAndPublishPendingReport,
  previewPendingReport,
} from '@/lib/bilans/staff/review-service';

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
  },
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    listPending: jest.fn().mockResolvedValue([revision]),
    findPending: jest.fn().mockResolvedValue(revision),
    resolvePack: jest.fn().mockReturnValue({ pack: { slug: 'fixture-pack' } }),
    validate: jest.fn().mockResolvedValue({ status: 'COACH_VALIDATED' }),
    publish: jest.fn().mockResolvedValue({ status: 'PUBLISHED' }),
    preview: jest.fn().mockResolvedValue({ official: false, audiences: [] }),
    reject: jest.fn().mockResolvedValue({ status: 'COACH_REJECTED' }),
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
  });
});
