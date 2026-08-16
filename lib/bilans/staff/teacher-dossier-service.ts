/**
 * Assemblage du dossier enseignant — un document unique par matière × niveau,
 * réservé au staff (ADMIN/ASSISTANTE). Calqué sur `staff/group-plan-service.ts`
 * (même style d'injection de dépendances), avec deux différences :
 *  - la sélection se fait par (matière, niveau), pas par une liste d'IDs
 *    choisie à la main : le niveau EST le groupe (décision responsable) ;
 *  - un élève dont le pack, l'identité ou le contenu pose problème est
 *    EXCLU avec une raison explicite, jamais silencieusement — un dossier
 *    incomplet sans le dire ferait travailler l'enseignant à l'aveugle sur
 *    une partie de son groupe.
 */

import type { GradeLevel, Prisma, PrismaClient, ReportArtifactStatus, Subject, UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import type { CpsCatalog } from '../catalog/bank-validation';
import { bilanPackSubjectLabel } from '../catalog/subjects';
import { buildAttemptEvidence } from '../core/report-service';
import { parseReportRenderContext } from '../core/report-materialization';
import type { FactSheet } from '../facts/fact-sheet';
import { teacherBriefSchema, type TeacherBriefContent } from '../llm/teacher-brief-schema';
import { buildHumanRenderIdentity } from '../render/human-identity';
import type { QuestionEvidence } from '../render/question-evidence';
import type { RenderIdentity } from '../render/render-identity';
import { bilanPackLevelLabel, buildPreRentreeStageLabel } from '../render/stage-label';
import { isStaffRole } from '../saisie-papier/access';
import { BRIEF_STATUSES_SAFE_FOR_TEACHER } from './teacher-brief-status';
import {
  buildDossierGroupAnalysis,
  buildDossierSessionPlan,
  type DossierMember,
} from '../teacher-dossier/aggregate';
import {
  renderTeacherDossierHtml,
  renderTeacherDossierPdf,
  TEACHER_BRIEF_SAFETY_MARKER,
  type DossierCompleteness,
  type DossierHeaderInput,
  type DossierStudentDetail,
  type TeacherDossierDocument,
} from '../teacher-dossier/render';
import { loadCatalog as loadGroupPlanCatalog } from './group-plan-service';

export class StaffTeacherDossierError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'StaffTeacherDossierError';
  }
}

type DossierActor = Readonly<{ userId: string; role: UserRole | string }>;
type DossierFormat = 'html' | 'pdf';

/** Statuts de bilan éligibles au dossier : validés par relecture ou déjà publiés — jamais DRAFT/ARCHIVED/REJECTED. */
const ELIGIBLE_ARTIFACT_STATUSES: ReportArtifactStatus[] = ['PENDING_REVIEW', 'PUBLISHED'];

const candidateSelection = {
  id: true,
  status: true,
  assessmentAttempt: {
    select: {
      answers: true,
      assessmentPackId: true,
      assessmentPackVersion: true,
      assessmentPackChecksum: true,
    },
  },
  student: { select: { user: { select: { firstName: true, lastName: true } } } },
  revisions: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { scoreSnapshotId: true, content: true, scoreSnapshot: { select: { result: true } } },
  },
  /**
   * Couche 1 de la défense en profondeur (§2 de l'incident P0) : le filtre
   * de statut est posé ICI, dans la requête, pas seulement vérifié ensuite.
   * Seul APPROVED (BRIEF_STATUSES_SAFE_FOR_TEACHER) peut sortir de cette
   * sélection — PENDING_REVIEW, CORRECTION_REQUESTED et SUPERSEDED n'entrent
   * JAMAIS dans le pipeline de rendu du dossier enseignant.
   */
  teacherBriefs: {
    where: { status: { in: [...BRIEF_STATUSES_SAFE_FOR_TEACHER] } },
    orderBy: { version: 'desc' as const },
    take: 1,
    select: { content: true, approvedContent: true, scoreSnapshotId: true },
  },
};

