jest.unmock('@/lib/prisma');

/**
 * Les gardes DB du workflow assistante, prouvés sur PostgreSQL réel :
 *
 * 1. Annotations de revue append-only — jamais écrasées, jamais supprimées.
 * 2. Transitions de révision étendues : « Correction demandée » exige une
 *    revue CHANGES_REQUESTED tracée ; la reprise revient en revue ; le
 *    contenu reste immuable pendant tout le cycle.
 * 3. Liens signés : bilan Nexus interdit par la base elle-même, révocation
 *    unique et irréversible, journal de consultation intangible.
 * 4. Transmissions : append-only, canal contraint.
 *
 * Un test sur le texte de la migration ne prouverait rien ; ici les requêtes
 * échouent pour de vrai.
 */

import { prisma } from '@/lib/prisma';

const PREFIX = `annotations-${Date.now()}-`;

let assistantId: string;
let parentUserId: string;
let artifactId: string;
let revisionId: string;

beforeAll(async () => {
  const assistant = await prisma.user.create({
    data: { email: `${PREFIX}assistante@example.test`, role: 'ASSISTANTE' },
  });
  assistantId = assistant.id;
  const parentUser = await prisma.user.create({
    data: { email: null, role: 'PARENT', phone: '99 19 28 29', phoneNormalized: '99192829' },
  });
  parentUserId = parentUser.id;
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  const studentUser = await prisma.user.create({
    data: { email: `${PREFIX}eleve@example.test`, role: 'ELEVE', firstName: 'Kamel', lastName: 'Test' },
  });
  const student = await prisma.student.create({
    data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'SECONDE' },
  });
  const attempt = await prisma.canonicalAssessmentAttempt.create({
    data: {
      studentId: student.id,
      status: 'REPORT_PENDING_REVIEW',
      subject: 'MATHEMATIQUES',
      gradeLevel: 'SECONDE',
      answers: {},
      curriculumId: 'c',
      curriculumVersion: '1',
      assessmentPackId: 'entree-seconde-maths-v1',
      assessmentPackVersion: '1',
      assessmentPackChecksum: 'x'.repeat(64),
      scoringPolicyId: 's',
      scoringPolicyVersion: '1',
      seed: '42',
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  const snapshot = await prisma.scoreSnapshot.create({
    data: {
      assessmentAttemptId: attempt.id,
      scoringPolicyId: 's',
      scoringPolicyVersion: '1',
      scoringPolicyChecksum: 'x',
      score: 50,
      result: {},
      scoredAt: new Date(),
    },
  });
  const artifact = await prisma.reportArtifact.create({
    data: { studentId: student.id, assessmentAttemptId: attempt.id, status: 'PENDING_REVIEW' },
  });
  artifactId = artifact.id;
  const revision = await prisma.reportRevision.create({
    data: {
      reportArtifactId: artifact.id,
      scoreSnapshotId: snapshot.id,
      status: 'PENDING_REVIEW',
      reportPackId: 'entree-seconde-maths-v1',
      reportPackVersion: '1',
      corpusManifestId: 'disabled',
      corpusManifestVersion: '1',
      promptRevision: 'deterministic-no-agent-v1',
      contextChecksum: 'e'.repeat(64),
      content: {},
    },
  });
  revisionId = revision.id;
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "canonical_share_link_accesses", "canonical_report_share_links",
      "canonical_report_transmissions", "canonical_report_review_annotations",
      "canonical_report_reviews", "canonical_report_revisions", "canonical_report_artifacts",
      "canonical_evidence_items", "canonical_score_snapshots", "canonical_job_outbox",
      "canonical_assessment_attempts", "canonical_parent_student_links" CASCADE
  `);
  await prisma.$disconnect();
});

describe('transitions de révision — Correction demandée', () => {
  it('refuse CORRECTION_REQUESTED sans revue CHANGES_REQUESTED tracée', async () => {
    await expect(prisma.reportRevision.update({
      where: { id: revisionId },
      data: { status: 'CORRECTION_REQUESTED' },
    })).rejects.toThrow(/append-only outside traced coach review/);
  });

  it('accepte le cycle tracé : demande → annotation → reprise, contenu intact', async () => {
    const review = await prisma.reportReview.create({
      data: {
        reportRevisionId: revisionId,
        reviewerId: assistantId,
        decision: 'CHANGES_REQUESTED',
        motif: 'Reformuler la priorité no 2 du bilan élève.',
      },
    });
    await prisma.reportRevision.update({
      where: { id: revisionId },
      data: { status: 'CORRECTION_REQUESTED' },
    });
    const annotation = await prisma.reportReviewAnnotation.create({
      data: {
        reportReviewId: review.id,
        audience: 'ELEVE',
        section: 'priorites',
        remark: 'Formulation trop abrupte pour cet élève.',
      },
    });

    // Annotations : jamais écrasées, jamais supprimées.
    await expect(prisma.reportReviewAnnotation.update({
      where: { id: annotation.id },
      data: { remark: 'réécrite' },
    })).rejects.toThrow(/append-only/);
    await expect(prisma.reportReviewAnnotation.delete({ where: { id: annotation.id } }))
      .rejects.toThrow(/append-only/);

    // Contenu immuable même pendant une transition permise.
    await expect(prisma.reportRevision.update({
      where: { id: revisionId },
      data: { status: 'PENDING_REVIEW', content: { altered: true } },
    })).rejects.toThrow(/append-only outside traced coach review/);

    // Reprise de revue : autorisée, historique intact.
    await prisma.reportRevision.update({
      where: { id: revisionId },
      data: { status: 'PENDING_REVIEW' },
    });
    const kept = await prisma.reportReviewAnnotation.findUnique({ where: { id: annotation.id } });
    expect(kept?.remark).toBe('Formulation trop abrupte pour cet élève.');
  });
});

describe('liens signés — gardes en base', () => {
  it('interdit un lien vers le document interne Nexus au niveau SQL', async () => {
    await expect(prisma.reportShareLink.create({
      data: {
        reportArtifactId: artifactId,
        audience: 'NEXUS',
        recipientUserId: parentUserId,
        tokenHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 86_400_000),
        createdById: assistantId,
      },
    })).rejects.toThrow(/never_nexus|check/i);
  });

  it('révocation unique : ni annulation, ni altération, ni suppression', async () => {
    const link = await prisma.reportShareLink.create({
      data: {
        reportArtifactId: artifactId,
        audience: 'PARENTS',
        recipientUserId: parentUserId,
        tokenHash: 'b'.repeat(64),
        expiresAt: new Date(Date.now() + 86_400_000),
        createdById: assistantId,
      },
    });
    await expect(prisma.reportShareLink.update({
      where: { id: link.id },
      data: { tokenHash: 'c'.repeat(64) },
    })).rejects.toThrow(/single revocation/);

    await prisma.reportShareLink.update({ where: { id: link.id }, data: { revokedAt: new Date() } });
    await expect(prisma.reportShareLink.update({
      where: { id: link.id },
      data: { revokedAt: null },
    })).rejects.toThrow(/single revocation/);
    await expect(prisma.reportShareLink.delete({ where: { id: link.id } }))
      .rejects.toThrow(/append-only/);
  });

  it('journal de consultation intangible', async () => {
    const link = await prisma.reportShareLink.create({
      data: {
        reportArtifactId: artifactId,
        audience: 'ELEVE',
        recipientUserId: parentUserId,
        tokenHash: 'd'.repeat(64),
        expiresAt: new Date(Date.now() + 86_400_000),
        createdById: assistantId,
      },
    });
    const access = await prisma.shareLinkAccess.create({ data: { shareLinkId: link.id } });
    await expect(prisma.shareLinkAccess.update({
      where: { id: access.id },
      data: { accessedAt: new Date(0) },
    })).rejects.toThrow(/append-only/);
    await expect(prisma.shareLinkAccess.delete({ where: { id: access.id } }))
      .rejects.toThrow(/append-only/);
  });
});

describe('transmissions — append-only', () => {
  it('la trace de transmission ne se réécrit pas et le canal est contraint', async () => {
    const transmission = await prisma.reportTransmission.create({
      data: {
        reportArtifactId: artifactId,
        channel: 'WHATSAPP',
        recipientUserId: parentUserId,
        confirmedById: assistantId,
      },
    });
    await expect(prisma.reportTransmission.update({
      where: { id: transmission.id },
      data: { channel: 'WHATSAPP' },
    })).rejects.toThrow(/append-only/);
    await expect(prisma.reportTransmission.delete({ where: { id: transmission.id } }))
      .rejects.toThrow(/append-only/);
    await expect(prisma.reportTransmission.create({
      data: {
        reportArtifactId: artifactId,
        channel: 'SMS',
        recipientUserId: parentUserId,
        confirmedById: assistantId,
      },
    })).rejects.toThrow(/channel_known|check/i);
  });
});
