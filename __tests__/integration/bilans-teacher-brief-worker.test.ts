jest.unmock('@/lib/prisma');

import { prisma } from '@/lib/prisma';
import { processScoreAttemptJob } from '@/lib/bilans/worker/score-job';
import { processGenerateReportJob } from '@/lib/bilans/worker/generate-report-job';
import { processGenerateTeacherBriefJob } from '@/lib/bilans/worker/generate-teacher-brief-job';
import { drainTeacherBriefJobs } from '@/lib/bilans/worker/drain-outbox';
import { enqueueTeacherBriefGeneration } from '@/lib/bilans/llm/teacher-brief-enqueue';
import { reserveBudget, regularizeBudget, releaseBudget } from '@/lib/bilans/llm/teacher-brief-budget';
import { TEACHER_BRIEF_PROMPT_VERSION } from '@/lib/bilans/llm/teacher-brief-schema';
import {
  CANONICAL_WORKER_ANSWERS,
  CANONICAL_WORKER_ENABLED_PACK,
} from '@/__tests__/bilans/fixtures/canonical-worker';

/**
 * Preuve d'intégration réelle (base PostgreSQL réelle, jamais de mock de
 * `$queryRaw`) du worker asynchrone de génération de brief enseignant
 * (§7/§8/§10/§11 de l'incident P0 du 2026-08-16) : idempotence, staleness,
 * classification des échecs, budget atomique, journal des tentatives.
 */

const PREFIX = `a90-${Date.now()}-`;
const NOW = new Date('2026-08-16T10:00:00.000Z');
const logger = { info: jest.fn(), error: jest.fn() };

type FactsDomain = { domainId: string; itemsRates: { itemId: string }[] };

function validDomainResponse(domain: FactsDomain) {
  // L'ancrage (assertBriefRespectsFacts) exige une citation réelle dès que le
  // domaine a des items ratés — jamais un itemId inventé, jamais vide dans ce cas.
  const itemIds = domain.itemsRates.length > 0 ? [domain.itemsRates[0].itemId] : [];
  return {
    domainId: domain.domainId,
    erreursTypiques: [{
      constat: 'Confusion entre deux règles proches.',
      origine: 'Généralisation hâtive.',
      itemIds,
    }],
    prerequisAVerifier: ['Prérequis A.'],
    activite: {
      titre: 'Activité test',
      objectif: 'Objectif test.',
      materiel: 'Ardoises.',
      deroule: [
        { nom: 'Phase 1', dureeMin: 10, consigne: 'Consigne 1.' },
        { nom: 'Phase 2', dureeMin: 10, consigne: 'Consigne 2.' },
        { nom: 'Phase 3', dureeMin: 10, consigne: 'Consigne 3.' },
      ],
      differenciation: 'Différenciation test.',
    },
    indicateurProgres: 'Indicateur test.',
  };
}

function fetchDomainAware(): typeof fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { messages: { content: unknown }[] };
    const facts = JSON.parse(String(body.messages[1].content)) as { domainesPrioritaires: FactsDomain[] };
    const domain = facts.domainesPrioritaires[0];
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ version: TEACHER_BRIEF_PROMPT_VERSION, domaines: [validDomainResponse(domain)] }) } }],
      usage: { prompt_tokens: 2000, completion_tokens: 1000, prompt_tokens_details: { cached_tokens: 1500 } },
    }), { status: 200 });
  }) as typeof fetch;
}

