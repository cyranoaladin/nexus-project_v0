import fs from 'node:fs';

import type { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { load } from 'js-yaml';

import { prisma } from '@/lib/prisma';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import { cpsCatalogSchema, type CpsCatalog } from '../catalog/bank-validation';
import { bilanPackSubjectLabel } from '../catalog/subjects';
import { loadWaveManifest, repositoryPath } from '../catalog/wave-manifest';
import type { FactSheet } from '../facts/fact-sheet';
import { buildGroupPlan, type GroupMember } from '../group-plan/plan';
import { renderGroupPlanHtml, renderGroupPlanPdf } from '../group-plan/render';
import { buildPreRentreeStageLabel } from '../render/stage-label';

const MANIFEST_PATH = 'data/bilans/banks/wave1.manifest.json';

export type StaffGroupPlanCandidate = Readonly<{
  id: string;
  assessmentPackId: string;
  assessmentPackVersion: string;
  status: string;
  displayName: string;
  factSheet: FactSheet;
}>;

type StaffActor = Readonly<{ userId: string; role: UserRole | string }>;
type GroupPlanFormat = 'html' | 'pdf';
type GroupPlanDependencies = Readonly<{
  findCoach(userId: string): Promise<Readonly<{ id: string }> | null>;
  listCandidates(coachId: string): Promise<readonly StaffGroupPlanCandidate[]>;
  findAttempts(attemptIds: readonly string[], coachId: string): Promise<readonly StaffGroupPlanCandidate[]>;
  resolvePack: PackResolver;
  loadCatalog(slug: string): CpsCatalog;
  renderHtml: typeof renderGroupPlanHtml;
  renderPdf: typeof renderGroupPlanPdf;
  now: () => Date;
}>;

export class StaffGroupPlanError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'StaffGroupPlanError';
  }
}

function assertFactSheet(value: unknown): FactSheet {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new StaffGroupPlanError('GROUP_FACT_SHEET_INVALID');
  const candidate = value as Partial<FactSheet>;
  if (
    typeof candidate.bankSlug !== 'string'
    || !Number.isSafeInteger(candidate.bankVersion)
    || !Array.isArray(candidate.nodes)
    || typeof candidate.groupBand !== 'string'
  ) throw new StaffGroupPlanError('GROUP_FACT_SHEET_INVALID');
  return value as FactSheet;
}

function studentName(user: Readonly<{ firstName: string | null; lastName: string | null }>): string {
  const name = [user.firstName, user.lastName].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(' ').trim();
  if (!name) throw new StaffGroupPlanError('GROUP_STUDENT_NAME_MISSING');
  return name;
}

const scoredSelection = {
  id: true,
  assessmentPackId: true,
  assessmentPackVersion: true,
  status: true,
  student: { select: { user: { select: { firstName: true, lastName: true } } } },
  scoreSnapshots: { select: { result: true }, take: 1 },
} as const;

type SelectedAttempt = Prisma.CanonicalAssessmentAttemptGetPayload<{ select: typeof scoredSelection }>;

function selectedAttempt(row: SelectedAttempt): StaffGroupPlanCandidate {
  const snapshot = row.scoreSnapshots[0];
  if (snapshot === undefined) throw new StaffGroupPlanError('GROUP_ATTEMPT_NOT_SCORED');
  return Object.freeze({
    id: row.id,
    assessmentPackId: row.assessmentPackId,
    assessmentPackVersion: row.assessmentPackVersion,
    status: row.status,
    displayName: studentName(row.student.user),
    factSheet: assertFactSheet(snapshot.result),
  });
}

type GroupPlanDatabase = Pick<PrismaClient, 'coachProfile' | 'canonicalAssessmentAttempt'>;

