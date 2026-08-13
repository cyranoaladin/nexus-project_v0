jest.unmock('@/lib/prisma');

/**
 * Régénération d'un bilan — prouvée sur PostgreSQL réel, gardes compris.
 *
 * Le scénario est le défaut du 13/08/2026 : un snapshot calculé sous
 * l'ancienne règle §6 (un nœud avec une erreur confiante minoritaire classé
 * MAITRISE) est régénéré sous la règle courante. On prouve :
 *   1. le score n'est jamais recalculé (re-dérivé identique, sinon STOP) ;
 *   2. la nouvelle génération arrive EN PLUS (historique conservé),
 *      l'ancienne révision est retirée de la file par un rejet tracé ;
 *   3. la trace est append-only (UPDATE/DELETE refusés par la base) ;
 *   4. le cas « déjà publié » exige la confirmation délibérée, fait
 *      transiter l'attempt par le chemin prévu, et l'artefact RESTE publié
 *      (la famille garde l'ancienne version jusqu'à re-publication) ;
 *   5. answers, snapshot et matérialisations restent intacts au octet près.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { prisma } from '@/lib/prisma';
import { score } from '@/lib/bilans/facts/compute-facts';
import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import {
  executeReportRegeneration,
  prepareReportRegeneration,
  ReportRegenerationError,
} from '@/lib/bilans/staff/regeneration-service';
import { resolveEnabledPack } from '@/lib/bilans/api/pack-access';

const PREFIX = `regen-${Date.now()}-`;
const PACK_SLUG = 'entree-seconde-maths-v1';

// Le pack doit être activé pour que le service le résolve — même mécanisme
// que la production (drapeau d'activation par pack).
process.env.NEXUS_BILAN_PACK_ENTREE_SECONDE_MATHS_V1_ENABLED = 'true';

type RawPack = {
  slug: string;
  version: number;
  scoring: { domains: readonly string[] };
  questionnaire: { items: readonly {
    id: string; nodeCpsId: string; domainId: string; difficulty: number;
    targetTimeSec: number;
    options: readonly { id: string; isCorrect?: boolean }[];
  }[] };
};

function loadPack(): RawPack {
  return JSON.parse(readFileSync(join(process.cwd(), 'data/bilans/banks', `${PACK_SLUG}.json`), 'utf8')) as RawPack;
}

/**
 * Entrées du moteur depuis la banque réelle (QCM_SIMPLE, comme le worker) :
 * tout juste à 4/4, sauf UN item faux à 4/4 — le défaut du 13/08/2026.
 */
function buildScoring(pack: RawPack) {
  const items = pack.questionnaire.items.map((item) => {
    const correct = item.options.find(({ isCorrect }) => isCorrect === true);
    if (correct === undefined) throw new Error(`option correcte absente : ${item.id}`);
    return {
      item: {
        id: item.id,
        nodeCpsId: item.nodeCpsId,
        type: 'QCM_SIMPLE' as const,
        difficulty: item.difficulty as 1 | 2 | 3,
        answerKey: { kind: 'QCM_SIMPLE' as const, correct: correct.id },
        targetTimeSec: item.targetTimeSec,
      },
      correctId: correct.id,
      wrongId: item.options.find(({ isCorrect }) => isCorrect !== true)?.id ?? correct.id,
    };
  });
  return {
    items: items.map(({ item }) => item),
    answers: items.map(({ item, correctId, wrongId }, index) => ({
      itemId: item.id,
      rawAnswer: index === 0 ? wrongId : correctId,
      confidence: 4 as const,
      elapsedMs: 30_000,
    })),
    targetDurationMin: 30,
  };
}

let assistantId: string;
let revisionId: string;
let snapshotId: string;
let attemptId: string;
let artifactId: string;
let storedFactSheet: FactSheet;
let answersFrozen: string;

