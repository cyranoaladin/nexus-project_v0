import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const REQUIREMENTS_PATH = 'data/aria/academic-profile-requirements.v1.json';
const COURSES_PATH = 'data/curriculum/v1/courses.json';
const CAPABILITIES_PATH = 'data/aria/course-capabilities.v1.json';
const RESOURCES_PATH = 'data/aria/resources.v1.json';
const OUTPUT_PATH = 'docs/_generated/aria-academic-capability-coverage.v1.json';

type RepresentationStatus = 'REPRESENTED' | 'PARTIAL' | 'UNREPRESENTABLE' | 'NOT_PROVEN';
interface Requirements {
  readonly schemaVersion: 1;
  readonly matrixVersion: string;
  readonly enumSnapshots: Record<string, readonly string[]>;
  readonly languageChoiceModel: string;
  readonly dimensions: readonly {
    readonly id: string;
    readonly status: RepresentationStatus;
    readonly currentModel: string;
    readonly evidence: string;
  }[];
}

function bytes(path: string): Buffer {
  return readFileSync(resolve(ROOT, path));
}

function json<T>(path: string): T {
  return JSON.parse(bytes(path).toString('utf8')) as T;
}

function enumValues(schema: string, name: string): readonly string[] {
  const match = schema.match(new RegExp(`enum\\s+${name}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) throw new Error(`ARIA_ACADEMIC_ENUM_MISSING:${name}`);
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, '').trim().split(/\s+/)[0])
    .filter(Boolean);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

const requirements = json<Requirements>(REQUIREMENTS_PATH);
if (requirements.schemaVersion !== 1 || requirements.dimensions.length === 0) {
  throw new Error('ARIA_ACADEMIC_REQUIREMENTS_INVALID');
}
const prismaSchema = bytes('prisma/schema.prisma').toString('utf8');
const enums = Object.fromEntries(
  ['GradeLevel', 'AcademicTrack', 'StmgPathway'].map((name) => [name, enumValues(prismaSchema, name)]),
);
for (const [name, expected] of Object.entries(requirements.enumSnapshots)) {
  if (!sameSet(enums[name] ?? [], expected)) throw new Error(`ARIA_ACADEMIC_ENUM_DRIFT:${name}`);
}

const courses = json<{ readonly courses: readonly { readonly courseKey: string }[] }>(COURSES_PATH).courses;
const capabilities = json<{
  readonly courses: Record<string, {
    readonly skillGraphRef: string | null;
    readonly hasAssessmentContext: boolean;
    readonly chat: { readonly policy: string; readonly corpusId: string } | null;
  }>;
}>(CAPABILITIES_PATH).courses;
const resources = json<{
  readonly resources: readonly { readonly courseKey: string; readonly status: 'ACTIVE' | 'RETIRED' }[];
}>(RESOURCES_PATH).resources;
const activeResources = resources.filter(({ status }) => status === 'ACTIVE');
const knownCourseKeys = new Set(courses.map(({ courseKey }) => courseKey));
const unknownCapabilityKeys = Object.keys(capabilities).filter((courseKey) => !knownCourseKeys.has(courseKey));
const unknownResourceKeys = resources.map(({ courseKey }) => courseKey)
  .filter((courseKey) => !knownCourseKeys.has(courseKey));
if (unknownCapabilityKeys.length > 0 || unknownResourceKeys.length > 0) {
  throw new Error('ARIA_CAPABILITY_REFERENCES_UNKNOWN_COURSE');
}

const counts = requirements.dimensions.reduce<Record<RepresentationStatus, number>>(
  (result, dimension) => ({ ...result, [dimension.status]: result[dimension.status] + 1 }),
  { REPRESENTED: 0, PARTIAL: 0, UNREPRESENTABLE: 0, NOT_PROVEN: 0 },
);
const capabilityEntries = Object.values(capabilities);
const sourceDigest = createHash('sha256');
for (const path of [REQUIREMENTS_PATH, COURSES_PATH, CAPABILITIES_PATH, RESOURCES_PATH]) {
  sourceDigest.update(path).update('\0').update(bytes(path)).update('\0');
}
const artifact = {
  schemaVersion: 1,
  generatedFromSha256: sourceDigest.digest('hex'),
  matrixVersion: requirements.matrixVersion,
  enumSnapshots: enums,
  academicMapRepresentationCoverage: {
    status: counts.UNREPRESENTABLE + counts.NOT_PROVEN + counts.PARTIAL > 0 ? 'INCOMPLETE' : 'COMPLETE',
    counts,
  },
  ariaCapabilityCoverage: {
    status: Object.keys(capabilities).length < courses.length ? 'PARTIAL' : 'COMPLETE',
    knownCourseCount: courses.length,
    declaredCourseCount: Object.keys(capabilities).length,
    chatDeclaredCourseCount: capabilityEntries.filter(({ chat }) => chat !== null).length,
    skillGraphDeclaredCourseCount: capabilityEntries.filter(({ skillGraphRef }) => skillGraphRef !== null).length,
    assessmentDeclaredCourseCount: capabilityEntries.filter(({ hasAssessmentContext }) => hasAssessmentContext).length,
    physicallyVerifiedResourceCourseCount: new Set(activeResources.map(({ courseKey }) => courseKey)).size,
    runtimeCorpusAvailability: 'NOT_ASSERTED_BY_STATIC_MAPPING',
  },
  languageChoiceModel: requirements.languageChoiceModel,
  dimensions: requirements.dimensions,
};
const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
const outputPath = resolve(ROOT, OUTPUT_PATH);
if (process.argv.includes('--write')) {
  writeFileSync(outputPath, serialized);
} else {
  let current = '';
  try { current = readFileSync(outputPath, 'utf8'); } catch { /* reported below */ }
  if (current !== serialized) throw new Error('ARIA_ACADEMIC_COVERAGE_ARTIFACT_STALE');
}
process.stdout.write('ACADEMIC_ENUM_DRIFT=0\n');
process.stdout.write(`ACADEMIC_MAP_REPRESENTATION_COVERAGE=${artifact.academicMapRepresentationCoverage.status}\n`);
process.stdout.write(`ACADEMIC_MAP_UNREPRESENTABLE_DIMENSIONS=${counts.UNREPRESENTABLE + counts.NOT_PROVEN}\n`);
process.stdout.write(`ARIA_CAPABILITY_COVERAGE=${artifact.ariaCapabilityCoverage.status}\n`);
