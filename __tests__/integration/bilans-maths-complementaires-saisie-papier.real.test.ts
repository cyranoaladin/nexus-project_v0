jest.unmock('@/lib/prisma');

/**
 * Chaîne complète « copie papier → bilan » pour le pack
 * `entree-terminale-maths-complementaires-v1`, sur PostgreSQL réel.
 *
 * Rien ici ne duplique le moteur : le test recalcule, À PART et uniquement pour
 * vérifier, le résultat attendu à partir des `isCorrect` de la banque, puis le
 * confronte au snapshot produit par le vrai worker. Le pack est résolu par le
 * vrai `resolveEnabledPack`, avec le drapeau d'activation posé dans le
 * processus de test seulement (jamais en production).
 *
 * Deux copies synthétiques, clairement identifiables (préfixe `mco-e2e-`) :
 *   A — profil global solide (toutes les réponses justes) ;
 *   B — difficultés ciblées (suites, dérivation, probabilités conditionnelles,
 *       un item logarithme erroné et une question sans réponse).
 */

import fs from 'node:fs';
import path from 'node:path';

import { NextRequest } from 'next/server';

import { createPaperEntryHandler } from '@/lib/bilans/api/paper-entry';
import { packFeatureFlagName, resolveEnabledPack } from '@/lib/bilans/api/pack-access';
import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';
import { SEVERITY_RANK } from '@/lib/bilans/facts/constants';
import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { ItemProfile } from '@/lib/bilans/facts/types';
import { domainTitle } from '@/lib/bilans/render/domain-labels';
import { extractPdfText } from '@/lib/bilans/render/pdf';
import type { ReportAudience } from '@/lib/bilans/render/profile-copy';
import { projectPaperEntryItems } from '@/lib/bilans/saisie-papier/projection';
import {
  listPendingReportReviews,
  listRecentReportReviews,
  previewPendingReport,
  validateAndPublishPendingReport,
} from '@/lib/bilans/staff/review-service';
import { processGenerateReportJob } from '@/lib/bilans/worker/generate-report-job';
import { processScoreAttemptJob } from '@/lib/bilans/worker/score-job';
import { prisma } from '@/lib/prisma';

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

const PACK_SLUG = 'entree-terminale-maths-complementaires-v1';
const PACK_PATH = `data/bilans/banks/${PACK_SLUG}.json`;
const FLAG = packFeatureFlagName(PACK_SLUG);
const PREFIX = `mco-e2e-${Date.now()}-`;
const NOW = new Date('2026-08-23T09:00:00.000Z');
const ARTIFACT_DIR = process.env.MCO_E2E_ARTIFACT_DIR?.trim() || null;

const PACK = loadBilanPack(PACK_PATH);
const ITEMS = PACK.questionnaire.items;
const TOTAL_WEIGHT = ITEMS.reduce((sum, item) => sum + item.difficulty, 0);

type Letter = 'A' | 'B' | 'C' | 'D';
type Confidence = 1 | 2 | 3 | 4 | null;
type PaperLine = Readonly<{ optionId: Letter | null; confidence: Confidence }>;
type PaperCopy = Readonly<Record<string, PaperLine>>;
type PendingReportPreview = Readonly<{
  official: false;
  audiences: readonly Readonly<{ audience: ReportAudience; html: string }>[];
}>;
type PublishedReport = Readonly<{ status: 'PUBLISHED' }>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pendingReportPreview(value: unknown): PendingReportPreview {
  if (
    !isRecord(value)
    || value.official !== false
    || !Array.isArray(value.audiences)
    || value.audiences.some((audience) => (
      !isRecord(audience)
      || !['ELEVE', 'PARENTS', 'NEXUS'].includes(String(audience.audience))
      || typeof audience.html !== 'string'
    ))
  ) throw new Error('PREVIEW_SHAPE_INVALID');
  return value as unknown as PendingReportPreview;
}

function publishedReport(value: unknown): PublishedReport {
  if (!isRecord(value) || value.status !== 'PUBLISHED') throw new Error('PUBLISH_RESULT_SHAPE_INVALID');
  return value as PublishedReport;
}

