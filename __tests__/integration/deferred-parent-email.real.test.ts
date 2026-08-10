jest.unmock('@/lib/prisma');

import { completePaperEntryParentEmail } from '@/lib/bilans/staff/parent-contact-service';
import { validateSessionToken } from '@/lib/auth/session-revocation';
import { createPaperEntryFamilyHandler } from '@/lib/bilans/saisie-papier/famille';
import { hasAvailableParentContact } from '@/lib/bilans/staff/review-service';
import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { NextRequest } from 'next/server';

const PREFIX = `deferred-parent-email-${Date.now()}-`;
const NOW = new Date('2026-08-10T00:00:00.000Z');
const createdUserIds: string[] = [];

function assertDisposableDatabase(): void {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  assertDisposablePostgresUrl(url);
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

  it('rattache à un parent existant et tombstone explicitement le compte source sans casser l’historique', async () => {
    const sourceUser = await prisma.user.create({
      data: {
        email: null,
        role: 'PARENT',
        firstName: 'Parent',
        lastName: 'Source',
        phone: '99 19 28 29',
        phoneNormalized: '99192829',
        password: 'ancien-hash-inutilisable',
        activatedAt: NOW,
      },
    });
    const sourceProfile = await prisma.parentProfile.create({ data: { userId: sourceUser.id } });
    const targetEmail = `${PREFIX}existing-parent@example.test`;
    const targetUser = await prisma.user.create({
      data: {
        email: targetEmail,
        role: 'PARENT',
        firstName: 'Parent',
        lastName: 'Cible',
        activatedAt: NOW,
      },
    });
    const targetProfile = await prisma.parentProfile.create({ data: { userId: targetUser.id } });
    const studentUser = await prisma.user.create({
      data: {
        email: `${PREFIX}merge-student@example.test`,
        role: 'ELEVE',
        firstName: 'Élève',
        lastName: 'Historique',
      },
    });
    const student = await prisma.student.create({
      data: { userId: studentUser.id, parentId: sourceProfile.id, gradeLevel: 'PREMIERE' },
    });
    const staff = await prisma.user.create({
      data: { email: `${PREFIX}merge-staff@example.test`, role: 'ASSISTANTE' },
    });
    createdUserIds.push(sourceUser.id, targetUser.id, studentUser.id, staff.id);

    const sourceConsent = await prisma.parentStudentLink.create({
      data: {
        parentUserId: sourceUser.id,
        studentId: student.id,
        state: 'VERIFIED',
        requestedAt: NOW,
        consentedAt: NOW,
        verifiedAt: NOW,
      },
    });
    const attempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: student.id,
        status: 'REPORT_PENDING_REVIEW',
        seed: `${PREFIX}merge-seed`,
        expiresAt: new Date(NOW.getTime() + 3_600_000),
        subject: 'MATHEMATIQUES',
        gradeLevel: 'PREMIERE',
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
        contextChecksum: 'merge-immutable-context-checksum',
        content: { PARENTS: { title: 'Historique immuable' } },
      },
    });
    const immutableBefore = await prisma.reportRevision.findUniqueOrThrow({
      where: { id: revision.id },
      select: {
        content: true,
        contextChecksum: true,
        scoreSnapshot: { select: { score: true, result: true } },
        reportArtifact: {
          select: { assessmentAttempt: { select: { answers: true, provenance: true, enteredById: true } } },
        },
      },
    });
    const sourceSessionToken = {
      id: sourceUser.id,
      role: sourceUser.role,
      sessionVersion: sourceUser.sessionVersion,
    };

    await expect(validateSessionToken(sourceSessionToken, prisma)).resolves.toEqual(sourceSessionToken);

    await expect(completePaperEntryParentEmail({
      userId: staff.id,
      role: 'ASSISTANTE',
      revisionId: revision.id,
      email: targetEmail,
    }, { now: () => NOW })).resolves.toEqual({
      parentUserId: targetUser.id,
      attachedExisting: true,
      activationQueued: false,
    });

    const [sourceAfter, targetAfter, sourceConsentAfter, targetConsent, immutableAfter] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: sourceUser.id },
        include: { parentProfile: { include: { children: true } } },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: targetUser.id },
        include: { parentProfile: { include: { children: true } } },
      }),
      prisma.parentStudentLink.findUniqueOrThrow({ where: { id: sourceConsent.id } }),
      prisma.parentStudentLink.findFirstOrThrow({
        where: { parentUserId: targetUser.id, studentId: student.id },
      }),
      prisma.reportRevision.findUniqueOrThrow({
        where: { id: revision.id },
        select: {
          content: true,
          contextChecksum: true,
          scoreSnapshot: { select: { score: true, result: true } },
          reportArtifact: {
            select: { assessmentAttempt: { select: { answers: true, provenance: true, enteredById: true } } },
          },
        },
      }),
    ]);

    expect(sourceAfter).toEqual(expect.objectContaining({
      mergedIntoUserId: targetUser.id,
      mergedAt: NOW,
      password: null,
      activatedAt: null,
      activationToken: null,
      activationExpiry: null,
      sessionVersion: sourceUser.sessionVersion + 1,
    }));
    await expect(validateSessionToken(sourceSessionToken, prisma)).resolves.toBeNull();
    expect(sourceAfter.parentProfile).toEqual(expect.objectContaining({ id: sourceProfile.id, children: [] }));
    expect(targetAfter.parentProfile).toEqual(expect.objectContaining({
      id: targetProfile.id,
      children: [expect.objectContaining({ id: student.id })],
    }));
    expect(sourceConsentAfter).toEqual(expect.objectContaining({
      state: 'REVOKED',
      revokedAt: NOW,
      revokedReason: 'LEGACY_PARENT_CHANGED',
    }));
    expect(targetConsent).toEqual(expect.objectContaining({ state: 'PENDING_PARENT_CONSENT' }));
    expect(immutableAfter).toEqual(immutableBefore);

    const duplicateResponse = await createPaperEntryFamilyHandler({
      prisma,
      authenticate: async () => ({ user: { id: staff.id, role: 'ASSISTANTE' } } as never),
      now: () => NOW,
    })(new NextRequest('http://localhost/api/bilans/saisie-papier/famille', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `${PREFIX}merged-phone-alias`,
      },
      body: JSON.stringify({
        parentPhone: '+216 99 19 28 29',
        parentFirstName: 'Parent',
        parentLastName: 'Source',
        children: [{ firstName: 'Nouvel', lastName: 'Enfant', grade: 'Seconde' }],
      }),
    }));

    expect(duplicateResponse.status).toBe(409);
    await expect(duplicateResponse.json()).resolves.toEqual(expect.objectContaining({
      error: { code: 'POTENTIAL_DUPLICATE' },
      candidates: expect.arrayContaining([
        expect.objectContaining({ parentUserId: targetUser.id }),
      ]),
    }));
    expect(await prisma.student.count({
      where: { user: { firstName: 'Nouvel', lastName: 'Enfant' } },
    })).toBe(0);
  });
});