beforeAll(async () => {
  const pack = loadPack();
  const output = score(buildScoring(pack) as never);

  const assistant = await prisma.user.create({
    data: { email: `${PREFIX}assistante@example.test`, role: 'ASSISTANTE' },
  });
  assistantId = assistant.id;
  const parentUser = await prisma.user.create({
    data: { email: null, role: 'PARENT', phone: '99 19 28 29', phoneNormalized: '99192829' },
  });
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  const studentUser = await prisma.user.create({
    data: { email: `${PREFIX}eleve@example.test`, role: 'ELEVE', firstName: 'RegenTest', lastName: 'Cas' },
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
      answers: { frozen: true },
      submittedAt: new Date('2026-08-13T10:00:00Z'),
      provenance: 'SAISIE_PAPIER',
      enteredById: assistantId,
      enteredAt: new Date('2026-08-13T10:00:00Z'),
      curriculumId: 'c',
      curriculumVersion: '1',
      assessmentPackId: PACK_SLUG,
      assessmentPackVersion: '1',
      assessmentPackChecksum: resolveEnabledPack(PACK_SLUG, 1)?.checksum ?? 'x'.repeat(64),
      scoringPolicyId: 's',
      scoringPolicyVersion: '1',
      seed: '42',
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  attemptId = attempt.id;
  answersFrozen = JSON.stringify(attempt.answers);

  // FactSheet « ancienne règle » : le moteur COURANT calcule, puis on rétablit
  // le classement de l'époque (le nœud en erreur confiante minoritaire était
  // MAITRISE) — exactement l'état des snapshots de production concernés.
  const buildSheet = await import('@/lib/bilans/facts/fact-sheet');
  const currentSheet = buildSheet.buildFactSheet(
    { slug: pack.slug, version: pack.version, scoring: pack.scoring, questionnaire: pack.questionnaire } as never,
    { result: output, student: { alias: 'ELEVE_REGEN', level: 'seconde' } },
  );
  const brokenNode = currentSheet.nodes.find((node) => node.profile === 'ERREUR_CONFIANTE');
  if (brokenNode === undefined) throw new Error('scénario invalide : aucun nœud EC');
  const brokenDomain = pack.questionnaire.items.find((item) => item.nodeCpsId === brokenNode.nodeCpsId)?.domainId;
  storedFactSheet = {
    ...currentSheet,
    engineVersion: '1.0.1',
    nodes: currentSheet.nodes.map((node) => (
      node.nodeCpsId === brokenNode.nodeCpsId ? { ...node, profile: 'MAITRISE' as const } : node
    )),
    domains: currentSheet.domains.map((domain) => (
      domain.id === brokenDomain ? { ...domain, profile: 'MAITRISE' as const } : domain
    )),
  } as FactSheet;

  const snapshot = await prisma.scoreSnapshot.create({
    data: {
      assessmentAttemptId: attempt.id,
      scoringPolicyId: 's',
      scoringPolicyVersion: '1',
      scoringPolicyChecksum: 'x',
      score: storedFactSheet.globalScore,
      result: storedFactSheet as never,
      scoredAt: new Date(),
    },
  });
  snapshotId = snapshot.id;
  await prisma.evidenceItem.createMany({
    data: output.items.map((item) => ({
      scoreSnapshotId: snapshot.id,
      kind: 'ANSWER' as const,
      competencyId: item.nodeCpsId,
      sourceKey: item.itemId,
      payload: JSON.parse(JSON.stringify(item)),
    })),
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
      reportPackId: PACK_SLUG,
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
      "canonical_report_regenerations",
      "canonical_share_link_accesses", "canonical_report_share_links",
      "canonical_report_transmissions", "canonical_report_review_annotations",
      "canonical_report_reviews", "canonical_report_revisions", "canonical_report_artifacts",
      "canonical_evidence_items", "canonical_score_snapshots", "canonical_job_outbox",
      "canonical_assessment_attempts", "canonical_parent_student_links" CASCADE
  `);
  await prisma.$disconnect();
});

describe('aperçu (lecture seule)', () => {
  it('annonce le diff M → ERREUR_CONFIANTE, versions de règle, génération suivante', async () => {
    const preview = await prepareReportRegeneration({
      actor: { userId: assistantId, role: 'ASSISTANTE' },
      revisionId,
    });
    expect(preview.engineVersionBefore).toBe('1.0.1');
    expect(preview.nextGeneration).toBe(2);
    expect(preview.profilesChanged).toBe(true);
    expect(preview.changes.some((change) => change.before === 'MAITRISE' && change.after === 'ERREUR_CONFIANTE')).toBe(true);
    expect(preview.briefWillRegenerate).toBe(false);
  });

  it('refuse un rôle non-staff', async () => {
    await expect(prepareReportRegeneration({
      actor: { userId: assistantId, role: 'PARENT' },
      revisionId,
    })).rejects.toThrow('REGENERATION_FORBIDDEN');
  });

  it('STOP si le score re-dérivé diverge du snapshot', async () => {
    // On sabote UNE évidence en mémoire ? Non : on prouve sur une copie DB.
    // Un deuxième snapshot avec une évidence altérée doit être refusé.
    const attempt2 = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: (await prisma.reportArtifact.findUniqueOrThrow({ where: { id: artifactId }, select: { studentId: true } })).studentId,
        status: 'REPORT_PENDING_REVIEW',
        subject: 'MATHEMATIQUES',
        gradeLevel: 'SECONDE',
        answers: {},
        submittedAt: new Date(),
        curriculumId: 'c', curriculumVersion: '1',
        assessmentPackId: PACK_SLUG, assessmentPackVersion: '1',
        assessmentPackChecksum: 'x'.repeat(64),
        scoringPolicyId: 's', scoringPolicyVersion: '1', seed: '43',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const snapshot2 = await prisma.scoreSnapshot.create({
      data: {
        assessmentAttemptId: attempt2.id,
        scoringPolicyId: 's', scoringPolicyVersion: '1', scoringPolicyChecksum: 'x',
        score: storedFactSheet.globalScore,
        result: storedFactSheet as never,
        scoredAt: new Date(),
      },
    });
    const first = storedFactSheet.nodes[0];
    await prisma.evidenceItem.create({
      data: {
        scoreSnapshotId: snapshot2.id,
        kind: 'ANSWER',
        competencyId: first.nodeCpsId,
        sourceKey: 'ALTERED',
        // rawSuccess incohérent avec le score stocké du nœud → mismatch.
        payload: { itemId: 'ALTERED', nodeCpsId: first.nodeCpsId, weight: 3, rawSuccess: 0, profile: 'LACUNE_CONSCIENTE', isSuccess: false, isConfident: false, answered: true, elapsedMs: 1 },
      },
    });
    const revision2 = await prisma.reportRevision.create({
      data: {
        reportArtifactId: (await prisma.reportArtifact.create({
          data: { studentId: attempt2.studentId, assessmentAttemptId: attempt2.id, status: 'PENDING_REVIEW' },
        })).id,
        scoreSnapshotId: snapshot2.id,
        status: 'PENDING_REVIEW',
        reportPackId: PACK_SLUG, reportPackVersion: '1',
        corpusManifestId: 'disabled', corpusManifestVersion: '1',
        promptRevision: 'deterministic-no-agent-v1',
        contextChecksum: 'e'.repeat(64), content: {},
      },
    });
    await expect(prepareReportRegeneration({
      actor: { userId: assistantId, role: 'ASSISTANTE' },
      revisionId: revision2.id,
    })).rejects.toThrow('REGENERATION_SCORE_MISMATCH');
  });
});

describe('exécution — bilan en attente de revue', () => {
  let newRevisionId: string;

  it('crée la génération 2 en PENDING_REVIEW, retire l’ancienne par un rejet tracé', async () => {
    const result = await executeReportRegeneration({
      actor: { userId: assistantId, role: 'ASSISTANTE' },
      revisionId,
      motif: 'Correction de la règle de profil (v1.1.0)',
    });
    newRevisionId = result.newRevisionId;
    expect(result.generation).toBe(2);
    expect(result.changes.length).toBeGreaterThan(0);

    const oldRevision = await prisma.reportRevision.findUniqueOrThrow({
      where: { id: revisionId },
      select: { status: true, generation: true, reviews: { select: { decision: true, motif: true } } },
    });
    expect(oldRevision.status).toBe('REJECTED');
    expect(oldRevision.generation).toBe(1);
    expect(oldRevision.reviews.some((review) => review.decision === 'REJECTED' && review.motif.includes('génération 2'))).toBe(true);

    const fresh = await prisma.reportRevision.findUniqueOrThrow({
      where: { id: newRevisionId },
      select: { status: true, generation: true, scoreSnapshotId: true, content: true },
    });
    expect(fresh.status).toBe('PENDING_REVIEW');
    expect(fresh.generation).toBe(2);
    expect(fresh.scoreSnapshotId).toBe(snapshotId);
    // Le contenu régénéré classe bien le nœud en erreur confiante.
    expect(JSON.stringify(fresh.content)).toContain('ERREUR_CONFIANTE');
  });

  it('answers et snapshot sont intacts au octet près', async () => {
    const attempt = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({
      where: { id: attemptId }, select: { answers: true, status: true },
    });
    expect(JSON.stringify(attempt.answers)).toBe(answersFrozen);
    expect(attempt.status).toBe('REPORT_PENDING_REVIEW');
    const snapshot = await prisma.scoreSnapshot.findUniqueOrThrow({
      where: { id: snapshotId }, select: { result: true },
    });
    expect((snapshot.result as unknown as FactSheet).engineVersion).toBe('1.0.1');
    expect((snapshot.result as unknown as FactSheet).nodes.some((node) => node.profile === 'MAITRISE')).toBe(true);
  });

  it('la trace de régénération existe et la base refuse toute réécriture', async () => {
    const trace = await prisma.reportRegeneration.findFirstOrThrow({
      where: { toRevisionId: newRevisionId },
    });
    expect(trace.motif).toContain('règle de profil');
    expect(trace.engineVersionBefore).toBe('1.0.1');
    expect(trace.requestedById).toBe(assistantId);
    expect(trace.wasPublished).toBe(false);
    expect(Array.isArray(trace.profileDiff)).toBe(true);

    await expect(prisma.reportRegeneration.update({
      where: { id: trace.id },
      data: { motif: 'réécrit' },
    })).rejects.toThrow(/append-only/);
    await expect(prisma.reportRegeneration.delete({
      where: { id: trace.id },
    })).rejects.toThrow(/append-only/);
  });

  it('un motif trop court est refusé', async () => {
    await expect(executeReportRegeneration({
      actor: { userId: assistantId, role: 'ASSISTANTE' },
      revisionId: newRevisionId,
      motif: 'ras',
    })).rejects.toThrow('REGENERATION_MOTIF_REQUIRED');
  });
});

describe('exécution — bilan déjà publié', () => {
  beforeAll(async () => {
    // On publie la génération 2 par le chemin réel : revue APPROVED tracée,
    // COACH_VALIDATED, matérialisation, artefact PUBLISHED, attempt PUBLISHED.
    const generation2 = await prisma.reportRevision.findFirstOrThrow({
      where: { scoreSnapshotId: snapshotId, generation: 2 },
      select: { id: true },
    });
    await prisma.reportReview.create({
      data: {
        reportRevisionId: generation2.id,
        reviewerId: assistantId,
        decision: 'APPROVED',
        motif: 'Validation pour test de régénération publiée',
        reviewedAt: new Date(),
      },
    });
    await prisma.reportRevision.update({ where: { id: generation2.id }, data: { status: 'COACH_VALIDATED' } });
    const materialization = await prisma.reportMaterialization.create({
      data: {
        revisionId: generation2.id,
        brandVersion: 'nexus-lux.v1',
        globalChecksum: 'm'.repeat(64),
        materializedAt: new Date(),
      },
    });
    await prisma.reportAudienceArtifact.createMany({
      data: (['ELEVE', 'PARENTS', 'NEXUS'] as const).map((audience) => ({
        materializationId: materialization.id,
        audience,
        html: `<html>gen2-${audience}</html>`,
        pdfStatus: 'UNAVAILABLE' as const,
        checksum: audience.padEnd(64, 'c').slice(0, 64),
      })),
    });
    await prisma.reportArtifact.update({
      where: { id: artifactId },
      data: { status: 'PUBLISHED', currentPublishedRevisionId: generation2.id, publishedAt: new Date() },
    });
    await prisma.canonicalAssessmentAttempt.update({ where: { id: attemptId }, data: { status: 'COACH_VALIDATED' } });
    await prisma.canonicalAssessmentAttempt.update({ where: { id: attemptId }, data: { status: 'PUBLISHED' } });
  });

  it('sans confirmation délibérée : refus explicite', async () => {
    const generation2 = await prisma.reportRevision.findFirstOrThrow({
      where: { scoreSnapshotId: snapshotId, generation: 2 }, select: { id: true },
    });
    await expect(executeReportRegeneration({
      actor: { userId: assistantId, role: 'ASSISTANTE' },
      revisionId: generation2.id,
      motif: 'Nouvelle version du rendu',
    })).rejects.toThrow('REGENERATION_CONFIRMATION_REQUIRED');
  });

  it('avec confirmation : génération 3 en revue, artefact TOUJOURS publié (la famille garde l’ancienne version)', async () => {
    const generation2 = await prisma.reportRevision.findFirstOrThrow({
      where: { scoreSnapshotId: snapshotId, generation: 2 }, select: { id: true },
    });
    const result = await executeReportRegeneration({
      actor: { userId: assistantId, role: 'ASSISTANTE' },
      revisionId: generation2.id,
      motif: 'Nouvelle version du rendu (test cas publié)',
      confirmAlreadyPublished: true,
    });
    expect(result.generation).toBe(3);

    const attempt = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({
      where: { id: attemptId }, select: { status: true },
    });
    expect(attempt.status).toBe('REPORT_PENDING_REVIEW');

    const artifact = await prisma.reportArtifact.findUniqueOrThrow({
      where: { id: artifactId },
      select: { status: true, currentPublishedRevisionId: true },
    });
    expect(artifact.status).toBe('PUBLISHED');
    expect(artifact.currentPublishedRevisionId).toBe(generation2.id);

    const trace = await prisma.reportRegeneration.findFirstOrThrow({
      where: { toRevisionId: result.newRevisionId },
      select: { wasPublished: true },
    });
    expect(trace.wasPublished).toBe(true);

    // Publiée reste servie : la matérialisation de la génération 2 est intacte.
    const materialized = await prisma.reportAudienceArtifact.findFirst({
      where: { materialization: { revisionId: generation2.id }, audience: 'PARENTS' },
      select: { html: true },
    });
    expect(materialized?.html).toBe('<html>gen2-PARENTS</html>');
  });

  it('re-validation + re-publication : le lien famille bascule sur la génération 3, l’historique reste', async () => {
    const generation3 = await prisma.reportRevision.findFirstOrThrow({
      where: { scoreSnapshotId: snapshotId, generation: 3 }, select: { id: true },
    });
    const { validateReportRevision, publishReportRevision } = await import('@/lib/bilans/core/report-service');
    await validateReportRevision({
      prisma,
      revisionId: generation3.id,
      reviewerId: assistantId,
      motif: 'Re-validation après régénération (test)',
      reviewedAt: new Date(),
    } as never);
    await publishReportRevision({
      prisma,
      revisionId: generation3.id,
      reviewerId: assistantId,
      publishedAt: new Date(),
    } as never);

    const artifact = await prisma.reportArtifact.findUniqueOrThrow({
      where: { id: artifactId },
      select: { status: true, currentPublishedRevisionId: true },
    });
    expect(artifact.status).toBe('PUBLISHED');
    expect(artifact.currentPublishedRevisionId).toBe(generation3.id);

    // L'historique intégral est là : trois générations pour UN snapshot.
    const generations = await prisma.reportRevision.findMany({
      where: { scoreSnapshotId: snapshotId },
      select: { generation: true, status: true },
      orderBy: { generation: 'asc' },
    });
    expect(generations.map(({ generation }) => generation)).toEqual([1, 2, 3]);
    // Et l'ancienne matérialisation publiée n'a pas bougé d'un octet.
    const oldMaterialized = await prisma.reportAudienceArtifact.findFirst({
      where: { materialization: { revisionId: artifact.currentPublishedRevisionId === null ? '' : (await prisma.reportRevision.findFirstOrThrow({ where: { scoreSnapshotId: snapshotId, generation: 2 }, select: { id: true } })).id }, audience: 'PARENTS' },
      select: { html: true },
    });
    expect(oldMaterialized?.html).toBe('<html>gen2-PARENTS</html>');
  });
});

describe('cas B option 3 — mention de remplacement, lien conservé, message d’information', () => {
  let shareToken: string;

  beforeAll(async () => {
    // Un lien signé créé À L'ÉPOQUE de la génération 2 publiée + transmission
    // confirmée : le parent a reçu et probablement lu la version précédente.
    const { createReportShareLinks } = await import('@/lib/bilans/staff/share-link-service');
    const parentUserId = (await prisma.reportArtifact.findUniqueOrThrow({
      where: { id: artifactId },
      select: { student: { select: { parent: { select: { userId: true } } } } },
    })).student.parent!.userId;
    const links = await createReportShareLinks({
      reportArtifactId: artifactId,
      recipientUserId: parentUserId,
      createdById: assistantId,
    });
    shareToken = links.find(({ audience }) => audience === 'PARENTS')!.token;
    await prisma.reportTransmission.create({
      data: {
        reportArtifactId: artifactId,
        channel: 'WHATSAPP',
        recipientUserId: parentUserId,
        confirmedById: assistantId,
        confirmedAt: new Date('2026-08-14T09:00:00Z'),
      },
    });
  });

  it('le MÊME lien reste valide et sert la génération re-publiée, avec l’information de remplacement datée', async () => {
    const { verifyAndConsumeShareToken } = await import('@/lib/bilans/staff/share-link-service');
    const verified = await verifyAndConsumeShareToken(shareToken);
    expect(verified).not.toBeNull();
    expect(verified!.updatedVersion).not.toBeNull();
    // updatedAt = matérialisation de la génération 3 ; replacesDate = celle de la génération 2.
    expect(verified!.updatedVersion!.updatedAt.getTime())
      .toBeGreaterThan(verified!.updatedVersion!.replacesDate.getTime());
  });

  it('transmission confirmée → le message d’information est préparé (sans toucher aux liens)', async () => {
    const { prepareUpdateInfoMessage } = await import('@/lib/bilans/staff/whatsapp-send-service');
    const activeLinksBefore = await prisma.reportShareLink.count({
      where: { reportArtifactId: artifactId, revokedAt: null },
    });
    const prepared = await prepareUpdateInfoMessage({
      actor: { userId: assistantId, role: 'ASSISTANTE' },
      reportArtifactId: artifactId,
    });
    expect(prepared.whatsappUrl).toContain('https://wa.me/');
    expect(prepared.message).toContain('affiné');
    expect(prepared.message).toContain('même accès');
    // Rien n'est révoqué, rien n'est réémis.
    const activeLinksAfter = await prisma.reportShareLink.count({
      where: { reportArtifactId: artifactId, revokedAt: null },
    });
    expect(activeLinksAfter).toBe(activeLinksBefore);
  });

  it('sans transmission confirmée → la mention sur la page suffit, pas de message', async () => {
    await prisma.$executeRawUnsafe('ALTER TABLE "canonical_report_transmissions" DISABLE TRIGGER USER');
    await prisma.reportTransmission.deleteMany({ where: { reportArtifactId: artifactId } });
    await prisma.$executeRawUnsafe('ALTER TABLE "canonical_report_transmissions" ENABLE TRIGGER USER');
    const { prepareUpdateInfoMessage } = await import('@/lib/bilans/staff/whatsapp-send-service');
    await expect(prepareUpdateInfoMessage({
      actor: { userId: assistantId, role: 'ASSISTANTE' },
      reportArtifactId: artifactId,
    })).rejects.toThrow('WHATSAPP_UPDATE_INFO_NO_PRIOR_TRANSMISSION');
    // La mention de la page, elle, reste disponible (données de génération).
    const { readPublishedVersionReplacement } = await import('@/lib/bilans/staff/share-link-service');
    const replacement = await readPublishedVersionReplacement(artifactId);
    expect(replacement).not.toBeNull();
  });
});

describe('une seule version visible sur toutes les surfaces', () => {
  it('dashboard assistante : une seule ligne pour l’artefact, la génération courante', async () => {
    const { listRecentReportReviews } = await import('@/lib/bilans/staff/review-service');
    const rows = await listRecentReportReviews({ userId: assistantId, role: 'ASSISTANTE' });
    const forArtifact = rows.filter((r) => r.reportArtifact.id === artifactId);
    expect(forArtifact).toHaveLength(1);
    // C'est la génération maximale (3 après re-publication) — jamais 1 ni 2.
    expect(forArtifact[0].generation).toBe(3);
    expect(forArtifact.some((r) => r.generation === 1 || r.generation === 2)).toBe(false);
  });

  it('lien signé + surfaces familles : servent la génération courante, l’ancienne matérialisation n’est plus référencée', async () => {
    const artifact = await prisma.reportArtifact.findUniqueOrThrow({
      where: { id: artifactId },
      select: { currentPublishedRevisionId: true },
    });
    const gen3 = await prisma.reportRevision.findFirstOrThrow({
      where: { scoreSnapshotId: snapshotId, generation: 3 }, select: { id: true },
    });
    // Toutes les surfaces familles (lien, parent, élève, PDF) sélectionnent
    // currentPublishedRevisionId : il pointe la génération 3, jamais 1/2.
    expect(artifact.currentPublishedRevisionId).toBe(gen3.id);

    // L'ancienne génération 2 garde sa matérialisation en base (append-only)
    // mais n'est plus la version courante — donc invisible partout.
    const gen2 = await prisma.reportRevision.findFirstOrThrow({
      where: { scoreSnapshotId: snapshotId, generation: 2 },
      select: { id: true, materialization: { select: { id: true } } },
    });
    expect(gen2.materialization).not.toBeNull();
    expect(gen2.id).not.toBe(artifact.currentPublishedRevisionId);

    // Le document servi par un lien signé frais n'est PAS l'ancienne
    // matérialisation gén.2 (HTML de test « <html>gen2-PARENTS</html> »).
    const { createReportShareLinks, verifyAndConsumeShareToken } = await import('@/lib/bilans/staff/share-link-service');
    const parentUserId = (await prisma.reportArtifact.findUniqueOrThrow({
      where: { id: artifactId },
      select: { student: { select: { parent: { select: { userId: true } } } } },
    })).student.parent.userId;
    const links = await createReportShareLinks({
      reportArtifactId: artifactId, recipientUserId: parentUserId, createdById: assistantId,
    });
    const token = links.find(({ audience }) => audience === 'PARENTS')!.token;
    const served = await verifyAndConsumeShareToken(token);
    expect(served).not.toBeNull();
    expect(served!.html).not.toBe('<html>gen2-PARENTS</html>');
  });
});