describe('A90 — worker asynchrone de génération de brief enseignant', () => {
  let studentId: string;
  let assistanteUserId: string;

  async function seedReportArtifact(suffix: string) {
    const attempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId,
        status: 'SUBMITTED',
        seed: `${PREFIX}${suffix}-seed`,
        startedAt: new Date('2026-08-16T09:40:00.000Z'),
        expiresAt: new Date('2026-08-17T09:40:00.000Z'),
        revision: 2,
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        answers: CANONICAL_WORKER_ANSWERS,
        submittedAt: new Date('2026-08-16T09:55:00.000Z'),
        curriculumId: 'terminale.maths',
        curriculumVersion: '1',
        assessmentPackId: CANONICAL_WORKER_ENABLED_PACK.pack.slug,
        assessmentPackVersion: String(CANONICAL_WORKER_ENABLED_PACK.pack.version),
        assessmentPackChecksum: CANONICAL_WORKER_ENABLED_PACK.checksum,
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
      },
    });
    const scoreJob = await prisma.jobOutbox.create({
      data: {
        jobType: 'SCORE_ATTEMPT',
        aggregateType: 'CanonicalAssessmentAttempt',
        aggregateId: attempt.id,
        sourceEventKey: `${attempt.id}.submitted`,
        idempotencyKey: `${attempt.id}.score`,
        payload: { attemptId: attempt.id, packSlug: CANONICAL_WORKER_ENABLED_PACK.pack.slug, packVersion: CANONICAL_WORKER_ENABLED_PACK.pack.version },
      },
    });
    const scoreDeps = { prisma, resolvePack: () => CANONICAL_WORKER_ENABLED_PACK, now: () => NOW, logger };
    await processScoreAttemptJob(scoreJob.id, scoreDeps);
    const reportJob = await prisma.jobOutbox.findUniqueOrThrow({ where: { idempotencyKey: `${attempt.id}.generate-report` } });
    await processGenerateReportJob(reportJob.id, { ...scoreDeps, buildTransport: () => { throw new Error('unused'); } } as never);
    const artifact = await prisma.reportArtifact.findFirstOrThrow({
      where: { assessmentAttemptId: attempt.id },
      include: { revisions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return { attemptId: attempt.id, artifactId: artifact.id, scoreSnapshotId: artifact.revisions[0].scoreSnapshotId };
  }

  async function seedTeacherBriefJob(artifactId: string, expectedScoreSnapshotId: string) {
    await enqueueTeacherBriefGeneration(artifactId, expectedScoreSnapshotId, assistanteUserId, prisma);
    return prisma.jobOutbox.findUniqueOrThrow({
      where: { idempotencyKey: `teacher-brief:${artifactId}:${expectedScoreSnapshotId}` },
    });
  }

  const jobDependencies = (fetchImpl: typeof fetch, monthlyBudgetUsd = 20) => ({
    prisma,
    resolvePack: () => CANONICAL_WORKER_ENABLED_PACK,
    resolveConfig: () => ({
      apiKey: 'test-key', model: 'anthropic/claude-sonnet-4.5', maxTokens: 2000, temperature: 0.3,
      timeoutMs: 45_000, monthlyBudgetUsd, baseUrl: 'https://openrouter.ai/api/v1', supportsPromptCaching: true,
    }),
    fetchImpl,
    now: () => NOW,
    logger,
    reserveBudget,
    regularizeBudget,
    releaseBudget,
  });

  beforeAll(async () => {
    const studentUser = await prisma.user.create({
      data: { email: `${PREFIX}student@example.test`, role: 'ELEVE', firstName: 'Test', lastName: 'Worker' },
    });
    const parentUser = await prisma.user.create({ data: { email: `${PREFIX}parent@example.test`, role: 'PARENT' } });
    const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const student = await prisma.student.create({ data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'TERMINALE' } });
    studentId = student.id;
    const assistanteUser = await prisma.user.create({ data: { email: `${PREFIX}assistante@example.test`, role: 'ASSISTANTE' } });
    assistanteUserId = assistanteUser.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "canonical_teacher_brief_attempts", "canonical_teacher_brief_annotations", "canonical_teacher_briefs",
        "canonical_report_revisions", "canonical_report_artifacts", "canonical_evidence_items",
        "canonical_score_snapshots", "canonical_job_outbox", "canonical_assessment_attempts"
      CASCADE
    `);
    await prisma.student.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.parentProfile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.teacherBriefMonthlyBudget.deleteMany({ where: { monthStart: new Date(Date.UTC(2026, 7, 1)) } });
    await prisma.$disconnect();
  });

  test('succès : GENERATED crée un brief PENDING_REVIEW, journalise la tentative, complète le job, comptabilise le coût réel', async () => {
    const { artifactId, scoreSnapshotId } = await seedReportArtifact('success');
    const job = await seedTeacherBriefJob(artifactId, scoreSnapshotId);

    const result = await processGenerateTeacherBriefJob(job.id, jobDependencies(fetchDomainAware()));
    expect(result.result).toBe('GENERATED');

    const brief = await prisma.teacherBrief.findFirstOrThrow({ where: { reportArtifactId: artifactId } });
    expect(brief.status).toBe('PENDING_REVIEW');
    expect(brief.scoreSnapshotId).toBe(scoreSnapshotId);

    const attempt = await prisma.teacherBriefAttempt.findFirstOrThrow({ where: { reportArtifactId: artifactId } });
    expect(attempt.result).toBe('GENERATED');
    expect(attempt.jobId).toBe(job.id);
    expect(Number(attempt.estimatedCostUsd)).toBeGreaterThan(0);

    const updatedJob = await prisma.jobOutbox.findUniqueOrThrow({ where: { id: job.id } });
    expect(updatedJob.status).toBe('COMPLETED');
  });

  test('idempotence : un brief déjà présent (PENDING_REVIEW) => ALREADY_PRESENT, aucun appel réseau', async () => {
    const { artifactId, scoreSnapshotId } = await seedReportArtifact('already-present');
    const job1 = await seedTeacherBriefJob(artifactId, scoreSnapshotId);
    await processGenerateTeacherBriefJob(job1.id, jobDependencies(fetchDomainAware()));

    const fetchSpy = jest.fn(fetchDomainAware());
    // Deuxième job pour le MÊME (artifactId, scoreSnapshotId) : idempotencyKey identique => ON CONFLICT DO NOTHING, aucun second job créé.
    await enqueueTeacherBriefGeneration(artifactId, scoreSnapshotId, assistanteUserId, prisma);
    const jobs = await prisma.jobOutbox.findMany({ where: { aggregateId: artifactId, jobType: 'GENERATE_TEACHER_BRIEF' } });
    expect(jobs).toHaveLength(1);

    const result = await processGenerateTeacherBriefJob(jobs[0].id, jobDependencies(fetchSpy as unknown as typeof fetch));
    expect(result.result).toBe('ALREADY_PRESENT');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.teacherBrief.count({ where: { reportArtifactId: artifactId } })).toBe(1);
  });

  test('STALE_INPUT : le job porte un scoreSnapshotId différent du courant => aucun appel réseau, job terminal', async () => {
    const { artifactId } = await seedReportArtifact('stale');
    const fakeJob = await prisma.jobOutbox.create({
      data: {
        jobType: 'GENERATE_TEACHER_BRIEF', aggregateType: 'TeacherBrief', aggregateId: artifactId,
        sourceEventKey: `${PREFIX}stale-source`, idempotencyKey: `${PREFIX}stale-idem`,
        payload: { reportArtifactId: artifactId, expectedScoreSnapshotId: 'snapshot-obsolete-inexistant', actorId: assistanteUserId },
      },
    });
    const fetchSpy = jest.fn(fetchDomainAware());
    const result = await processGenerateTeacherBriefJob(fakeJob.id, jobDependencies(fetchSpy as unknown as typeof fetch));
    expect(result.result).toBe('STALE_INPUT');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.teacherBrief.count({ where: { reportArtifactId: artifactId } })).toBe(0);
    const attempt = await prisma.teacherBriefAttempt.findFirstOrThrow({ where: { reportArtifactId: artifactId } });
    expect(attempt.result).toBe('STALE_INPUT');
    expect((await prisma.jobOutbox.findUniqueOrThrow({ where: { id: fakeJob.id } })).status).toBe('COMPLETED');
  });

  test('RETRYABLE_FAILURE : HTTP 500 => job FAILED (repris par le cycle de drain), jamais COMPLETED', async () => {
    const { artifactId, scoreSnapshotId } = await seedReportArtifact('retryable');
    const job = await seedTeacherBriefJob(artifactId, scoreSnapshotId);
    const fetch500: typeof fetch = (async () => new Response('{}', { status: 500 })) as typeof fetch;

    await expect(processGenerateTeacherBriefJob(job.id, jobDependencies(fetch500))).rejects.toThrow('TEACHER_BRIEF_HTTP_500');

    const attempt = await prisma.teacherBriefAttempt.findFirstOrThrow({ where: { reportArtifactId: artifactId } });
    expect(attempt.result).toBe('RETRYABLE_FAILURE');
    expect(attempt.causeCode).toBe('TEACHER_BRIEF_HTTP_500');
    const updatedJob = await prisma.jobOutbox.findUniqueOrThrow({ where: { id: job.id } });
    expect(updatedJob.status).toBe('FAILED');
    expect(await prisma.teacherBrief.count({ where: { reportArtifactId: artifactId } })).toBe(0);
    // Un job FAILED reste réclamable par construction (c'est le point du test :
    // le cycle de drain le reprendra). Le retirer ici évite qu'il pollue le
    // test dédié à la reprise après un job LEASED orphelin, plus loin dans ce
    // même fichier : `drainTeacherBriefJobs({ limit: 1 })` prendrait sinon CE
    // job (plus ancien) plutôt que celui du test suivant.
    await prisma.jobOutbox.delete({ where: { id: job.id } });
  });

  test('coût partiel : un domaine facturé avec succès reste compté même si le domaine suivant échoue (§7)', async () => {
    const { artifactId, scoreSnapshotId } = await seedReportArtifact('partial-cost');
    const job = await seedTeacherBriefJob(artifactId, scoreSnapshotId);
    let call = 0;
    const flaky: typeof fetch = (async (_url: unknown, init?: RequestInit) => {
      call += 1;
      if (call >= 2) return new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }), { status: 200 });
      const body = JSON.parse(String(init?.body)) as { messages: { content: unknown }[] };
      const facts = JSON.parse(String(body.messages[1].content)) as { domainesPrioritaires: FactsDomain[] };
      const domain = validDomainResponse(facts.domainesPrioritaires[0]);
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ version: TEACHER_BRIEF_PROMPT_VERSION, domaines: [domain] }) } }],
        usage: { prompt_tokens: 2000, completion_tokens: 1000, prompt_tokens_details: { cached_tokens: 1500 } },
      }), { status: 200 });
    }) as typeof fetch;

    await expect(processGenerateTeacherBriefJob(job.id, jobDependencies(flaky))).rejects.toThrow('TEACHER_BRIEF_INVALID_JSON');

    const attempt = await prisma.teacherBriefAttempt.findFirstOrThrow({ where: { reportArtifactId: artifactId } });
    expect(attempt.result).toBe('RETRYABLE_FAILURE');
    // Le premier domaine a bien été facturé (tokens réels, coût > 0) — pas
    // un coût à zéro silencieux malgré l'échec global de la tentative.
    expect(Number(attempt.promptTokens)).toBe(0); // agrégat global non recalculé sur échec (voir domainOutcomes pour le détail)
    expect(Number(attempt.estimatedCostUsd)).toBeGreaterThan(0);
    expect(attempt.domainsProcessed).toBeGreaterThanOrEqual(1);
    const outcomes = attempt.domainOutcomes as unknown as { outcome: string; costUsd: number | null }[];
    expect(outcomes[0].outcome).toBe('OK');
    expect(outcomes[0].costUsd).toBeGreaterThan(0);
    expect(outcomes.some((entry) => entry.outcome !== 'OK')).toBe(true);
    // Même raison que le test RETRYABLE_FAILURE ci-dessus : un job FAILED
    // reste réclamable, à retirer pour ne pas polluer le test de reprise
    // après job orphelin plus loin dans ce fichier.
    await prisma.jobOutbox.delete({ where: { id: job.id } });
  });

  test('BLOCKED_FAILURE : terme interdit dans la sortie => job COMPLETED, jamais retenté automatiquement', async () => {
    const { artifactId, scoreSnapshotId } = await seedReportArtifact('blocked');
    const job = await seedTeacherBriefJob(artifactId, scoreSnapshotId);
    const fetchForbidden: typeof fetch = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: { content: unknown }[] };
      const facts = JSON.parse(String(body.messages[1].content)) as { domainesPrioritaires: FactsDomain[] };
      const domain = validDomainResponse(facts.domainesPrioritaires[0]);
      domain.indicateurProgres = 'La réussite est garantie après cette séance.';
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ version: TEACHER_BRIEF_PROMPT_VERSION, domaines: [domain] }) } }],
        usage: { prompt_tokens: 2000, completion_tokens: 1000 },
      }), { status: 200 });
    }) as typeof fetch;

    const result = await processGenerateTeacherBriefJob(job.id, jobDependencies(fetchForbidden));
    expect(result.result).toBe('BLOCKED_FAILURE');
    const attempt = await prisma.teacherBriefAttempt.findFirstOrThrow({ where: { reportArtifactId: artifactId } });
    expect(attempt.causeCode).toBe('TEACHER_BRIEF_FORBIDDEN_TERM');
    expect((await prisma.jobOutbox.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('COMPLETED');
  });

  test('BUDGET_BLOCKED : budget mensuel épuisé => aucun appel réseau, job terminal, rien facturé', async () => {
    const { artifactId, scoreSnapshotId } = await seedReportArtifact('budget');
    const job = await seedTeacherBriefJob(artifactId, scoreSnapshotId);
    // Prépare la précondition "budget épuisé" (écriture directe de test, distincte du mécanisme atomique testé ailleurs).
    await prisma.teacherBriefMonthlyBudget.upsert({
      where: { monthStart: new Date(Date.UTC(2026, 7, 1)) },
      create: { monthStart: new Date(Date.UTC(2026, 7, 1)), budgetUsd: 20, spentUsd: 20 },
      update: { spentUsd: 20 },
    });
    const fetchSpy = jest.fn(fetchDomainAware());
    try {
      const result = await processGenerateTeacherBriefJob(job.id, jobDependencies(fetchSpy as unknown as typeof fetch));
      expect(result.result).toBe('BUDGET_BLOCKED');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect((await prisma.jobOutbox.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('COMPLETED');
    } finally {
      // Le budget mensuel est un état partagé (une ligne par mois) : le restaurer
      // pour ne pas fausser les tests suivants du même fichier.
      await prisma.teacherBriefMonthlyBudget.update({
        where: { monthStart: new Date(Date.UTC(2026, 7, 1)) },
        data: { spentUsd: 0, reservedUsd: 0 },
      });
    }
  });

  test('drainTeacherBriefJobs traite la file en process — reprise après un job orphelin LEASED expiré', async () => {
    const { artifactId, scoreSnapshotId } = await seedReportArtifact('drain');
    const job = await seedTeacherBriefJob(artifactId, scoreSnapshotId);
    // Simule un worker mort en cours de traitement : LEASED, bail expiré.
    await prisma.jobOutbox.update({ where: { id: job.id }, data: { status: 'LEASED', leaseOwner: 'dead-worker', leaseExpiresAt: new Date('2020-01-01') } });

    const result = await drainTeacherBriefJobs({ limit: 1 }, { processJob: (jobId) => processGenerateTeacherBriefJob(jobId, jobDependencies(fetchDomainAware())) });
    expect(result.claimed).toBe(1);
    expect(result.completed).toBe(1);
    expect((await prisma.teacherBrief.findFirstOrThrow({ where: { reportArtifactId: artifactId } })).status).toBe('PENDING_REVIEW');
  });
});
