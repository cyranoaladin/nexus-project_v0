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
    findCoach: jest.fn().mockResolvedValue({ id: 'coach-1' }),
    listAssignedPending: jest.fn().mockResolvedValue([revision]),
    findAssignedRevision: jest.fn().mockResolvedValue(revision),
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
  test('lists only assigned pending revisions whose pack remains enabled', async () => {
    const disabled = { ...revision, id: 'revision-off', reportPackId: 'pack-off' };
    const deps = dependencies({
      listAssignedPending: jest.fn().mockResolvedValue([revision, disabled]),
      resolvePack: jest.fn((slug: string) => slug === 'fixture-pack' ? { pack: { slug } } : null),
    });

    await expect(listPendingReportReviews({ userId: 'user-coach', role: 'COACH' }, serviceDependencies(deps)))
      .resolves.toEqual([revision]);
  });

  test.each(['ELEVE', 'PARENT', 'ASSISTANTE', 'ADMIN'])('returns NOT_FOUND to role %s', async (role) => {
    await expect(listPendingReportReviews({ userId: 'user-1', role }, serviceDependencies(dependencies())))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('validates then publishes through A86 services with reviewer identity and time', async () => {
    const deps = dependencies();

    await expect(validateAndPublishPendingReport({
      userId: 'user-coach', role: 'COACH', revisionId: revision.id, motif: 'Rapport relu intégralement.',
    }, serviceDependencies(deps))).resolves.toMatchObject({ status: 'PUBLISHED' });

    expect(deps.validate).toHaveBeenCalledWith(expect.objectContaining({
      revisionId: revision.id,
      coachId: 'coach-1',
      motif: 'Rapport relu intégralement.',
      reviewedAt: new Date('2026-08-02T11:00:00.000Z'),
    }));
    expect(deps.publish).toHaveBeenCalledWith(expect.objectContaining({ revisionId: revision.id, coachId: 'coach-1' }));
    expect(deps.validate.mock.invocationCallOrder[0]).toBeLessThan(deps.publish.mock.invocationCallOrder[0]);
  });

  test('blocks validationFailures before either validation or publication', async () => {
    const deps = dependencies({
      findAssignedRevision: jest.fn().mockResolvedValue({ ...revision, validationFailures: ['V2_NUMBER_FORBIDDEN'] }),
    });

    await expect(validateAndPublishPendingReport({
      userId: 'user-coach', role: 'COACH', revisionId: revision.id, motif: 'Ne doit pas passer.',
    }, serviceDependencies(deps))).rejects.toMatchObject({ code: 'REPORT_VALIDATION_FAILURES' });
    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.publish).not.toHaveBeenCalled();
  });

  test('previews without validating, publishing or persisting an artifact', async () => {
    const deps = dependencies();
    await expect(previewPendingReport({
      userId: 'user-coach', role: 'COACH', revisionId: revision.id,
    }, serviceDependencies(deps))).resolves.toMatchObject({ official: false });
    expect(deps.preview).toHaveBeenCalledWith({ revisionId: revision.id });
    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.publish).not.toHaveBeenCalled();
  });

  test('rejects through the A86 service and preserves a non-empty motif', async () => {
    const deps = dependencies();
    await rejectPendingReport({
      userId: 'user-coach', role: 'COACH', revisionId: revision.id, motif: 'Priorité pédagogique incorrecte.',
    }, serviceDependencies(deps));
    expect(deps.reject).toHaveBeenCalledWith(expect.objectContaining({ motif: 'Priorité pédagogique incorrecte.' }));
  });

  test('contains no direct Prisma status mutation in the staff surface', () => {
    const paths = [
      'lib/bilans/staff/review-service.ts',
      'app/dashboard/coach/bilans/actions.ts',
      'app/dashboard/coach/bilans/page.tsx',
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