export type DossierCandidateRow = Prisma.ReportArtifactGetPayload<{ select: typeof candidateSelection }>;

type DossierDependencies = Readonly<{
  findCandidates(subject: Subject, level: GradeLevel): Promise<readonly DossierCandidateRow[]>;
  resolvePack: PackResolver;
  loadCatalog(slug: string): CpsCatalog | null;
  buildEvidence(
    attempt: DossierCandidateRow['assessmentAttempt'],
    resolvePack: PackResolver,
  ): QuestionEvidence | undefined;
  parseFactSheet(scoreResult: unknown, reportContent: unknown): FactSheet;
  /** IDs de bilans dont la DERNIÈRE tentative de génération est DETERMINISTIC_ONLY (§3/§8) — "socle déterministe suffisant", jamais un simple "pas encore essayé". */
  findDeterministicOnlyArtifactIds(reportArtifactIds: readonly string[]): Promise<ReadonlySet<string>>;
  renderHtml: typeof renderTeacherDossierHtml;
  renderPdf: typeof renderTeacherDossierPdf;
  now: () => Date;
}>;

function databaseDependencies(database: Pick<PrismaClient, 'reportArtifact' | 'teacherBriefAttempt'>) {
  return {
    findCandidates: (subject: Subject, level: GradeLevel) => database.reportArtifact.findMany({
      where: { status: { in: ELIGIBLE_ARTIFACT_STATUSES }, assessmentAttempt: { subject, gradeLevel: level } },
      select: candidateSelection,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    findDeterministicOnlyArtifactIds: async (reportArtifactIds: readonly string[]) => {
      if (reportArtifactIds.length === 0) return new Set<string>();
      const latest = await database.teacherBriefAttempt.findMany({
        where: { reportArtifactId: { in: [...reportArtifactIds] } },
        orderBy: { createdAt: 'desc' as const },
        select: { reportArtifactId: true, result: true },
      });
      const seen = new Set<string>();
      const deterministic = new Set<string>();
      for (const attempt of latest) {
        if (seen.has(attempt.reportArtifactId)) continue; // seule la DERNIÈRE tentative compte
        seen.add(attempt.reportArtifactId);
        if (attempt.result === 'DETERMINISTIC_ONLY') deterministic.add(attempt.reportArtifactId);
      }
      return deterministic;
    },
  };
}

/**
 * Trois paliers explicites (§3 de l'incident P0) — jamais un simple booléen
 * "brief présent/absent". ENRICHI_COMPLET exige que CHAQUE élève inclus ait
 * soit un brief APPROVED courant, soit un statut terminal explicite : sa
 * dernière tentative de génération a conclu DETERMINISTIC_ONLY (le socle est
 * déterministe PAR CONCEPTION pour ce bilan, pas "pas encore essayé").
 */
async function computeCompleteness(
  included: readonly ResolvedCandidate[],
  dependencies: DossierDependencies,
): Promise<DossierCompleteness> {
  const briefsApproved = included.filter((candidate) => candidate.brief !== null).length;
  const socleOnly = included.filter((candidate) => candidate.brief === null);
  const deterministicIds = await dependencies.findDeterministicOnlyArtifactIds(
    socleOnly.map((candidate) => candidate.reportArtifactId),
  );
  const socleOnlyLegitimate = socleOnly.filter((candidate) => deterministicIds.has(candidate.reportArtifactId));
  const tier: DossierCompleteness['tier'] = briefsApproved === 0
    ? 'SOCLE_DETERMINISTE'
    : socleOnly.length === 0 || socleOnlyLegitimate.length === socleOnly.length
      ? 'ENRICHI_COMPLET'
      : 'ENRICHI_SECURISE_PARTIEL';
  return Object.freeze({
    tier, studentsIncluded: included.length, briefsApproved, socleOnlyCount: socleOnly.length,
  });
}

function loadCatalogSafely(slug: string): CpsCatalog | null {
  try {
    return loadGroupPlanCatalog(slug);
  } catch {
    return null;
  }
}

const defaultDependencies: DossierDependencies = {
  ...databaseDependencies(prisma),
  resolvePack: resolveEnabledPack,
  loadCatalog: loadCatalogSafely,
  buildEvidence: buildAttemptEvidence,
  parseFactSheet: (scoreResult, reportContent) => parseReportRenderContext(scoreResult, reportContent).factSheet,
  renderHtml: renderTeacherDossierHtml,
  renderPdf: renderTeacherDossierPdf,
  now: () => new Date(),
};

function assertStaff(actor: DossierActor): void {
  if (!isStaffRole(actor.role) || !actor.userId.trim()) throw new StaffTeacherDossierError('NOT_FOUND');
}

/**
 * Couche 2 de la défense en profondeur (§2/§5 de l'incident P0) : même si la
 * requête (couche 1) n'a déjà remonté qu'un brief APPROVED, ce brief peut
 * être RATTACHÉ À UN ANCIEN scoreSnapshot si le bilan a été régénéré depuis
 * son approbation — un brief STALE ne doit jamais être rendu comme s'il
 * décrivait le diagnostic courant. `currentScoreSnapshotId` vient de la
 * révision la plus récente du même bilan (déjà la définition établie de
 * "courant" ailleurs dans ce service).
 *
 * `approvedContent` (correction manuelle structurée) prime sur `content`
 * (sortie brute du modèle) quand il est présent — jamais de JSON.parse
 * défensif sur une chaîne libre : `approvedContent` est TOUJOURS un JSON
 * structuré valide, posé une seule fois à l'approbation.
 */
function briefContent(
  row: DossierCandidateRow['teacherBriefs'][number] | undefined,
  currentScoreSnapshotId: string,
): TeacherBriefContent | null {
  if (row === undefined) return null;
  if (row.scoreSnapshotId !== currentScoreSnapshotId) return null; // STALE_BRIEF
  const raw = row.approvedContent ?? row.content;
  const parsed = teacherBriefSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

type ResolvedCandidate = Readonly<{
  reportArtifactId: string;
  displayName: string;
  factSheet: FactSheet;
  evidence: QuestionEvidence;
  brief: TeacherBriefContent | null;
  packId: string;
  packVersion: number;
}>;

function packKey(candidate: Pick<ResolvedCandidate, 'packId' | 'packVersion'>): string {
  return `${candidate.packId}@${candidate.packVersion}`;
}

function resolveCandidates(
  rows: readonly DossierCandidateRow[],
  dependencies: DossierDependencies,
): Readonly<{ resolved: readonly ResolvedCandidate[]; excluded: readonly Readonly<{ displayName: string; reason: string }>[] }> {
  const resolved: ResolvedCandidate[] = [];
  const excluded: Readonly<{ displayName: string; reason: string }>[] = [];
  for (const row of rows) {
    let displayName: string;
    try {
      displayName = buildHumanRenderIdentity(row.student.user).displayName;
    } catch {
      excluded.push(Object.freeze({ displayName: `(bilan ${row.id})`, reason: 'identité élève incomplète (prénom ou nom manquant)' }));
      continue;
    }
    const revision = row.revisions[0] as DossierCandidateRow['revisions'][number] | undefined;
    if (revision === undefined) {
      excluded.push(Object.freeze({ displayName, reason: 'aucune révision scorée disponible' }));
      continue;
    }
    let evidence: QuestionEvidence | undefined;
    try {
      evidence = dependencies.buildEvidence(row.assessmentAttempt, dependencies.resolvePack);
    } catch {
      excluded.push(Object.freeze({ displayName, reason: "le pack a changé depuis la passation (empreinte différente)" }));
      continue;
    }
    if (evidence === undefined) {
      excluded.push(Object.freeze({ displayName, reason: 'pack non activé ou introuvable' }));
      continue;
    }
    let factSheet: FactSheet;
    try {
      factSheet = dependencies.parseFactSheet(revision.scoreSnapshot.result, revision.content);
    } catch {
      excluded.push(Object.freeze({ displayName, reason: 'contenu de bilan invalide' }));
      continue;
    }
    const packVersion = Number(row.assessmentAttempt.assessmentPackVersion);
    resolved.push(Object.freeze({
      reportArtifactId: row.id, displayName, factSheet, evidence, brief: briefContent(row.teacherBriefs[0], revision.scoreSnapshotId),
      packId: row.assessmentAttempt.assessmentPackId, packVersion,
    }));
  }
  return Object.freeze({ resolved: Object.freeze(resolved), excluded: Object.freeze(excluded) });
}

function majorityPackKey(candidates: readonly ResolvedCandidate[]): string {
  const counts = new Map<string, number>();
  for (const candidate of candidates) counts.set(packKey(candidate), (counts.get(packKey(candidate)) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0];
}

export async function buildStaffTeacherDossierDocument(
  input: DossierActor & Readonly<{ subject: Subject; level: GradeLevel; format: DossierFormat; header?: DossierHeaderInput }>,
  overrides: Partial<DossierDependencies> = {},
): Promise<Readonly<{ body: string | Buffer; contentType: string; filename: string }>> {
  assertStaff(input);
  const dependencies = { ...defaultDependencies, ...overrides };
  const rows = await dependencies.findCandidates(input.subject, input.level);
  if (rows.length === 0) throw new StaffTeacherDossierError('NOT_FOUND');

  const { resolved, excluded } = resolveCandidates(rows, dependencies);
  if (resolved.length === 0) throw new StaffTeacherDossierError('DOSSIER_NO_ELIGIBLE_STUDENT');

  const majorityKey = majorityPackKey(resolved);
  const included = resolved.filter((candidate) => packKey(candidate) === majorityKey);
  const excludedStudents = [
    ...excluded,
    ...resolved.filter((candidate) => packKey(candidate) !== majorityKey)
      .map((candidate) => Object.freeze({ displayName: candidate.displayName, reason: `pack différent (${candidate.packId} v${candidate.packVersion})` })),
  ];

  const enabled = dependencies.resolvePack(included[0].packId, included[0].packVersion);
  if (enabled === null) throw new StaffTeacherDossierError('NOT_FOUND');

  const students: readonly DossierStudentDetail[] = Object.freeze(included.map((candidate) => Object.freeze({
    displayName: candidate.displayName, factSheet: candidate.factSheet, evidence: candidate.evidence, brief: candidate.brief,
    ...(candidate.brief !== null ? { briefSafetyMarker: TEACHER_BRIEF_SAFETY_MARKER } : {}),
  })));
  const members: readonly DossierMember[] = students;
  const analysis = buildDossierGroupAnalysis(members);
  const completeness = await computeCompleteness(included, dependencies);

  const catalog = dependencies.loadCatalog(included[0].packId);
  let sessionPlan: ReturnType<typeof buildDossierSessionPlan> | null = null;
  if (catalog !== null) {
    try {
      sessionPlan = buildDossierSessionPlan(catalog, students.map(({ displayName, factSheet }) => ({ displayName, factSheet })));
    } catch {
      sessionPlan = null;
    }
  }

  const date = dependencies.now().toISOString().slice(0, 10);
  const identity: RenderIdentity = Object.freeze({
    displayName: `${bilanPackLevelLabel(enabled.pack.level)} — ${bilanPackSubjectLabel(enabled.pack.subject)}`,
    level: enabled.pack.level, subject: enabled.pack.subject, date,
    stageLabel: buildPreRentreeStageLabel(enabled.pack.level, enabled.pack.subject),
  });
  const doc: TeacherDossierDocument = Object.freeze({
    identity, header: input.header ?? {}, students, excludedStudents: Object.freeze(excludedStudents),
    analysis, sessionPlan, evidenceCatalog: students[0].evidence, generatedAt: date, completeness,
  });

  const filenameBase = `dossier-enseignant-${bilanPackSubjectLabel(enabled.pack.subject).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${bilanPackLevelLabel(enabled.pack.level).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${date}`;
  if (input.format === 'html') {
    return Object.freeze({ body: dependencies.renderHtml(doc), contentType: 'text/html; charset=utf-8', filename: `${filenameBase}.html` });
  }
  const rendered = await dependencies.renderPdf(doc);
  if (rendered.status === 'UNAVAILABLE') throw new StaffTeacherDossierError(rendered.errorCode);
  return Object.freeze({ body: rendered.pdf, contentType: 'application/pdf', filename: `${filenameBase}.pdf` });
}

/**
 * Compteurs par groupe (matière × niveau) — remplace l'ancien libellé
 * ambigu "briefs manquants" (§12 de l'incident P0). Chaque compteur répond à
 * UNE question, jamais mélangée avec une autre :
 *  - `toGenerateCount`  : réellement actionnable par un clic "Générer" ;
 *  - `queuedCount`/`processingCount` : jobs en file/en cours (job outbox) ;
 *  - `toReviewCount`    : PENDING_REVIEW — un humain doit relire ;
 *  - `correctionRequestedCount` : en attente de reprise après correction ;
 *  - `approvedCount`    : SAFE_FOR_TEACHER, prêts pour le dossier ;
 *  - `socleDeterministeCount` : dernière tentative DETERMINISTIC_ONLY —
 *    jamais retenté, jamais compté comme un échec ;
 *  - `retryableFailureCount`/`blockedFailureCount` : dernière tentative en
 *    échec, respectivement transitoire ou nécessitant une action humaine ;
 *  - `staleBriefCount`  : brief APPROVED mais rattaché à un ancien snapshot.
 */
export type StaffTeacherDossierGroup = Readonly<{
  subject: Subject;
  level: GradeLevel;
  eligibleCount: number;
  toGenerateCount: number;
  queuedCount: number;
  processingCount: number;
  toReviewCount: number;
  correctionRequestedCount: number;
  approvedCount: number;
  socleDeterministeCount: number;
  retryableFailureCount: number;
  blockedFailureCount: number;
  staleBriefCount: number;
  completenessTier: DossierCompleteness['tier'];
}>;

type GroupDatabase = Pick<PrismaClient, 'reportArtifact' | 'jobOutbox' | 'teacherBriefAttempt'>;

/**
 * Liste les couples (matière, niveau) ayant au moins un bilan éligible, pour
 * afficher une carte par groupe côté dashboard assistante — sans lister les
 * bilans un par un.
 */
export async function listStaffTeacherDossierGroups(
  actor: DossierActor,
  database: GroupDatabase = prisma,
): Promise<readonly StaffTeacherDossierGroup[]> {
  assertStaff(actor);
  const rows = await database.reportArtifact.findMany({
    where: { status: { in: ELIGIBLE_ARTIFACT_STATUSES } },
    select: {
      id: true,
      assessmentAttempt: { select: { subject: true, gradeLevel: true } },
      revisions: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { scoreSnapshotId: true } },
      teacherBriefs: { orderBy: { version: 'desc' as const }, take: 1, select: { status: true, scoreSnapshotId: true } },
    },
  });
  const artifactIds = rows.map((row) => row.id);
  const [jobs, attempts] = await Promise.all([
    artifactIds.length === 0 ? [] : database.jobOutbox.findMany({
      where: { jobType: 'GENERATE_TEACHER_BRIEF', aggregateId: { in: artifactIds }, status: { in: ['PENDING', 'LEASED'] } },
      select: { aggregateId: true, status: true },
    }),
    artifactIds.length === 0 ? [] : database.teacherBriefAttempt.findMany({
      where: { reportArtifactId: { in: artifactIds } },
      orderBy: { createdAt: 'desc' as const },
      select: { reportArtifactId: true, result: true },
    }),
  ]);
  const latestJobByArtifact = new Map<string, 'PENDING' | 'LEASED'>();
  for (const job of jobs) if (!latestJobByArtifact.has(job.aggregateId)) latestJobByArtifact.set(job.aggregateId, job.status as 'PENDING' | 'LEASED');
  const latestAttemptByArtifact = new Map<string, string>();
  for (const attempt of attempts) if (!latestAttemptByArtifact.has(attempt.reportArtifactId)) latestAttemptByArtifact.set(attempt.reportArtifactId, attempt.result);

  type MutableGroup = {
    subject: Subject; level: GradeLevel;
    eligibleCount: number; toGenerateCount: number; queuedCount: number; processingCount: number;
    toReviewCount: number; correctionRequestedCount: number; approvedCount: number;
    socleDeterministeCount: number; retryableFailureCount: number; blockedFailureCount: number; staleBriefCount: number;
  };
  const groups = new Map<string, MutableGroup>();
  for (const row of rows) {
    const key = `${row.assessmentAttempt.subject}@${row.assessmentAttempt.gradeLevel}`;
    const entry: MutableGroup = groups.get(key) ?? {
      subject: row.assessmentAttempt.subject, level: row.assessmentAttempt.gradeLevel,
      eligibleCount: 0, toGenerateCount: 0, queuedCount: 0, processingCount: 0, toReviewCount: 0,
      correctionRequestedCount: 0, approvedCount: 0, socleDeterministeCount: 0,
      retryableFailureCount: 0, blockedFailureCount: 0, staleBriefCount: 0,
    };
    entry.eligibleCount += 1;

    const currentSnapshotId = row.revisions[0]?.scoreSnapshotId;
    const latestBrief = row.teacherBriefs[0];
    const job = latestJobByArtifact.get(row.id);
    const lastAttemptResult = latestAttemptByArtifact.get(row.id);

    const briefIsSafeAndCurrent = latestBrief?.status === 'APPROVED' && latestBrief.scoreSnapshotId === currentSnapshotId;
    const briefIsStale = latestBrief?.status === 'APPROVED' && latestBrief.scoreSnapshotId !== currentSnapshotId;

    if (job === 'LEASED') entry.processingCount += 1;
    else if (job === 'PENDING') entry.queuedCount += 1;
    else if (briefIsSafeAndCurrent) entry.approvedCount += 1;
    else if (latestBrief?.status === 'PENDING_REVIEW') entry.toReviewCount += 1;
    else if (latestBrief?.status === 'CORRECTION_REQUESTED') entry.correctionRequestedCount += 1;
    else if (lastAttemptResult === 'DETERMINISTIC_ONLY') entry.socleDeterministeCount += 1;
    else if (lastAttemptResult === 'BLOCKED_FAILURE' || lastAttemptResult === 'BUDGET_BLOCKED') entry.blockedFailureCount += 1;
    else if (lastAttemptResult === 'RETRYABLE_FAILURE') { entry.retryableFailureCount += 1; entry.toGenerateCount += 1; }
    else entry.toGenerateCount += 1; // jamais tenté, ou brief STALE/SUPERSEDED sans nouvelle tentative encore lancée

    if (briefIsStale) entry.staleBriefCount += 1;

    groups.set(key, entry);
  }
  return Object.freeze([...groups.values()]
    .map((entry) => Object.freeze({
      ...entry,
      completenessTier: (entry.approvedCount === 0
        ? 'SOCLE_DETERMINISTE'
        : entry.eligibleCount === entry.approvedCount + entry.socleDeterministeCount
          ? 'ENRICHI_COMPLET'
          : 'ENRICHI_SECURISE_PARTIEL') as DossierCompleteness['tier'],
    }))
    .sort((left, right) => left.subject.localeCompare(right.subject) || left.level.localeCompare(right.level)));
}

/**
 * IDs RÉELLEMENT ACTIONNABLES d'un groupe (matière, niveau) — pour la mise
 * en file de génération en lot (§10 de l'incident P0). Exclut explicitement,
 * sans retry aveugle :
 *  - un bilan déjà en file ou en cours (job PENDING/LEASED actif) ;
 *  - un bilan dont le dernier brief est APPROVED et courant (déjà servi) ;
 *  - un bilan dont le dernier brief attend une action humaine
 *    (PENDING_REVIEW à relire, CORRECTION_REQUESTED à reprendre) — la
 *    reprise après correction est un chemin distinct (`requestTeacherBriefCorrection`
 *    puis nouvelle tentative), jamais une régénération automatique en lot ;
 *  - un bilan dont la DERNIÈRE tentative a conclu DETERMINISTIC_ONLY : ce
 *    n'est pas une panne, il ne doit JAMAIS être retenté automatiquement.
 * Un bilan STALE (brief APPROVED mais snapshot obsolète), jamais tenté, ou
 * en échec RETRYABLE_FAILURE reste actionnable.
 */
export type ActionableTeacherBriefTarget = Readonly<{ reportArtifactId: string; expectedScoreSnapshotId: string }>;

export async function listStaffTeacherDossierActionableArtifactIds(
  actor: DossierActor,
  subject: Subject,
  level: GradeLevel,
  database: GroupDatabase = prisma,
): Promise<readonly ActionableTeacherBriefTarget[]> {
  assertStaff(actor);
  const rows = await database.reportArtifact.findMany({
    where: { status: { in: ELIGIBLE_ARTIFACT_STATUSES }, assessmentAttempt: { subject, gradeLevel: level } },
    select: {
      id: true,
      revisions: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { scoreSnapshotId: true } },
      teacherBriefs: { orderBy: { version: 'desc' as const }, take: 1, select: { status: true, scoreSnapshotId: true } },
    },
  });
  const artifactIds = rows.map((row) => row.id);
  if (artifactIds.length === 0) return Object.freeze([]);
  const [activeJobs, attempts] = await Promise.all([
    database.jobOutbox.findMany({
      where: { jobType: 'GENERATE_TEACHER_BRIEF', aggregateId: { in: artifactIds }, status: { in: ['PENDING', 'LEASED'] } },
      select: { aggregateId: true },
    }),
    database.teacherBriefAttempt.findMany({
      where: { reportArtifactId: { in: artifactIds } },
      orderBy: { createdAt: 'desc' as const },
      select: { reportArtifactId: true, result: true },
    }),
  ]);
  const hasActiveJob = new Set(activeJobs.map((job) => job.aggregateId));
  const lastAttemptResult = new Map<string, string>();
  for (const attempt of attempts) if (!lastAttemptResult.has(attempt.reportArtifactId)) lastAttemptResult.set(attempt.reportArtifactId, attempt.result);

  const actionable = rows.filter((row) => {
    if (hasActiveJob.has(row.id)) return false;
    const brief = row.teacherBriefs[0];
    const currentSnapshotId = row.revisions[0]?.scoreSnapshotId;
    if (brief?.status === 'APPROVED' && brief.scoreSnapshotId === currentSnapshotId) return false;
    if (brief?.status === 'PENDING_REVIEW' || brief?.status === 'CORRECTION_REQUESTED') return false;
    if (lastAttemptResult.get(row.id) === 'DETERMINISTIC_ONLY') return false;
    return true;
  });
  return Object.freeze(actionable
    .filter((row) => row.revisions[0]?.scoreSnapshotId !== undefined)
    .map((row) => Object.freeze({ reportArtifactId: row.id, expectedScoreSnapshotId: row.revisions[0].scoreSnapshotId })));
}
