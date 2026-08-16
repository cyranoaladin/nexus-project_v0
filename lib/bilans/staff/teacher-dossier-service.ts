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
import {
  buildDossierGroupAnalysis,
  buildDossierSessionPlan,
  type DossierMember,
} from '../teacher-dossier/aggregate';
import {
  renderTeacherDossierHtml,
  renderTeacherDossierPdf,
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

/** Statuts de brief candidats au dossier enseignant : STRICTEMENT APPROVED (hotfix P0 fail-closed). */
const APPROVED_BRIEF_STATUS = 'APPROVED' as const;

import { APPROVED_BRIEF_SAFETY_MARKER } from './teacher-dossier-safety';
export { APPROVED_BRIEF_SAFETY_MARKER };

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
    select: { content: true, scoreSnapshotId: true, scoreSnapshot: { select: { result: true } } },
  },
  teacherBriefs: {
    where: { status: APPROVED_BRIEF_STATUS },
    orderBy: { version: 'desc' as const },
    select: { id: true, version: true, status: true, scoreSnapshotId: true, content: true, editedContent: true },
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
  renderHtml: typeof renderTeacherDossierHtml;
  renderPdf: typeof renderTeacherDossierPdf;
  now: () => Date;
}>;

function databaseDependencies(database: Pick<PrismaClient, 'reportArtifact'>) {
  return {
    findCandidates: (subject: Subject, level: GradeLevel) => database.reportArtifact.findMany({
      where: { status: { in: ELIGIBLE_ARTIFACT_STATUSES }, assessmentAttempt: { subject, gradeLevel: level } },
      select: candidateSelection,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  };
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

export function selectApprovedBrief(
  briefs: readonly DossierCandidateRow['teacherBriefs'][number][],
  currentScoreSnapshotId: string | undefined,
): DossierCandidateRow['teacherBriefs'][number] | undefined {
  if (currentScoreSnapshotId === undefined || briefs.length === 0) return undefined;
  return briefs.find(
    (b) => b.status === APPROVED_BRIEF_STATUS && b.scoreSnapshotId === currentScoreSnapshotId,
  );
}

function briefContent(
  row: DossierCandidateRow['teacherBriefs'][number] | undefined,
): TeacherBriefContent | null {
  if (row === undefined) return null;
  if (row.status !== APPROVED_BRIEF_STATUS) return null;

  const edited = row.editedContent?.trim();
  let raw: unknown = null;
  if (edited !== undefined && edited.length > 0) {
    try {
      raw = JSON.parse(edited);
    } catch {
      return null;
    }
  } else {
    raw = row.content;
  }

  const parsed = teacherBriefSchema.safeParse(raw);
  if (!parsed.success) return null;

  return parsed.data;
}

type ResolvedCandidate = Readonly<{
  displayName: string;
  factSheet: FactSheet;
  evidence: QuestionEvidence;
  brief: TeacherBriefContent | null;
  briefSafetyMarker?: typeof APPROVED_BRIEF_SAFETY_MARKER;
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
    const selectedBrief = selectApprovedBrief(row.teacherBriefs, revision.scoreSnapshotId);
    const parsedBrief = briefContent(selectedBrief);
    resolved.push(Object.freeze({
      displayName,
      factSheet,
      evidence,
      brief: parsedBrief,
      ...(parsedBrief !== null ? { briefSafetyMarker: APPROVED_BRIEF_SAFETY_MARKER } : {}),
      packId: row.assessmentAttempt.assessmentPackId,
      packVersion,
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
    displayName: candidate.displayName, factSheet: candidate.factSheet, evidence: candidate.evidence, brief: candidate.brief, briefSafetyMarker: candidate.briefSafetyMarker,
  })));
  const members: readonly DossierMember[] = students;
  const analysis = buildDossierGroupAnalysis(members);

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
    analysis, sessionPlan, evidenceCatalog: students[0].evidence, generatedAt: date,
  });

  const filenameBase = `dossier-enseignant-${bilanPackSubjectLabel(enabled.pack.subject).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${bilanPackLevelLabel(enabled.pack.level).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${date}`;
  if (input.format === 'html') {
    return Object.freeze({ body: dependencies.renderHtml(doc), contentType: 'text/html; charset=utf-8', filename: `${filenameBase}.html` });
  }
  const rendered = await dependencies.renderPdf(doc);
  if (rendered.status === 'UNAVAILABLE') throw new StaffTeacherDossierError(rendered.errorCode);
  return Object.freeze({ body: rendered.pdf, contentType: 'application/pdf', filename: `${filenameBase}.pdf` });
}

export type StaffTeacherDossierGroup = Readonly<{ subject: Subject; level: GradeLevel; count: number; briefsMissing: number }>;

/**
 * Liste les couples (matière, niveau) ayant au moins un bilan éligible, pour
 * afficher un bouton par groupe côté dashboard assistante — sans lister les
 * bilans un par un.
 */
export async function listStaffTeacherDossierGroups(
  actor: DossierActor,
  database: Pick<PrismaClient, 'reportArtifact'> = prisma,
): Promise<readonly StaffTeacherDossierGroup[]> {
  assertStaff(actor);
  const rows = await database.reportArtifact.findMany({
    where: { status: { in: ELIGIBLE_ARTIFACT_STATUSES } },
    select: {
      assessmentAttempt: { select: { subject: true, gradeLevel: true } },
      teacherBriefs: { where: { status: APPROVED_BRIEF_STATUS }, select: { id: true }, take: 1 },
    },
  });
  const groups = new Map<string, { subject: Subject; level: GradeLevel; count: number; briefsMissing: number }>();
  for (const row of rows) {
    const key = `${row.assessmentAttempt.subject}@${row.assessmentAttempt.gradeLevel}`;
    const entry = groups.get(key) ?? { subject: row.assessmentAttempt.subject, level: row.assessmentAttempt.gradeLevel, count: 0, briefsMissing: 0 };
    entry.count += 1;
    if (row.teacherBriefs.length === 0) entry.briefsMissing += 1;
    groups.set(key, entry);
  }
  return Object.freeze([...groups.values()].sort((left, right) => left.subject.localeCompare(right.subject) || left.level.localeCompare(right.level)));
}

/**
 * IDs des bilans éligibles d'un groupe (matière, niveau) — pour la
 * régénération en lot des briefs enseignant. `generateTeacherBrief` est déjà
 * idempotent (mode `ALREADY_PRESENT`) : reboucler sur tout le groupe à chaque
 * clic est sûr, même quand des bilans s'y sont ajoutés depuis le dernier essai.
 */
export async function listStaffTeacherDossierArtifactIds(
  actor: DossierActor,
  subject: Subject,
  level: GradeLevel,
  database: Pick<PrismaClient, 'reportArtifact'> = prisma,
): Promise<readonly string[]> {
  assertStaff(actor);
  const rows = await database.reportArtifact.findMany({
    where: { status: { in: ELIGIBLE_ARTIFACT_STATUSES }, assessmentAttempt: { subject, gradeLevel: level } },
    select: { id: true },
  });
  return Object.freeze(rows.map((row) => row.id));
}
