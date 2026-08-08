jest.unmock('@/lib/prisma');

/**
 * La saisie papier, de bout en bout, sur PostgreSQL réel.
 *
 * Deux choses s'y prouvent, et elles ne se prouvent qu'ici :
 *
 * 1. **Parité réelle.** Le même jeu de réponses, écrit une fois par la route
 *    de saisie papier et une fois par le chemin de la passation en ligne,
 *    passe par le vrai worker de scoring et produit le même snapshot — même
 *    score, même profil, même calibration.
 * 2. **Le piège append-only.** Les triggers de la table refusent bel et bien
 *    de réécrire une provenance, et la contrainte refuse une saisie papier
 *    sans saisisseur. Un test sur le texte de la migration ne le montrerait
 *    pas ; celui-ci fait échouer les requêtes pour de vrai.
 */

import { NextRequest } from 'next/server';

import { createGetAttemptHandler } from '@/lib/bilans/api/get-attempt';
import { createPaperEntryHandler } from '@/lib/bilans/api/paper-entry';
import { createPatchAnswersHandler } from '@/lib/bilans/api/patch-answers';
import { createSubmitAttemptHandler } from '@/lib/bilans/api/submit-attempt';
import { prisma } from '@/lib/prisma';
import { processScoreAttemptJob } from '@/lib/bilans/worker/score-job';

import {
  CANONICAL_WORKER_ENABLED_PACK,
  CANONICAL_WORKER_PACK,
} from '@/__tests__/bilans/fixtures/canonical-worker';

const PREFIX = `saisie-papier-${Date.now()}-`;
const NOW = new Date('2026-08-08T15:00:00.000Z');
const PACK = CANONICAL_WORKER_ENABLED_PACK.pack;

/** Un jeu de réponses connu : bonnes et mauvaises, certitudes variées. */
const RESPONSES = PACK.questionnaire.items.map((item, index) => ({
  itemId: item.id,
  optionId: index % 3 === 0
    ? item.options.find(({ isCorrect }) => isCorrect)!.id
    : item.options.find(({ isCorrect }) => !isCorrect)!.id,
  confidence: ((index % 4) + 1) as 1 | 2 | 3 | 4,
}));

const STORED_ANSWERS = Object.fromEntries(
  RESPONSES.map(({ itemId, optionId, confidence }) => [itemId, { optionId, confidence }]),
);

const logger = { info: jest.fn(), error: jest.fn() };