function normalizedHumanText(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&rsquo;|&#8217;|&#x2019;|&#39;/giu, '’')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function expectSafeMcoHumanText(value: string, logarithmTitle: string): void {
  const text = normalizedHumanText(value);
  expect(text).not.toMatch(/Non\s*:\s*la probabilité[\s\S]{0,180}59/i);
  expect(text).not.toMatch(/clé papier|mot\s+(?:«\s*)?Non|du PDF|incohérent/iu);
  expect(text).not.toMatch(/ETL-MCO-/iu);
  expect(text).not.toMatch(/lacune de Premi[èe]re/iu);
  expect(text).not.toMatch(/pr[eéè]requis\s+de\s+Premi[eéè]re\s+non\s+acquis/iu);
  expect(text).not.toMatch(
    /notion(?=[\s\S]{0,180}(?:(?:de|en)\s+Premi[eéè]re|l['’]\s*ann[eéè]e\s+pr[eéè]c[eéè]dente))(?=[\s\S]{0,180}(?:(?:[eéè]tait\s+(?:cens(?:[eé](?:e|s|es)?)\s+(?:(?:[êe]tre|avoir\s+[eé]t[eé])\s+)?)?(?:non\s+)?|cens(?:[eé](?:e|s|es)?)\s+(?:(?:[êe]tre|avoir\s+[eé]t[eé])\s+)?|non\s+)ma[iî]tris(?:[eé](?:e|s|es)?)))[\s\S]{0,180}/iu,
  );
  expect(text).toContain(logarithmTitle);
}

function correctLetter(itemId: string): Letter {
  const item = ITEMS.find(({ id }) => id === itemId);
  if (item === undefined) throw new Error(`item inconnu ${itemId}`);
  const correct = item.options.find(({ isCorrect }) => isCorrect);
  if (correct === undefined) throw new Error(`item sans réponse juste ${itemId}`);
  return correct.id as Letter;
}

function wrongLetter(itemId: string): Letter {
  const item = ITEMS.find(({ id }) => id === itemId);
  if (item === undefined) throw new Error(`item inconnu ${itemId}`);
  const wrong = [...item.options]
    .sort((left, right) => left.id.localeCompare(right.id))
    .find(({ isCorrect }) => !isCorrect);
  if (wrong === undefined) throw new Error(`item sans distracteur ${itemId}`);
  return wrong.id as Letter;
}

/** Toutes les réponses justes : un profil global solide. */
function buildCopyA(): PaperCopy {
  return Object.fromEntries(ITEMS.map((item) => [item.id, {
    optionId: correctLetter(item.id),
    confidence: item.id === 'ETL-MCO-SUI-02' || item.id === 'ETL-MCO-DER-02' ? 2 : 4,
  } satisfies PaperLine]));
}

/** Difficultés ciblées : erreurs choisies dans plusieurs domaines. */
function buildCopyB(): PaperCopy {
  const copy: Record<string, PaperLine> = Object.fromEntries(
    ITEMS.map((item) => [item.id, { optionId: correctLetter(item.id), confidence: 4 as const }]),
  );
  // Suites / évolutions : erreur confiante.
  copy['ETL-MCO-SUI-01'] = { optionId: wrongLetter('ETL-MCO-SUI-01'), confidence: 4 };
  copy['ETL-MCO-SUI-02'] = { optionId: correctLetter('ETL-MCO-SUI-02'), confidence: 3 };
  // Dérivation : lacune consciente.
  copy['ETL-MCO-DER-01'] = { optionId: wrongLetter('ETL-MCO-DER-01'), confidence: 2 };
  copy['ETL-MCO-DER-03'] = { optionId: correctLetter('ETL-MCO-DER-03'), confidence: 3 };
  // Probabilités conditionnelles : l'item bayésien coché « A » (95 %) avec assurance.
  copy['ETL-MCO-PRO-02'] = { optionId: 'A', confidence: 4 };
  copy['ETL-MCO-PRO-01'] = { optionId: correctLetter('ETL-MCO-PRO-01'), confidence: 3 };
  // Logarithme : un item erroné, peu sûr — repérage anticipé, pas une lacune de Première.
  copy['ETL-MCO-LOG-01'] = { optionId: wrongLetter('ETL-MCO-LOG-01'), confidence: 1 };
  copy['ETL-MCO-LOG-02'] = { optionId: correctLetter('ETL-MCO-LOG-02'), confidence: 2 };
  // Une question laissée sans réponse sur la copie.
  copy['ETL-MCO-VAR-01'] = { optionId: null, confidence: null };
  // Réponse cochée, mais aucune case de certitude cochée sur la copie.
  copy['ETL-MCO-TAU-02'] = { optionId: correctLetter('ETL-MCO-TAU-02'), confidence: null };
  return copy;
}

/* -------------------------------------------------------------------------- */
/* Attendu recalculé indépendamment (TEST UNIQUEMENT) à partir des isCorrect    */
/* -------------------------------------------------------------------------- */

type ExpectedItem = Readonly<{
  itemId: string;
  nodeCpsId: string;
  domainId: string;
  weight: number;
  rawSuccess: 0 | 1;
  answered: boolean;
  isConfident: boolean;
  profile: ItemProfile;
}>;

function expectedItems(copy: PaperCopy): readonly ExpectedItem[] {
  return ITEMS.map((item) => {
    const line = copy[item.id];
    const answered = line.optionId !== null;
    const rawSuccess: 0 | 1 = answered && line.optionId === correctLetter(item.id) ? 1 : 0;
    const isConfident = answered && line.confidence !== null && line.confidence >= 3;
    let profile: ItemProfile;
    if (!answered) profile = 'NON_TRAITE';
    else if (rawSuccess === 1) profile = isConfident ? 'MAITRISE' : 'MAITRISE_FRAGILE';
    else profile = isConfident ? 'ERREUR_CONFIANTE' : 'LACUNE_CONSCIENTE';
    return Object.freeze({
      itemId: item.id,
      nodeCpsId: item.nodeCpsId,
      domainId: item.domainId,
      weight: item.difficulty,
      rawSuccess,
      answered,
      isConfident,
      profile,
    });
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function expectedGlobalScore(copy: PaperCopy): number {
  const items = expectedItems(copy);
  return round1((100 * items.reduce((sum, item) => sum + item.rawSuccess * item.weight, 0)) / TOTAL_WEIGHT);
}

function expectedDomainScores(copy: PaperCopy): Readonly<Record<string, number>> {
  const items = expectedItems(copy);
  return Object.fromEntries(PACK.scoring.domains.map((domainId) => {
    const members = items.filter((item) => item.domainId === domainId);
    const weight = members.reduce((sum, item) => sum + item.weight, 0);
    const success = members.reduce((sum, item) => sum + item.rawSuccess * item.weight, 0);
    return [domainId, weight === 0 ? 0 : round1((100 * success) / weight)];
  }));
}

/** Règles de profil de nœud (spec §6) rejouées côté test. */
function expectedNodeProfile(members: readonly ExpectedItem[]): ItemProfile {
  const mass: Record<ItemProfile, number> = {
    MAITRISE: 0, MAITRISE_FRAGILE: 0, LACUNE_CONSCIENTE: 0, ERREUR_CONFIANTE: 0, NON_TRAITE: 0,
  };
  for (const item of members) mass[item.profile] += item.weight;
  const total = Object.values(mass).reduce((sum, value) => sum + value, 0);
  if (total === 0) return 'NON_TRAITE';
  if (mass.ERREUR_CONFIANTE > 0) return 'ERREUR_CONFIANTE';
  if (mass.NON_TRAITE / total > 0.5) return 'NON_TRAITE';
  if (mass.LACUNE_CONSCIENTE > 0) return 'LACUNE_CONSCIENTE';
  if (mass.NON_TRAITE > 0) return 'MAITRISE_FRAGILE';
  return mass.MAITRISE >= mass.MAITRISE_FRAGILE ? 'MAITRISE' : 'MAITRISE_FRAGILE';
}

function expectedDomainProfiles(copy: PaperCopy): Readonly<Record<string, ItemProfile>> {
  const items = expectedItems(copy);
  return Object.fromEntries(PACK.scoring.domains.map((domainId) => {
    const nodes = new Set(items.filter((item) => item.domainId === domainId).map((item) => item.nodeCpsId));
    let worst: ItemProfile = 'NON_TRAITE';
    let first = true;
    for (const nodeCpsId of nodes) {
      const profile = expectedNodeProfile(items.filter((item) => item.nodeCpsId === nodeCpsId));
      if (first || SEVERITY_RANK[profile] > SEVERITY_RANK[worst]) worst = profile;
      first = false;
    }
    return [domainId, worst];
  }));
}

function expectedCalibration(copy: PaperCopy): number | null {
  const treated = expectedItems(copy).filter((item) => item.answered);
  const weight = treated.reduce((sum, item) => sum + item.weight, 0);
  if (weight === 0) return null;
  const concordant = treated.reduce((sum, item) => (
    sum + ((item.rawSuccess === 1) === item.isConfident ? item.weight : 0)
  ), 0);
  return round1((100 * concordant) / weight);
}

/* -------------------------------------------------------------------------- */

const logger = { info: jest.fn(), error: jest.fn() };
const buildTransport = jest.fn((): never => {
  throw new Error('LLM_TRANSPORT_MUST_REMAIN_DISABLED');
});

function paperRequest(key: string, body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/bilans/saisie-papier', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(body),
  });
}

function answersFromCopy(copy: PaperCopy) {
  return ITEMS.map((item) => ({ itemId: item.id, ...copy[item.id] }));
}

function saveArtifact(name: string, content: string | Buffer): void {
  if (ARTIFACT_DIR === null) return;
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, name), content);
}

describe('garde de formulation du repérage anticipé Terminale', () => {
  const logarithmTitle = domainTitle('logarithme-reperage', 'MATHS_COMPLEMENTAIRES');

  test.each([
    '<p>prérequis de Première\n&nbsp;non acquis</p>',
    'Cette notion de Première était maîtrisée.',
    'Cette notion de Première était non maîtrisée.',
    'Cette notion était censée être maîtrisée\nen Première.',
    'Une notion censée avoir été maîtrisée l’année précédente.',
    "Une notion était non maîtrisée l'année précédente.",
  ])('refuse la formulation interdite « %s »', (unsafeText) => {
    expect(() => expectSafeMcoHumanText(`${logarithmTitle} ${unsafeText}`, logarithmTitle)).toThrow();
  });
});

describe('Mathématiques complémentaires — chaîne copie papier → bilan sur PostgreSQL réel', () => {
  let previousFlag: string | undefined;
  let previousNarrationFlag: string | undefined;
  let studentId: string;
  let studentBId: string;
  let premiereStudentId: string;
  let parentUserId: string;
  let staffUserId: string;

  const workerDependencies = { prisma, resolvePack: resolveEnabledPack, now: () => NOW, logger };

  function paperHandler(actorId: string, role = 'ASSISTANTE') {
    return createPaperEntryHandler({
      prisma: prisma as never,
      authenticate: async () => ({ user: { id: actorId, role } } as never),
      resolvePack: resolveEnabledPack,
      now: () => NOW,
      generateSeed: () => `${PREFIX}seed-${Math.random().toString(36).slice(2)}`,
    });
  }

  async function scoreAttempt(attemptId: string) {
    const job = await prisma.jobOutbox.findUniqueOrThrow({ where: { idempotencyKey: `${attemptId}.score` } });
    expect(job.jobType).toBe('SCORE_ATTEMPT');
    expect(job.status).toBe('PENDING');
    await processScoreAttemptJob(job.id, workerDependencies);
    const done = await prisma.jobOutbox.findUniqueOrThrow({ where: { id: job.id } });
    expect(done.status).toBe('COMPLETED');
    return prisma.scoreSnapshot.findUniqueOrThrow({ where: { assessmentAttemptId: attemptId } });
  }

  async function generateReport(attemptId: string) {
    const job = await prisma.jobOutbox.findUniqueOrThrow({ where: { idempotencyKey: `${attemptId}.generate-report` } });
    expect(job.jobType).toBe('GENERATE_REPORT');
    logger.info.mockClear();
    buildTransport.mockClear();
    const result = await processGenerateReportJob(job.id, {
      ...workerDependencies,
      // Le verrou de narration est la preuve : le transport ne doit même pas être construit.
      buildTransport,
    });
    expect(buildTransport).not.toHaveBeenCalled();
    const completionEvents = logger.info.mock.calls
      .map(([entry]) => entry)
      .filter((entry) => isRecord(entry) && entry.event === 'A88_GENERATE_REPORT_JOB_COMPLETED');
    expect(completionEvents).toHaveLength(1);
    expect(completionEvents[0]).toMatchObject({
      event: 'A88_GENERATE_REPORT_JOB_COMPLETED',
      mode: 'DETERMINISTIC_FALLBACK',
      replayed: false,
    });
    return prisma.reportRevision.findUniqueOrThrow({ where: { id: result.revisionId } });
  }

  beforeAll(async () => {
    assertDisposablePostgresUrl(process.env.DATABASE_URL ?? '');
    previousFlag = process.env[FLAG];
    previousNarrationFlag = process.env.NEXUS_BILAN_FAMILY_NARRATION_ENABLED;
    process.env[FLAG] = 'true';
    delete process.env.NEXUS_BILAN_FAMILY_NARRATION_ENABLED;

    const parentUser = await prisma.user.create({
      data: { email: null, role: 'PARENT', phone: '20 00 00 01', phoneNormalized: '20000001', firstName: 'Parent', lastName: 'Synthetique' },
    });
    parentUserId = parentUser.id;
    const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });

    const studentUser = await prisma.user.create({
      data: { email: `${PREFIX}eleve-a@example.test`, role: 'ELEVE', firstName: 'Test', lastName: 'Synthetique A' },
    });
    studentId = (await prisma.student.create({
      data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'TERMINALE' },
    })).id;

    const studentBUser = await prisma.user.create({
      data: { email: `${PREFIX}eleve-b@example.test`, role: 'ELEVE', firstName: 'Test', lastName: 'Synthetique B' },
    });
    studentBId = (await prisma.student.create({
      data: { userId: studentBUser.id, parentId: parent.id, gradeLevel: 'TERMINALE' },
    })).id;

    const premiereUser = await prisma.user.create({
      data: { email: `${PREFIX}eleve-premiere@example.test`, role: 'ELEVE', firstName: 'Test', lastName: 'Premiere' },
    });
    premiereStudentId = (await prisma.student.create({
      data: { userId: premiereUser.id, parentId: parent.id, gradeLevel: 'PREMIERE' },
    })).id;

    staffUserId = (await prisma.user.create({
      data: { email: `${PREFIX}assistante@example.test`, role: 'ASSISTANTE', firstName: 'Assistante', lastName: 'Test' },
    })).id;
  });

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previousFlag;
    if (previousNarrationFlag === undefined) delete process.env.NEXUS_BILAN_FAMILY_NARRATION_ENABLED;
    else process.env.NEXUS_BILAN_FAMILY_NARRATION_ENABLED = previousNarrationFlag;
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "canonical_report_audience_artifacts", "canonical_report_materializations",
        "canonical_report_reviews", "canonical_report_revisions", "canonical_report_artifacts",
        "canonical_evidence_items", "canonical_score_snapshots", "canonical_job_outbox",
        "canonical_api_idempotency_keys", "canonical_assessment_attempts",
        "canonical_parent_student_links" CASCADE
    `);
    await prisma.notification.deleteMany({ where: { userId: staffUserId } });
    await prisma.student.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.parentProfile.deleteMany({ where: { userId: parentUserId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.user.delete({ where: { id: parentUserId } });
    await prisma.$disconnect();
  });

  test('le pack est résolu par le vrai résolveur, sous son drapeau, et projeté en A/B/C/D', () => {
    const enabled = resolveEnabledPack(PACK_SLUG);
    expect(enabled).not.toBeNull();
    expect(enabled!.pack.subject).toBe('MATHS_COMPLEMENTAIRES');
    expect(enabled!.pack.level).toBe('TERMINALE');
    expect(enabled!.pack.questionnaire.items).toHaveLength(18);
    expect(enabled!.pack.questionnaire.targetDurationMin).toBe(25);

    const projected = projectPaperEntryItems(enabled!);
    expect(projected).toHaveLength(18);
    for (const item of projected) {
      expect(item.options.map(({ id }) => id)).toEqual(['A', 'B', 'C', 'D']);
    }
    // L'ordre interne anti-biais de la banque n'est pas altéré pour autant.
    const internal = enabled!.pack.questionnaire.items.find(({ id }) => id === 'ETL-MCO-SUI-01')!;
    expect(internal.options.map(({ id }) => id)).toEqual(['B', 'A', 'C', 'D']);
    // Sans le drapeau, le pack n'est pas résolu.
    expect(resolveEnabledPack(PACK_SLUG, undefined, { ...process.env, [FLAG]: undefined })).toBeNull();
  });

  describe('garde-fous de la route de saisie', () => {
    const copy = buildCopyA();

    test('élève inexistant → 404', async () => {
      const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}g-1`, {
        studentId: 'inexistant', packSlug: PACK_SLUG, answers: answersFromCopy(copy),
      }));
      expect(response.status).toBe(404);
    });

    test('mauvais pack → 404, pack Maths spécialité non ouvert → 404', async () => {
      const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}g-2`, {
        studentId, packSlug: 'pack-inexistant', answers: answersFromCopy(copy),
      }));
      expect(response.status).toBe(404);
      const spe = await paperHandler(staffUserId)(paperRequest(`${PREFIX}g-2b`, {
        studentId, packSlug: 'entree-terminale-maths-v1', answers: answersFromCopy(copy),
      }));
      expect(spe.status).toBe(404);
    });

    test('mauvais niveau (élève de Première) → 409', async () => {
      const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}g-3`, {
        studentId: premiereStudentId, packSlug: PACK_SLUG, answers: answersFromCopy(copy),
      }));
      expect(response.status).toBe(409);
      expect((await response.json() as { error: { code: string } }).error.code).toBe('STUDENT_PACK_LEVEL_MISMATCH');
    });

    test('mauvaise option (E) → 400, mauvaise certitude (5) → 400', async () => {
      const badOption = await paperHandler(staffUserId)(paperRequest(`${PREFIX}g-4`, {
        studentId, packSlug: PACK_SLUG,
        answers: answersFromCopy(copy).map((answer) => (
          answer.itemId === 'ETL-MCO-SUI-01' ? { ...answer, optionId: 'E' } : answer
        )),
      }));
      expect(badOption.status).toBe(400);
      const badConfidence = await paperHandler(staffUserId)(paperRequest(`${PREFIX}g-5`, {
        studentId, packSlug: PACK_SLUG,
        answers: answersFromCopy(copy).map((answer) => (
          answer.itemId === 'ETL-MCO-SUI-01' ? { ...answer, confidence: 5 } : answer
        )),
      }));
      expect(badConfidence.status).toBe(400);
    });

    test('réponse manquante (17 items sur 18) → 422 ATTEMPT_INCOMPLETE, rien n’est écrit', async () => {
      const before = await prisma.canonicalAssessmentAttempt.count({ where: { studentId } });
      const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}g-6`, {
        studentId, packSlug: PACK_SLUG, answers: answersFromCopy(copy).slice(0, 17),
      }));
      expect(response.status).toBe(422);
      expect((await response.json() as { error: { code: string } }).error.code).toBe('ATTEMPT_INCOMPLETE');
      expect(await prisma.canonicalAssessmentAttempt.count({ where: { studentId } })).toBe(before);
    });

    test('certitude sur une question sans réponse → 400', async () => {
      const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}g-7`, {
        studentId, packSlug: PACK_SLUG,
        answers: answersFromCopy(copy).map((answer) => (
          answer.itemId === 'ETL-MCO-SUI-01' ? { ...answer, optionId: null, confidence: 3 } : answer
        )),
      }));
      expect(response.status).toBe(400);
    });

    test('un parent ou un élève n’atteint pas la route → 404', async () => {
      const asParent = await paperHandler(parentUserId, 'PARENT')(paperRequest(`${PREFIX}g-8`, {
        studentId, packSlug: PACK_SLUG, answers: answersFromCopy(copy),
      }));
      expect(asParent.status).toBe(404);
    });
  });

  describe('scénario A — profil global solide', () => {
    const copy = buildCopyA();
    let attemptId: string;
    let factSheet: FactSheet;
    let revisionId: string;

    test('la copie crée une tentative SAISIE_PAPIER normalisée, idempotente', async () => {
      const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}A-1`, {
        studentId, packSlug: PACK_SLUG, answers: answersFromCopy(copy),
      }));
      expect(response.status).toBe(201);
      const body = await response.json() as { attemptId: string; status: string; provenance: string };
      expect(body.status).toBe('SUBMITTED');
      expect(body.provenance).toBe('SAISIE_PAPIER');
      attemptId = body.attemptId;

      // Même clé → même réponse, aucune seconde tentative.
      const replay = await paperHandler(staffUserId)(paperRequest(`${PREFIX}A-1`, {
        studentId, packSlug: PACK_SLUG, answers: answersFromCopy(copy),
      }));
      expect(replay.status).toBe(201);
      expect((await replay.json() as { attemptId: string }).attemptId).toBe(attemptId);
      expect(await prisma.canonicalAssessmentAttempt.count({ where: { studentId, assessmentPackId: PACK_SLUG } })).toBe(1);
      expect(await prisma.jobOutbox.count({ where: { aggregateId: attemptId } })).toBe(1);

      const attempt = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      expect(attempt).toMatchObject({
        status: 'SUBMITTED',
        provenance: 'SAISIE_PAPIER',
        enteredById: staffUserId,
        enteredAt: NOW,
        submittedAt: NOW,
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        assessmentPackId: PACK_SLUG,
        assessmentPackVersion: '1',
        curriculumId: 'terminale.maths_complementaires',
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
      });
      expect(attempt.assessmentPackChecksum).toBe(resolveEnabledPack(PACK_SLUG)!.checksum);
      const answers = attempt.answers as Record<string, { optionId: string | null; confidence: number | null }>;
      // JSONB ne conserve pas l'ordre des clés : on compare l'ensemble.
      expect(Object.keys(answers).sort()).toEqual(ITEMS.map(({ id }) => id).sort());
      for (const item of ITEMS) {
        expect(answers[item.id]).toEqual({ optionId: copy[item.id].optionId, confidence: copy[item.id].confidence });
      }
    });

    test('le scoring déterministe correspond à l’attendu recalculé par optionId', async () => {
      const snapshot = await scoreAttempt(attemptId);
      factSheet = snapshot.result as unknown as FactSheet;
      expect(snapshot.score).toBe(100);
      expect(factSheet.globalScore).toBe(expectedGlobalScore(copy));
      expect(factSheet.bankSlug).toBe(PACK_SLUG);
      expect(factSheet.bankVersion).toBe(1);
      expect(factSheet.student.level).toBe('TERMINALE');
      expect(factSheet.coverage).toBe(100);
      expect(factSheet.domains.map(({ id }) => id)).toEqual([...PACK.scoring.domains]);
      const scores = expectedDomainScores(copy);
      const profiles = expectedDomainProfiles(copy);
      for (const domain of factSheet.domains) {
        expect(domain.score).toBe(scores[domain.id]);
        expect(domain.profile).toBe(profiles[domain.id]);
      }
      // SUI-01 (poids 2, sûr) et SUI-02 (poids 2, peu sûr) : masses égales → MAITRISE (règle 5).
      expect(factSheet.domains.find(({ id }) => id === 'suites-evolutions')!.profile).toBe('MAITRISE');
      // DER-02 (poids 1, peu sûr) face à DER-01 + DER-03 (poids 4, sûrs) → MAITRISE.
      expect(factSheet.domains.find(({ id }) => id === 'derivation')!.profile).toBe('MAITRISE');
      expect(factSheet.calibrationIndex).toBe(expectedCalibration(copy));
      expect(factSheet.groupBand).toBe('APPROFONDISSEMENT');
      expect(factSheet.flags).not.toContain('COUVERTURE_INSUFFISANTE');

      const attempt = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      expect(attempt.status).toBe('SCORED');
      expect(await prisma.jobOutbox.findUnique({ where: { idempotencyKey: `${attemptId}.generate-report` } })).not.toBeNull();

      // Preuve « par identifiant, jamais par position » : la banque range
      // SUI-01 en [B, A, C, D] ; la lettre B lue sur la copie a été jugée juste.
      const evidence = await prisma.evidenceItem.findMany({
        where: { scoreSnapshotId: snapshot.id, sourceKey: 'ETL-MCO-SUI-01' },
      });
      expect(evidence).toHaveLength(1);
      expect((evidence[0].payload as { rawSuccess: number }).rawSuccess).toBe(1);
    });

    test('le rapport plancher est généré, en attente de revue, puis publié par l’assistante', async () => {
      const revision = await generateReport(attemptId);
      revisionId = revision.id;
      expect(revision.status).toBe('PENDING_REVIEW');
      expect(revision.validationFailures).toEqual([]);
      expect(revision.reportPackId).toBe(PACK_SLUG);
      const attempt = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      expect(attempt.status).toBe('REPORT_PENDING_REVIEW');

      const actor = { userId: staffUserId, role: 'ASSISTANTE' };
      const pending = await listPendingReportReviews(actor);
      expect(pending.map(({ id }) => id)).toContain(revisionId);
      const recent = await listRecentReportReviews(actor);
      const mine = recent.find(({ id }) => id === revisionId)!;
      expect(mine.packLabel).toBe('Terminale · Mathématiques complémentaires');
      expect(mine.reportArtifact.assessmentAttempt.provenance).toBe('SAISIE_PAPIER');
      expect(mine.displayStatus).toBe('En attente de diffusion');
      expect(mine.diffusable).toBe(true);

      const preview = pendingReportPreview(await previewPendingReport({ ...actor, revisionId }));
      expect(preview.official).toBe(false);
      expect(preview.audiences.map(({ audience }) => audience)).toEqual(['ELEVE', 'PARENTS', 'NEXUS']);

      // Un parent ne revoit ni ne publie.
      await expect(validateAndPublishPendingReport({ userId: parentUserId, role: 'PARENT', revisionId, motif: 'x' }))
        .rejects.toMatchObject({ code: 'NOT_FOUND' });

      const published = publishedReport(await validateAndPublishPendingReport({
        ...actor,
        revisionId,
        motif: 'Relu : conforme à la copie.',
      }));
      expect(published.status).toBe('PUBLISHED');
      const after = await prisma.reportRevision.findUniqueOrThrow({
        where: { id: revisionId },
        include: { reviews: true, materialization: { include: { audienceArtifacts: true } }, reportArtifact: true },
      });
      expect(after.status).toBe('COACH_VALIDATED');
      expect(after.reviews.map(({ decision }) => decision)).toEqual(['APPROVED']);
      expect(after.reportArtifact.status).toBe('PUBLISHED');
      expect(after.materialization!.audienceArtifacts.map(({ audience }) => audience).sort()).toEqual(['ELEVE', 'NEXUS', 'PARENTS']);
      expect((await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).status).toBe('PUBLISHED');

      const logTitle = domainTitle('logarithme-reperage', 'MATHS_COMPLEMENTAIRES');
      const correctedBayesianLabel = 'Oui : la probabilité qu’elle soit porteuse est d’environ 59,5 %';
      for (const artifact of after.materialization!.audienceArtifacts) {
        expectSafeMcoHumanText(artifact.html, logTitle);
        saveArtifact(`A-${artifact.audience}.html`, artifact.html);
        expect(artifact.pdf).not.toBeNull();
        if (artifact.pdf === null) throw new Error(`PDF_${artifact.audience}_MISSING`);
        saveArtifact(`A-${artifact.audience}.pdf`, Buffer.from(artifact.pdf));
        const pdfText = await extractPdfText(Buffer.from(artifact.pdf));
        expectSafeMcoHumanText(pdfText, logTitle);
        expect(artifact.pdfStatus).toBe('READY');
        expect(artifact.html).toContain('Mathématiques complémentaires');
        expect(artifact.html).not.toContain('MATHS_COMPLEMENTAIRES');
        expect(artifact.html).not.toContain('logarithme-reperage');
        expect(artifact.html).not.toContain('ELEVE_');
        expect(artifact.html).toContain('Durée non mesurée');
        if (artifact.audience === 'PARENTS') {
          expect(artifact.html).not.toContain('Réponse attendue');
          expect(pdfText).not.toContain('Réponse attendue');
        } else {
          expect(normalizedHumanText(artifact.html)).toContain(correctedBayesianLabel);
          expect(normalizedHumanText(pdfText)).toContain(correctedBayesianLabel);
        }
        expect(artifact.html).not.toContain('ETL-MCO-');
        expect(pdfText).not.toContain('ETL-MCO-');
      }
    }, 120_000);
  });

  describe('scénario B — difficultés ciblées', () => {
    const copy = buildCopyB();
    let attemptId: string;
    let factSheet: FactSheet;
    let revisionId: string;

    test('la copie est enregistrée avec sa question sans réponse et sa certitude absente', async () => {
      const response = await paperHandler(staffUserId)(paperRequest(`${PREFIX}B-1`, {
        studentId: studentBId, packSlug: PACK_SLUG, answers: answersFromCopy(copy),
      }));
      expect(response.status).toBe(201);
      attemptId = (await response.json() as { attemptId: string }).attemptId;
      const attempt = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      const answers = attempt.answers as Record<string, { optionId: string | null; confidence: number | null }>;
      expect(answers['ETL-MCO-VAR-01']).toEqual({ optionId: null, confidence: null });
      expect(answers['ETL-MCO-TAU-02']).toEqual({ optionId: correctLetter('ETL-MCO-TAU-02'), confidence: null });
      expect(answers['ETL-MCO-PRO-02']).toEqual({ optionId: 'A', confidence: 4 });
    });

    test('scores, profils et calibration correspondent à l’attendu recalculé', async () => {
      const snapshot = await scoreAttempt(attemptId);
      factSheet = snapshot.result as unknown as FactSheet;
      expect(factSheet.globalScore).toBe(expectedGlobalScore(copy));
      expect(factSheet.globalScore).toBeLessThan(100);
      expect(factSheet.coverage).toBe(round1((100 * 17) / 18));
      expect(factSheet.calibrationIndex).toBe(expectedCalibration(copy));
      const scores = expectedDomainScores(copy);
      const profiles = expectedDomainProfiles(copy);
      for (const domain of factSheet.domains) {
        expect(domain.score).toBe(scores[domain.id]);
        expect(domain.profile).toBe(profiles[domain.id]);
      }
      const byId = Object.fromEntries(factSheet.domains.map((domain) => [domain.id, domain]));
      expect(byId['suites-evolutions'].profile).toBe('ERREUR_CONFIANTE');
      expect(byId['derivation'].profile).toBe('LACUNE_CONSCIENTE');
      expect(byId['probabilites-conditionnelles'].profile).toBe('ERREUR_CONFIANTE');
      expect(byId['logarithme-reperage'].profile).toBe('LACUNE_CONSCIENTE');
      expect(byId['variables-aleatoires'].profile).toBe('MAITRISE_FRAGILE');
      // TAU-01 sûr (poids 1) et TAU-02 sans certitude, classée non sûre par le
      // modèle canonique actuel (poids 1) : masses égales → MAITRISE.
      expect(byId['taux-evolution'].profile).toBe('MAITRISE');
      expect(byId['exponentielle'].profile).toBe('MAITRISE');
      expect(byId['second-degre'].profile).toBe('MAITRISE');
      expect(factSheet.flags).toContain('ERREURS_CONFIANTES_MULTIPLES');
      // Les nœuds les plus sévères sont en tête des priorités.
      expect(factSheet.nodes[0].profile).toBe('ERREUR_CONFIANTE');

      const evidence = await prisma.evidenceItem.findMany({ where: { scoreSnapshotId: snapshot.id }, orderBy: { sourceKey: 'asc' } });
      expect(evidence).toHaveLength(18);
      const expected = expectedItems(copy);
      for (const row of evidence) {
        const payload = row.payload as { profile: string; rawSuccess: number; weight: number; isConfident: boolean; answered: boolean };
        const want = expected.find(({ itemId }) => itemId === row.sourceKey)!;
        expect(payload.profile).toBe(want.profile);
        expect(payload.rawSuccess).toBe(want.rawSuccess);
        expect(payload.weight).toBe(want.weight);
        expect(payload.isConfident).toBe(want.isConfident);
        expect(payload.answered).toBe(want.answered);
      }
      // Certitude absente : la réponse juste garde le profil canonique actuel de maîtrise fragile.
      const tau = evidence.find(({ sourceKey }) => sourceKey === 'ETL-MCO-TAU-02')!.payload as { profile: string };
      expect(tau.profile).toBe('MAITRISE_FRAGILE');
    });

    test('les restitutions distinguent lacunes de Première et repérage anticipé, et ne reprennent pas « Non : 59 % » comme vérité', async () => {
      const revision = await generateReport(attemptId);
      revisionId = revision.id;
      expect(revision.status).toBe('PENDING_REVIEW');
      expect(revision.validationFailures).toEqual([]);
      const actor = { userId: staffUserId, role: 'ASSISTANTE' };
      const preview = pendingReportPreview(await previewPendingReport({ ...actor, revisionId }));
      expect(preview.official).toBe(false);
      expect(preview.audiences.map(({ audience }) => audience)).toEqual(['ELEVE', 'PARENTS', 'NEXUS']);
      const previewByAudience = Object.fromEntries(
        preview.audiences.map(({ audience, html }) => [audience, html]),
      ) as Record<ReportAudience, string>;

      const published = publishedReport(await validateAndPublishPendingReport({
        ...actor,
        revisionId,
        motif: 'Relu.',
      }));
      expect(published.status).toBe('PUBLISHED');
      const after = await prisma.reportRevision.findUniqueOrThrow({
        where: { id: revisionId },
        include: { materialization: { include: { audienceArtifacts: true } } },
      });
      const html = Object.fromEntries(after.materialization!.audienceArtifacts.map((artifact) => [artifact.audience, artifact.html]));
      const pdfText = {} as Record<ReportAudience, string>;
      const logTitle = domainTitle('logarithme-reperage', 'MATHS_COMPLEMENTAIRES');
      for (const artifact of after.materialization!.audienceArtifacts) {
        expect(artifact.html).toBe(previewByAudience[artifact.audience]);
        expectSafeMcoHumanText(artifact.html, logTitle);
        saveArtifact(`B-${artifact.audience}.html`, artifact.html);
        expect(artifact.pdf).not.toBeNull();
        if (artifact.pdf === null) throw new Error(`PDF_${artifact.audience}_MISSING`);
        saveArtifact(`B-${artifact.audience}.pdf`, Buffer.from(artifact.pdf));
        const text = await extractPdfText(Buffer.from(artifact.pdf));
        pdfText[artifact.audience] = text;
        expectSafeMcoHumanText(text, logTitle);
        expect(text).toContain('Mathématiques complémentaires');
        expect(text).not.toContain('MATHS_COMPLEMENTAIRES');
        expect(text).not.toContain('logarithme-reperage');
        expect(artifact.pdfStatus).toBe('READY');
      }
      expect(logTitle).toContain('repérage anticipé');
      for (const audience of ['ELEVE', 'PARENTS', 'NEXUS'] as const) {
        expect(html[audience]).toContain(logTitle);
        expect(html[audience]).not.toContain('logarithme-reperage');
        expect(html[audience]).not.toContain('MATHS_COMPLEMENTAIRES');
        expect(html[audience]).not.toMatch(/lacune de Premi[èe]re/i);
      }
      // Le document parents ne détaille jamais les questions.
      expect(html.PARENTS).not.toContain('Réponse attendue');
      expect(html.PARENTS).not.toContain('virus');
      expect(pdfText.PARENTS).not.toContain('Réponse attendue');
      expect(pdfText.PARENTS).not.toContain('virus');
    }, 120_000);

    test('le rendu humain de ETL-MCO-PRO-02 conserve B sans exposer la formulation ni la note éditoriale', async () => {
      const after = await prisma.reportRevision.findUniqueOrThrow({
        where: { id: revisionId },
        include: { materialization: { include: { audienceArtifacts: true } } },
      });
      for (const artifact of after.materialization!.audienceArtifacts) {
        expect(artifact.html).not.toMatch(/Non(?:\s|&nbsp;)*(?::|&nbsp;:)(?:\s|&nbsp;)*la probabilité[^<\n]*59/iu);
        expect(artifact.html).not.toMatch(/clé papier|mot\s+(?:«\s*)?Non|du PDF|incohérent/iu);
      }
      expect(correctLetter('ETL-MCO-PRO-02')).toBe('B');
      const eleve = after.materialization!.audienceArtifacts.find(({ audience }) => audience === 'ELEVE')!.html;
      expect(eleve).toContain('Oui : la probabilité qu’elle soit porteuse est d’environ 59,5 %');
    });
  });
});