function databaseDependencies(database: GroupPlanDatabase) {
  const assignment = (coachId: string) => ({ student: { coachAssignments: { some: { coachId, status: 'ACTIVE' as const } } } });
  return {
    findCoach: (userId: string) => database.coachProfile.findUnique({ where: { userId }, select: { id: true } }),
    listCandidates: async (coachId: string) => (await database.canonicalAssessmentAttempt.findMany({
      where: { ...assignment(coachId), scoreSnapshots: { some: {} } },
      select: scoredSelection,
      orderBy: [{ assessmentPackId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })).map(selectedAttempt),
    findAttempts: async (attemptIds: readonly string[], coachId: string) => (await database.canonicalAssessmentAttempt.findMany({
      where: { id: { in: [...attemptIds] }, ...assignment(coachId), scoreSnapshots: { some: {} } },
      select: scoredSelection,
      orderBy: { id: 'asc' },
    })).map(selectedAttempt),
  };
}

function loadCatalog(slug: string): CpsCatalog {
  const entry = loadWaveManifest(MANIFEST_PATH).banks.find((bank) => bank.slug === slug);
  if (entry === undefined) throw new StaffGroupPlanError('GROUP_PACK_NOT_FOUND');
  const paths = typeof entry.cps === 'string' ? [entry.cps] : entry.cps;
  const catalogs = paths.map((catalogPath) => cpsCatalogSchema.parse(load(fs.readFileSync(repositoryPath(catalogPath), 'utf8'))));
  if (catalogs.length === 1) return catalogs[0];
  const nodes = catalogs.flatMap((catalog) => catalog.nodes);
  if (new Set(nodes.map(({ id }) => id)).size !== nodes.length) throw new StaffGroupPlanError('GROUP_CATALOG_NODE_COLLISION');
  return cpsCatalogSchema.parse({ schemaVersion: 'nexus-cps-catalog/v1', slug: `${slug}-combined`, version: 1, nodes });
}

const database = databaseDependencies(prisma);
const defaultDependencies: GroupPlanDependencies = {
  ...database,
  resolvePack: resolveEnabledPack,
  loadCatalog,
  renderHtml: renderGroupPlanHtml,
  renderPdf: renderGroupPlanPdf,
  now: () => new Date(),
};

async function coachId(actor: StaffActor, dependencies: GroupPlanDependencies): Promise<string> {
  if (actor.role !== 'COACH' || !actor.userId.trim()) throw new StaffGroupPlanError('NOT_FOUND');
  const coach = await dependencies.findCoach(actor.userId);
  if (coach === null) throw new StaffGroupPlanError('NOT_FOUND');
  return coach.id;
}

function packVersion(candidate: StaffGroupPlanCandidate): number {
  const version = Number(candidate.assessmentPackVersion);
  if (!Number.isSafeInteger(version) || version < 1) throw new StaffGroupPlanError('GROUP_PACK_VERSION_INVALID');
  return version;
}

export async function listStaffGroupPlanCandidates(
  actor: StaffActor,
  overrides: Partial<GroupPlanDependencies> = {},
): Promise<readonly StaffGroupPlanCandidate[]> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const candidates = await dependencies.listCandidates(await coachId(actor, dependencies));
  return Object.freeze(candidates.filter((candidate) => dependencies.resolvePack(candidate.assessmentPackId, packVersion(candidate)) !== null));
}

export async function buildStaffGroupPlanDocument(
  input: StaffActor & Readonly<{ attemptIds: readonly string[]; format: GroupPlanFormat }>,
  overrides: Partial<GroupPlanDependencies> = {},
): Promise<Readonly<{ body: string | Buffer; contentType: string; filename: string }>> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const uniqueIds = [...new Set(input.attemptIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length < 3 || uniqueIds.length > 5 || uniqueIds.length !== input.attemptIds.length) {
    throw new StaffGroupPlanError('GROUP_SELECTION_MUST_HAVE_3_TO_5_ATTEMPTS');
  }
  const attempts = await dependencies.findAttempts(uniqueIds, await coachId(input, dependencies));
  if (attempts.length !== uniqueIds.length) throw new StaffGroupPlanError('NOT_FOUND');
  const first = attempts[0];
  if (attempts.some((attempt) => attempt.assessmentPackId !== first.assessmentPackId || attempt.assessmentPackVersion !== first.assessmentPackVersion)) {
    throw new StaffGroupPlanError('GROUP_ATTEMPTS_MUST_SHARE_PACK');
  }
  const version = packVersion(first);
  const enabled = dependencies.resolvePack(first.assessmentPackId, version);
  if (enabled === null) throw new StaffGroupPlanError('NOT_FOUND');
  const members: readonly GroupMember[] = attempts.map(({ displayName, factSheet }) => ({ displayName, factSheet }));
  const plan = buildGroupPlan(dependencies.loadCatalog(first.assessmentPackId), members);
  const date = dependencies.now().toISOString().slice(0, 10);
  const identity = {
    displayName: `Groupe de ${members.length} élèves`,
    level: enabled.pack.level,
    subject: enabled.pack.subject,
    date,
    stageLabel: buildPreRentreeStageLabel(enabled.pack.level, enabled.pack.subject),
  } as const;
  const filename = `plan-groupe-${bilanPackSubjectLabel(enabled.pack.subject).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${date}`;
  if (input.format === 'html') {
    return Object.freeze({ body: dependencies.renderHtml(plan, identity), contentType: 'text/html; charset=utf-8', filename: `${filename}.html` });
  }
  const rendered = await dependencies.renderPdf(plan, identity);
  if (rendered.status === 'UNAVAILABLE') throw new StaffGroupPlanError(rendered.errorCode);
  return Object.freeze({ body: rendered.pdf, contentType: 'application/pdf', filename: `${filename}.pdf` });
}