describe('Saisie papier — parité et provenance sur PostgreSQL réel', () => {
  let studentId: string;
  let studentUserId: string;
  let staffUserId: string;

  const workerDependencies = {
    prisma,
    resolvePack: () => CANONICAL_WORKER_ENABLED_PACK,
    now: () => NOW,
    logger,
  };

  function paperHandler(actorId: string, role = 'ASSISTANTE') {
    return createPaperEntryHandler({
      prisma: prisma as never,
      authenticate: async () => ({ user: { id: actorId, role } } as never),
      resolvePack: () => CANONICAL_WORKER_ENABLED_PACK,
      now: () => NOW,
      generateSeed: () => `${PREFIX}paper-seed`,
    });
  }

  function paperRequest(key: string, body: unknown) {
    return new NextRequest('http://localhost/api/bilans/saisie-papier', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify(body),
    });
  }

  /**
   * Le chemin en ligne : un attempt en DRAFT dont les réponses ont été
   * accumulées par les PATCH successifs du questionnaire, puis soumis par la
   * vraie route de soumission.
   */
  async function submitOnlineAttempt(): Promise<string> {
    const attempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId,
        status: 'DRAFT',
        provenance: 'EN_LIGNE',
        seed: `${PREFIX}online-seed`,
        startedAt: NOW,
        expiresAt: new Date(NOW.getTime() + 3_600_000),
        revision: 4,
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        answers: STORED_ANSWERS,
        curriculumId: 'terminale.maths',
        curriculumVersion: '1',
        assessmentPackId: PACK.slug,
        assessmentPackVersion: String(PACK.version),
        assessmentPackChecksum: CANONICAL_WORKER_ENABLED_PACK.checksum,
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
      },
    });

    const submit = createSubmitAttemptHandler({
      prisma: prisma as never,
      authenticate: async () => ({ user: { id: studentUserId, role: 'ELEVE' } } as never),
      resolvePack: () => CANONICAL_WORKER_ENABLED_PACK,
      now: () => NOW,
    });
    const response = await submit(
      new NextRequest(`http://localhost/api/bilans/attempts/${attempt.id}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': `${PREFIX}online-submit` },
        body: JSON.stringify({ revision: 4 }),
      }),
      { params: Promise.resolve({ id: attempt.id }) },
    );
    expect(response.status).toBe(200);
    return attempt.id;
  }

  async function scoreAttempt(attemptId: string) {
    const job = await prisma.jobOutbox.findUniqueOrThrow({
      where: { idempotencyKey: `${attemptId}.score` },
    });
    await processScoreAttemptJob(job.id, workerDependencies);
    return prisma.scoreSnapshot.findUniqueOrThrow({ where: { assessmentAttemptId: attemptId } });
  }

  beforeAll(async () => {
    const parentUser = await prisma.user.create({
      data: { email: `${PREFIX}parent@example.test`, role: 'PARENT' },
    });
    const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const studentUser = await prisma.user.create({
      data: { email: `${PREFIX}eleve@example.test`, role: 'ELEVE' },
    });
    studentUserId = studentUser.id;
    const student = await prisma.student.create({
      data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'TERMINALE' },
    });
    studentId = student.id;
    const staff = await prisma.user.create({
      data: { email: `${PREFIX}assistante@example.test`, role: 'ASSISTANTE' },
    });
    staffUserId = staff.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "canonical_report_reviews", "canonical_report_revisions", "canonical_report_artifacts",
        "canonical_evidence_items", "canonical_score_snapshots", "canonical_job_outbox",
        "canonical_api_idempotency_keys", "canonical_assessment_attempts",
        "canonical_parent_student_links" CASCADE
    `);
    await prisma.student.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.parentProfile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  test('la saisie papier et la passation en ligne produisent le même score et le même profil', async () => {
    const onlineAttemptId = await submitOnlineAttempt();

    const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}paper-0001`, {
      studentId,
      packSlug: PACK.slug,
      answers: RESPONSES,
    }));
    expect(response.status).toBe(201);
    const { attemptId: paperAttemptId } = await response.json() as { attemptId: string };

    const [online, paper] = await Promise.all([
      scoreAttempt(onlineAttemptId),
      scoreAttempt(paperAttemptId),
    ]);

    expect(paper.score).toBe(online.score);
    expect(paper.scoringPolicyId).toBe(online.scoringPolicyId);
    expect(paper.scoringPolicyVersion).toBe(online.scoringPolicyVersion);
    expect(paper.scoringPolicyChecksum).toBe(online.scoringPolicyChecksum);

    // Le résultat complet : score global, domaines, nœuds, calibration.
    // `attemptId` et l'alias pseudonyme en sont dérivés, donc écartés.
    const comparable = (result: unknown) => JSON.stringify(result, (key, value) => (
      key === 'attemptId' || key === 'alias' ? undefined : value
    ));
    expect(comparable(paper.result)).toBe(comparable(online.result));

    const facts = paper.result as unknown as {
      globalScore: number;
      calibrationIndex: number | null;
      flags: readonly string[];
    };
    expect(facts.globalScore).toBeGreaterThan(0);
    expect(facts.globalScore).toBeLessThan(100);
    // Le volet métacognition est bien porté par la copie papier.
    expect(facts.calibrationIndex).not.toBeNull();

    // LIMITE CONNUE, documentée dans paper-entry.ts : la durée de composition
    // n'est pas sur la copie, donc le moteur en déduit une durée nulle et
    // lève PASSATION_EXPRESS sur tout bilan saisi. Le test l'énonce plutôt
    // que de le taire — si un jour ce drapeau est arbitré, il échouera ici, à
    // l'endroit exact où il faut le reconsidérer.
    expect(facts.flags).toContain('PASSATION_EXPRESS');

    const attempts = await prisma.canonicalAssessmentAttempt.findMany({
      where: { id: { in: [onlineAttemptId, paperAttemptId] } },
      select: { id: true, status: true, provenance: true, enteredById: true, enteredAt: true },
    });
    expect(attempts.find(({ id }) => id === onlineAttemptId)).toMatchObject({
      provenance: 'EN_LIGNE',
      enteredById: null,
      enteredAt: null,
    });
    expect(attempts.find(({ id }) => id === paperAttemptId)).toMatchObject({
      provenance: 'SAISIE_PAPIER',
      enteredById: staffUserId,
      enteredAt: NOW,
    });
  }, 60_000);

  test('la copie sans certitude est scorée sans certitude inventée', async () => {
    const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}paper-0002`, {
      studentId,
      packSlug: PACK.slug,
      answers: RESPONSES.map((answer) => ({ ...answer, confidence: null })),
    }));
    expect(response.status).toBe(201);
    const { attemptId } = await response.json() as { attemptId: string };

    const stored = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { answers: true },
    });
    const answers = stored.answers as Record<string, { confidence: unknown }>;
    for (const item of PACK.questionnaire.items) {
      expect(answers[item.id].confidence).toBeNull();
    }

    const snapshot = await scoreAttempt(attemptId);
    // Les faits par item sont persistés comme pièces probantes ; c'est là que
    // se lit la confiance retenue par le moteur.
    const evidence = await prisma.evidenceItem.findMany({
      where: { scoreSnapshotId: snapshot.id, kind: 'ANSWER' },
      select: { payload: true },
    });
    expect(evidence).toHaveLength(PACK.questionnaire.items.length);
    for (const { payload } of evidence) {
      expect((payload as { isConfident: boolean }).isConfident).toBe(false);
      expect((payload as { profile: string }).profile).not.toBe('ERREUR_CONFIANTE');
    }
    // Sans aucune certitude déclarée, la calibration n'est pas inventée non
    // plus : elle vaut ce que le moteur en déduit, pas une valeur de confort.
    const factSheet = snapshot.result as unknown as { calibrationIndex: number | null };
    expect(factSheet.calibrationIndex).not.toBeUndefined();
  }, 60_000);

  /**
   * Une saisie papier n'ouvre aucune fenêtre de passation : la copie est déjà
   * passée. L'élève ne doit pouvoir ni la reprendre ni la modifier — sans quoi
   * la transcription du staff deviendrait un brouillon éditable.
   */
  test('une saisie papier n’est jamais reprenable par l’élève', async () => {
    const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}paper-0004`, {
      studentId,
      packSlug: PACK.slug,
      answers: RESPONSES,
    }));
    expect(response.status).toBe(201);
    const { attemptId } = await response.json() as { attemptId: string };

    const asStudent = async () => ({ user: { id: studentUserId, role: 'ELEVE' } } as never);

    const read = await createGetAttemptHandler({
      prisma: prisma as never,
      authenticate: asStudent,
      resolvePack: () => CANONICAL_WORKER_ENABLED_PACK,
      now: () => NOW,
    })(
      new NextRequest(`http://localhost/api/bilans/attempts/${attemptId}`),
      { params: Promise.resolve({ id: attemptId }) },
    );
    expect(read.status).toBe(404);

    const patched = await createPatchAnswersHandler({
      prisma: prisma as never,
      authenticate: asStudent,
      resolvePack: () => CANONICAL_WORKER_ENABLED_PACK,
      now: () => NOW,
    })(
      new NextRequest(`http://localhost/api/bilans/attempts/${attemptId}/answers`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'idempotency-key': `${PREFIX}patch-attempt` },
        body: JSON.stringify({
          revision: 1,
          answers: [{ itemId: RESPONSES[0].itemId, optionId: RESPONSES[0].optionId, confidence: 1 }],
        }),
      }),
      { params: Promise.resolve({ id: attemptId }) },
    );
    expect(patched.status).toBe(404);

    // Les réponses transcrites sont intactes.
    const stored = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { status: true, answers: true },
    });
    expect(stored.status).not.toBe('DRAFT');
    expect(stored.answers).toEqual(STORED_ANSWERS);
  }, 60_000);

  describe('append-only : la provenance ne peut pas être réécrite', () => {
    let attemptId: string;

    beforeAll(async () => {
      const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}paper-0003`, {
        studentId,
        packSlug: PACK.slug,
        answers: RESPONSES,
      }));
      expect(response.status).toBe(201);
      ({ attemptId } = await response.json() as { attemptId: string });
    });

    test('un UPDATE de la provenance est rejeté par la base', async () => {
      await expect(prisma.$executeRawUnsafe(
        `UPDATE "canonical_assessment_attempts" SET "provenance" = 'EN_LIGNE' WHERE "id" = $1`,
        attemptId,
      )).rejects.toThrow(/provenance is set at creation and can never be updated/);
    });

    test('un UPDATE du saisisseur ou de la date de saisie est rejeté', async () => {
      await expect(prisma.$executeRawUnsafe(
        `UPDATE "canonical_assessment_attempts" SET "enteredById" = NULL WHERE "id" = $1`,
        attemptId,
      )).rejects.toThrow(/provenance is set at creation and can never be updated/);
      await expect(prisma.$executeRawUnsafe(
        `UPDATE "canonical_assessment_attempts" SET "enteredAt" = NOW() WHERE "id" = $1`,
        attemptId,
      )).rejects.toThrow(/provenance is set at creation and can never be updated/);
    });

    test('la provenance survit intacte à ces tentatives', async () => {
      const attempt = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({
        where: { id: attemptId },
        select: { provenance: true, enteredById: true, enteredAt: true },
      });
      expect(attempt).toMatchObject({
        provenance: 'SAISIE_PAPIER',
        enteredById: staffUserId,
        enteredAt: NOW,
      });
    });

    test('une saisie papier sans saisisseur est refusée par la contrainte', async () => {
      await expect(prisma.canonicalAssessmentAttempt.create({
        data: {
          studentId,
          status: 'DRAFT',
          provenance: 'SAISIE_PAPIER',
          seed: `${PREFIX}invalid-seed`,
          startedAt: NOW,
          expiresAt: NOW,
          subject: 'MATHEMATIQUES',
          gradeLevel: 'TERMINALE',
          answers: STORED_ANSWERS,
          curriculumId: 'terminale.maths',
          curriculumVersion: '1',
          assessmentPackId: PACK.slug,
          assessmentPackVersion: String(PACK.version),
          assessmentPackChecksum: CANONICAL_WORKER_ENABLED_PACK.checksum,
          scoringPolicyId: 'facts',
          scoringPolicyVersion: '1.0.1',
        },
      })).rejects.toThrow();
    });

    test('une passation en ligne portant un saisisseur est refusée par la contrainte', async () => {
      await expect(prisma.canonicalAssessmentAttempt.create({
        data: {
          studentId,
          status: 'DRAFT',
          provenance: 'EN_LIGNE',
          enteredById: staffUserId,
          enteredAt: NOW,
          seed: `${PREFIX}invalid-seed-2`,
          startedAt: NOW,
          expiresAt: NOW,
          subject: 'MATHEMATIQUES',
          gradeLevel: 'TERMINALE',
          answers: STORED_ANSWERS,
          curriculumId: 'terminale.maths',
          curriculumVersion: '1',
          assessmentPackId: PACK.slug,
          assessmentPackVersion: String(PACK.version),
          assessmentPackChecksum: CANONICAL_WORKER_ENABLED_PACK.checksum,
          scoringPolicyId: 'facts',
          scoringPolicyVersion: '1.0.1',
        },
      })).rejects.toThrow();
    });
  });
});
