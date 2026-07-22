import type { CatalogSubject, SchoolLevel } from '../core/types';
import { MATHS_NSI_V1_PACKS } from './fixtures/maths-nsi.v1';

export const CATALOG_ERROR_CODES = [
  'PACK_NOT_ELIGIBLE',
  'PACK_NOT_PUBLISHED',
  'PACK_AMBIGUOUS_SELECTION',
  'PACK_INVALID_VERSIONING',
  'PACK_INVALID_REGULATORY_METADATA',
  'PACK_INVALID_PEDAGOGICAL_REVIEW',
  'PACK_INVALID_COMPETENCIES',
  'PACK_INVALID_QUESTION_REFERENCES',
  'PACK_INSUFFICIENT_COVERAGE',
  'PACK_INVALID_PREREQUISITE_GRAPH',
] as const;

export type CatalogErrorCode = (typeof CATALOG_ERROR_CODES)[number];
export type PackPublicationStatus = 'REVIEW_REQUIRED' | 'PUBLISHED';

export type PackSelection = Readonly<{
  subject: CatalogSubject;
  grade: SchoolLevel;
  schoolYear: string;
  track?: string;
  specialty?: string;
}>;

export type CurriculumPack = {
  id: string;
  status: PackPublicationStatus;
  selection: PackSelection;
  versions: {
    curriculum: string;
    assessment: string;
    scoring: string;
    report: string;
    corpus: string;
  };
  checksums: {
    curriculum: string;
    assessment: string;
    scoring: string;
    report: string;
    corpus: string;
  };
  regulatory: {
    officialSourceUrl?: string;
    officialSourceIdentifier?: string;
    consultedAt?: string;
    effectiveFrom?: string;
    sourceChecksum?: string;
  };
  pedagogicalReviewer?: string;
  competencies: Array<{
    id: string;
    prerequisiteIds?: string[];
    questionIds: string[];
  }>;
  questionIds: string[];
  minimumCoverage: {
    competencies: number;
    questions: number;
  };
};

export class CatalogError extends Error {
  constructor(public readonly code: CatalogErrorCode) {
    super(code);
    this.name = 'CatalogError';
  }
}

/** The complete catalogue is intentionally consulted before publication filtering. */
export const allPacks: readonly CurriculumPack[] = MATHS_NSI_V1_PACKS;

const sha256Checksum = /^sha256:[a-f0-9]{64}$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function fail(code: CatalogErrorCode): never {
  throw new CatalogError(code);
}

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidDate(value: string | undefined): value is string {
  if (!value || !isoDate.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function isChecksum(value: string | undefined): value is string {
  return Boolean(value && sha256Checksum.test(value));
}

function matchesSelection(pack: CurriculumPack, selection: PackSelection): boolean {
  return (
    pack.selection.subject === selection.subject
    && pack.selection.grade === selection.grade
    && pack.selection.schoolYear === selection.schoolYear
    && (!pack.selection.track || pack.selection.track === selection.track)
    && (!pack.selection.specialty || pack.selection.specialty === selection.specialty)
  );
}

function validateVersions(pack: CurriculumPack): void {
  const versions = Object.values(pack.versions);
  const checksums = Object.values(pack.checksums);

  if (!versions.every(isNonEmpty) || !checksums.every(isChecksum)) {
    fail('PACK_INVALID_VERSIONING');
  }
}

function validateRegulatoryMetadata(pack: CurriculumPack): void {
  const { officialSourceUrl, officialSourceIdentifier, consultedAt, effectiveFrom, sourceChecksum } = pack.regulatory;
  let validUrl = false;

  try {
    validUrl = Boolean(officialSourceUrl && new URL(officialSourceUrl).protocol === 'https:');
  } catch {
    validUrl = false;
  }

  if (!validUrl || !isNonEmpty(officialSourceIdentifier) || !isValidDate(consultedAt)
    || !isValidDate(effectiveFrom) || !isChecksum(sourceChecksum)) {
    fail('PACK_INVALID_REGULATORY_METADATA');
  }
}

function validateCompetencies(pack: CurriculumPack): void {
  const competencyIds = pack.competencies.map((competency) => competency.id);
  if (!competencyIds.length || competencyIds.some((id) => !isNonEmpty(id))
    || new Set(competencyIds).size !== competencyIds.length) {
    fail('PACK_INVALID_COMPETENCIES');
  }

  const questionIds = new Set(pack.questionIds);
  const referencedQuestionIds = new Set(pack.competencies.flatMap((competency) => competency.questionIds));
  if (!pack.questionIds.length || pack.questionIds.some((id) => !isNonEmpty(id))
    || questionIds.size !== pack.questionIds.length
    || pack.competencies.some((competency) => !competency.questionIds.length
      || competency.questionIds.some((questionId) => !questionIds.has(questionId)))
    || pack.questionIds.some((questionId) => !referencedQuestionIds.has(questionId))) {
    fail('PACK_INVALID_QUESTION_REFERENCES');
  }

  const hasEnoughCoverage = Number.isInteger(pack.minimumCoverage.competencies)
    && Number.isInteger(pack.minimumCoverage.questions)
    && pack.minimumCoverage.competencies > 0
    && pack.minimumCoverage.questions > 0
    && competencyIds.length >= pack.minimumCoverage.competencies
    && questionIds.size >= pack.minimumCoverage.questions;
  if (!hasEnoughCoverage) {
    fail('PACK_INSUFFICIENT_COVERAGE');
  }

  const prerequisites = new Map(pack.competencies.map((competency) => [
    competency.id,
    competency.prerequisiteIds ?? [],
  ]));
  for (const prerequisiteIds of prerequisites.values()) {
    if (prerequisiteIds.some((id) => !prerequisites.has(id))) {
      fail('PACK_INVALID_PREREQUISITE_GRAPH');
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) fail('PACK_INVALID_PREREQUISITE_GRAPH');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisiteId of prerequisites.get(id) ?? []) visit(prerequisiteId);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of prerequisites.keys()) visit(id);
}

/**
 * Checks every condition required before a content pack may be PUBLISHED.
 * REVIEW_REQUIRED packs are deliberately allowed to exist without passing it.
 */
export function validatePack(pack: CurriculumPack): void {
  validateVersions(pack);
  validateRegulatoryMetadata(pack);
  if (!isNonEmpty(pack.pedagogicalReviewer)) fail('PACK_INVALID_PEDAGOGICAL_REVIEW');
  validateCompetencies(pack);
}

/**
 * Resolves against all known packs first, preserving the important distinction
 * between an ineligible selection and content that still awaits publication.
 */
export function resolveEligiblePack(
  selection: PackSelection,
  packs: readonly CurriculumPack[] = allPacks,
): CurriculumPack {
  const matchingPacks = packs.filter((candidate) => matchesSelection(candidate, selection));
  if (!matchingPacks.length) fail('PACK_NOT_ELIGIBLE');

  const publishedPacks = matchingPacks.filter((candidate) => candidate.status === 'PUBLISHED');
  if (!publishedPacks.length) fail('PACK_NOT_PUBLISHED');
  if (publishedPacks.length > 1) fail('PACK_AMBIGUOUS_SELECTION');
  const [pack] = publishedPacks;

  validatePack(pack);
  return JSON.parse(JSON.stringify(pack)) as CurriculumPack;
}
