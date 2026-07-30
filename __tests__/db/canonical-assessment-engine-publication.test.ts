import {
  AssessmentEngineError,
  approveAssessmentReport,
  generateAssessmentReport,
  getPublishedAssessmentReport,
  publishAssessmentReport,
  reviseManualReviewDecision,
  revokeAssessmentReport,
} from '@/lib/bilans/engine';
import {
  canConnectToTestDb,
  createTestParent,
  setupTestDatabase,
  testPrisma,
} from '../setup/test-database';
import {
  createFinalScoredWorkflowFixture,
  engineKey,
} from './support/canonical-assessment-fixture';

const prisma = testPrisma;

describe('canonical audience-scoped report publication service', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('Assessment publication tests require PostgreSQL');
    }
  }, 10_000);

  beforeEach(async () => {
    await setupTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  }, 30_000);

  it('generates one deterministic revision without publishing it', async () => {
    const fixture = await createFinalScoredWorkflowFixture(prisma);
    const [first, second] = await Promise.all([
      generateAssessmentReport(fixture.context, {
        actor: fixture.adminActor,
        attemptId: fixture.attempt.id,
        audience: 'PARENT',
        idempotencyKey: engineKey('generate'),
      }),
      generateAssessmentReport(fixture.context, {
        actor: fixture.adminActor,
        attemptId: fixture.attempt.id,
        audience: 'PARENT',
        idempotencyKey: engineKey('generate'),
      }),
    ]);

    expect(second.id).toBe(first.id);
    expect(first.status).toBe('PENDING_REVIEW');
    expect(first.contextChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(await prisma.reportRevision.count({
      where: { reportArtifactId: first.artifactId },
    })).toBe(1);
    expect(await prisma.reportPublication.count()).toBe(0);
    await expect(getPublishedAssessmentReport(fixture.context, {
      actor: fixture.parentActor,
      attemptId: fixture.attempt.id,
    })).rejects.toThrow(new AssessmentEngineError('REPORT_NOT_PUBLISHED', 404));
  });

  it('separates generation, admin approval and idempotent publication', async () => {
    const fixture = await createFinalScoredWorkflowFixture(prisma);
    const revision = await generateAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      attemptId: fixture.attempt.id,
      audience: 'PARENT',
      idempotencyKey: engineKey('generate'),
    });
    const approved = await approveAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      revisionId: revision.id,
      motif: 'Données factuelles vérifiées.',
      idempotencyKey: engineKey('approve'),
    });
    const [first, second] = await Promise.all([
      publishAssessmentReport(fixture.context, {
        actor: fixture.adminActor,
        revisionId: revision.id,
        idempotencyKey: engineKey('publish'),
      }),
      publishAssessmentReport(fixture.context, {
        actor: fixture.adminActor,
        revisionId: revision.id,
        idempotencyKey: engineKey('publish'),
      }),
    ]);

    expect(approved.status).toBe('COACH_VALIDATED');
    expect(first.id).toBe(second.id);
    expect(await prisma.reportPublication.count({
      where: { reportArtifactId: revision.artifactId, status: 'PUBLISHED' },
    })).toBe(1);
    expect(await prisma.reportReview.findFirst({
      where: { reportRevisionId: revision.id },
      select: { coachId: true, reviewerUserId: true },
    })).toEqual({
      coachId: null,
      reviewerUserId: fixture.admin.id,
    });
    expect(await prisma.notificationOutbox.count({
      where: {
        eventType: 'REPORT_PUBLISHED',
        sourceEventKey: `${first.id}.published`,
      },
    })).toBe(1);
  });

  it('returns only the parent publication and denies another parent', async () => {
    const fixture = await createFinalScoredWorkflowFixture(prisma);
    const revision = await generateAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      attemptId: fixture.attempt.id,
      audience: 'PARENT',
      idempotencyKey: engineKey('generate'),
    });
    await approveAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      revisionId: revision.id,
      motif: 'Données factuelles vérifiées.',
      idempotencyKey: engineKey('approve'),
    });
    await publishAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      revisionId: revision.id,
      idempotencyKey: engineKey('publish'),
    });

    const report = await getPublishedAssessmentReport(fixture.context, {
      actor: fixture.parentActor,
      attemptId: fixture.attempt.id,
    });
    const serialized = JSON.stringify(report);
    expect(serialized).toContain('La justification est à approfondir.');
    expect(serialized).not.toContain('Commentaire interne fixture.');
    expect(serialized).not.toContain('Une justification à corriger.');
    expect(serialized).not.toContain('"correct"');

    const { parentUser: foreignParent } = await createTestParent();
    await expect(getPublishedAssessmentReport(fixture.context, {
      actor: { role: 'PARENT', userId: foreignParent.id },
      attemptId: fixture.attempt.id,
    })).rejects.toThrow(new AssessmentEngineError('REPORT_NOT_PUBLISHED', 404));
  });

  it('revokes access without deleting publication history', async () => {
    const fixture = await createFinalScoredWorkflowFixture(prisma);
    const revision = await generateAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      attemptId: fixture.attempt.id,
      audience: 'PARENT',
      idempotencyKey: engineKey('generate'),
    });
    await approveAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      revisionId: revision.id,
      motif: 'Données factuelles vérifiées.',
      idempotencyKey: engineKey('approve'),
    });
    const publication = await publishAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      revisionId: revision.id,
      idempotencyKey: engineKey('publish'),
    });
    const revoked = await revokeAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      publicationId: publication.id,
      reason: 'Révision pédagogique requise.',
      idempotencyKey: engineKey('revoke'),
    });

    expect(revoked.status).toBe('REVOKED');
    expect(await prisma.reportPublication.count({
      where: { id: publication.id },
    })).toBe(1);
    await expect(getPublishedAssessmentReport(fixture.context, {
      actor: fixture.parentActor,
      attemptId: fixture.attempt.id,
    })).rejects.toThrow(new AssessmentEngineError('REPORT_NOT_PUBLISHED', 404));
  });

  it('requires every active audience publication to be revoked before revising a correction', async () => {
    const fixture = await createFinalScoredWorkflowFixture(prisma);
    const revision = await generateAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      attemptId: fixture.attempt.id,
      audience: 'PARENT',
      idempotencyKey: engineKey('generate'),
    });
    await approveAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      revisionId: revision.id,
      motif: 'Données factuelles vérifiées.',
      idempotencyKey: engineKey('approve'),
    });
    await publishAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      revisionId: revision.id,
      idempotencyKey: engineKey('publish'),
    });

    await expect(reviseManualReviewDecision(fixture.context, {
      actor: fixture.adminActor,
      command: {
        taskId: fixture.task.id,
        awardedPoints: 1,
        internalComment: 'Correction post-publication interdite.',
        publishableComment: 'Réponse finalement validée.',
        rubricVersion: 'raw-item-v1',
      },
      idempotencyKey: engineKey('revise'),
    })).rejects.toThrow(
      new AssessmentEngineError('ACTIVE_PUBLICATION_REQUIRES_REVOCATION'),
    );
    expect(await prisma.canonicalManualReviewDecision.count({
      where: { taskId: fixture.task.id },
    })).toBe(1);
  });

  it('regenerates a revoked audience while another audience remains published', async () => {
    const fixture = await createFinalScoredWorkflowFixture(prisma);
    const parentRevision = await generateAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      attemptId: fixture.attempt.id,
      audience: 'PARENT',
      idempotencyKey: engineKey('generate-parent'),
    });
    const nexusRevision = await generateAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      attemptId: fixture.attempt.id,
      audience: 'NEXUS',
      idempotencyKey: engineKey('generate-nexus'),
    });
    for (const revision of [parentRevision, nexusRevision]) {
      await approveAssessmentReport(fixture.context, {
        actor: fixture.adminActor,
        revisionId: revision.id,
        motif: 'Données factuelles vérifiées.',
        idempotencyKey: engineKey('approve'),
      });
    }
    const parentPublication = await publishAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      revisionId: parentRevision.id,
      idempotencyKey: engineKey('publish-parent'),
    });
    await publishAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      revisionId: nexusRevision.id,
      idempotencyKey: engineKey('publish-nexus'),
    });
    await revokeAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      publicationId: parentPublication.id,
      reason: 'Nouvelle révision parent requise.',
      idempotencyKey: engineKey('revoke-parent'),
    });

    const regenerated = await generateAssessmentReport(fixture.context, {
      actor: fixture.adminActor,
      attemptId: fixture.attempt.id,
      audience: 'PARENT',
      idempotencyKey: engineKey('regenerate-parent'),
    });

    expect(regenerated.artifactId).toBe(parentRevision.artifactId);
    expect((await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({
      where: { id: fixture.attempt.id },
    })).status).toBe('PUBLISHED');
  });
});
