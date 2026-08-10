jest.unmock('@/lib/prisma');

import { completePaperEntryParentEmail } from '@/lib/bilans/staff/parent-contact-service';
import { hasAvailableParentContact } from '@/lib/bilans/staff/review-service';
import { prisma } from '@/lib/prisma';

const PREFIX = `deferred-parent-email-${Date.now()}-`;
const NOW = new Date('2026-08-10T00:00:00.000Z');
const createdUserIds: string[] = [];

function assertDisposableDatabase(): void {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  const parsed = new URL(url);
  expect(['127.0.0.1', 'localhost']).toContain(parsed.hostname);
  expect(parsed.port).toBe('5434');
  expect(parsed.pathname).toBe('/nexus_test');
}

describe('e-mail parent différé sur PostgreSQL réel', () => {
  beforeAll(() => {
    assertDisposableDatabase();
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });

  afterAll(async () => {
    await prisma.jobOutbox.deleteMany({ where: { aggregateId: { in: createdUserIds } } });
    // Les triggers append-only refusent DELETE par conception. TRUNCATE est
    // réservé à cette base locale jetable et remet les tables canoniques à
    // zéro comme les autres suites d'intégration du dépôt.
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "canonical_report_reviews", "canonical_report_revisions", "canonical_report_artifacts",
        "canonical_evidence_items", "canonical_score_snapshots", "canonical_job_outbox",
        "canonical_api_idempotency_keys", "canonical_assessment_attempts" CASCADE
    `);
    await prisma.parentStudentLink.deleteMany({ where: { parentUserId: { in: createdUserIds } } });
    await prisma.student.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.parentProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('autorise plusieurs NULL mais refuse deux e-mails présents identiques', async () => {
    const first = await prisma.user.create({ data: { email: null, role: 'PARENT' } });
    const second = await prisma.user.create({ data: { email: null, role: 'PARENT' } });
    const uniqueEmail = `${PREFIX}unique@example.test`;
    const withEmail = await prisma.user.create({ data: { email: uniqueEmail, role: 'PARENT' } });
    createdUserIds.push(first.id, second.id, withEmail.id);

    await expect(prisma.user.create({ data: { email: uniqueEmail, role: 'PARENT' } }))
      .rejects.toMatchObject({ code: 'P2002' });
  });

  it('complète le compte et débloque le contact sans réécrire le bilan papier', async () => {
    const parentUser = await prisma.user.create({
      data: {
        email: null,
        role: 'PARENT',
        firstName: 'Claire',
        lastName: 'Bernard',
        phone: '99 19 28 29',
        phoneNormalized: '99192829',
      },
    });
    const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const studentUser = await prisma.user.create({
      data: { email: `${PREFIX}student@example.test`, role: 'ELEVE', firstName: 'Inès', lastName: 'Bernard' },
    });
    const student = await prisma.student.create({
      data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'TERMINALE' },
    });
    const staff = await prisma.user.create({
      data: { email: `${PREFIX}staff@example.test`, role: 'ASSISTANTE' },
    });
    createdUserIds.push(parentUser.id, studentUser.id, staff.id);

    const attempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: student.id,
        status: 'REPORT_PENDING_REVIEW',
        seed: `${PREFIX}seed`,
        expiresAt: new Date(NOW.getTime() + 3_600_000),
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        answers: { q1: { optionId: 'A', confidence: 3 } },
        submittedAt: NOW,
        curriculumId: 'test.curriculum',
        curriculumVersion: '1',
        assessmentPackId: 'fixture-pack',
        assessmentPackVersion: '1',
        assessmentPackChecksum: 'fixture-checksum',
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1',
        provenance: 'SAISIE_PAPIER',
        enteredById: staff.id,
        enteredAt: NOW,
      },
    });
    const snapshot = await prisma.scoreSnapshot.create({
      data: {
        assessmentAttemptId: attempt.id,
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1',
        scoringPolicyChecksum: 'facts-checksum',
        score: 75,
        result: { score: 75 },
      },
    });
    const artifact = await prisma.reportArtifact.create({
      data: { studentId: student.id, assessmentAttemptId: attempt.id, status: 'PENDING_REVIEW' },
    });
    const revision = await prisma.reportRevision.create({
      data: {
        reportArtifactId: artifact.id,
        scoreSnapshotId: snapshot.id,
        status: 'PENDING_REVIEW',
        reportPackId: 'fixture-pack',
        reportPackVersion: '1',
        corpusManifestId: 'fixture-corpus',
        corpusManifestVersion: '1',
        promptRevision: 'plancher-v1',
        contextChecksum: 'immutable-context-checksum',
        content: { PARENTS: { title: 'Snapshot immuable' } },
      },
    });

    const before = await prisma.reportRevision.findUniqueOrThrow({
      where: { id: revision.id },
      select: {
        content: true,
        contextChecksum: true,
        reportArtifact: {
          select: {
            assessmentAttempt: {
              select: { answers: true, provenance: true, enteredById: true, enteredAt: true },
            },
          },
        },
      },
    });
    const contactBefore = await prisma.reportRevision.findUniqueOrThrow({
      where: { id: revision.id },
      select: {
        reportArtifact: {
          select: { student: { select: { parent: { select: { user: { select: { email: true } } } } } } },
        },
      },
    });
    expect(hasAvailableParentContact(contactBefore as never)).toBe(false);

    await completePaperEntryParentEmail({
      userId: staff.id,
      role: 'ASSISTANTE',
      revisionId: revision.id,
      email: `${PREFIX}parent@example.test`,
    }, { now: () => NOW });

    const after = await prisma.reportRevision.findUniqueOrThrow({
      where: { id: revision.id },
      select: {
        content: true,
        contextChecksum: true,
        reportArtifact: {
          select: {
            assessmentAttempt: {
              select: { answers: true, provenance: true, enteredById: true, enteredAt: true },
            },
          },
        },
      },
    });
    expect(after).toEqual(before);

    const completedParent = await prisma.user.findUniqueOrThrow({ where: { id: parentUser.id } });
    expect(completedParent.email).toBe(`${PREFIX}parent@example.test`);
    expect(completedParent.activationToken).toEqual(expect.any(String));
    const contactAfter = await prisma.reportRevision.findUniqueOrThrow({
      where: { id: revision.id },
      select: {
        reportArtifact: {
          select: { student: { select: { parent: { select: { user: { select: { email: true } } } } } } },
        },
      },
    });
    expect(hasAvailableParentContact(contactAfter as never)).toBe(true);
  });
});
