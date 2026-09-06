import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import servableCorpusManifestSchema from '@/data/aria/generated/rag-contracts/v1/servable-corpus-manifest-v1.json';
import type { AriaPedagogicalMode } from '../../domain/pedagogy/pedagogical-mode';
import { resolveAriaCourseCorpusId } from '../../manifests/course-capabilities';
import {
  ARIA_RESOURCE_REGISTRY_SHA256,
  ARIA_RESOURCE_REGISTRY_VERSION,
  getAriaResourceRecord,
  getAriaResourceVersion,
  isAriaResourceRagCitable,
} from '../../manifests/resource-registry';
import { sha256AriaRagJson } from './internal-identity';

type JsonRecord = Record<string, unknown>;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateServableCorpusManifest = ajv.compile(servableCorpusManifestSchema);
const MAX_RUNTIME_MANIFEST_BYTES = 5 * 1024 * 1024;
const RUNTIME_MANIFEST_CONFIGURATION_ERROR = 'ARIA_RAG_MANIFEST_CONFIGURATION_INVALID';
const RUNTIME_MANIFEST_FILE_UNSAFE = 'ARIA_RAG_MANIFEST_FILE_UNSAFE';
const RUNTIME_MANIFEST_DIGEST_MISMATCH = 'ARIA_RAG_MANIFEST_DIGEST_MISMATCH';
export const ARIA_RAG_RUNTIME_MANIFEST_SUFFIX = '.aria-rag-manifest';

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withoutManifestDigest(manifest: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(manifest).filter(([key]) => key !== 'manifest_sha256'),
  );
}

export function computeAriaServableManifestSha256(payload: unknown): string {
  return sha256AriaRagJson(payload);
}

export function loadConfiguredAriaServableManifest(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): unknown | null {
  const root = environment.ARIA_RAG_SERVABLE_MANIFEST_ROOT?.trim() ?? '';
  const digest = environment.ARIA_RAG_ACTIVE_MANIFEST_SHA256?.trim() ?? '';
  if (!root && !digest) return null;
  if (!root || !isAbsolute(root) || !/^[0-9a-f]{64}$/.test(digest)) {
    throw new Error(RUNTIME_MANIFEST_CONFIGURATION_ERROR);
  }
  const lexicalRoot = resolve(root);
  const canonicalRoot = realpathSync(root);
  if (canonicalRoot !== lexicalRoot) {
    throw new Error(RUNTIME_MANIFEST_FILE_UNSAFE);
  }
  const rootStat = lstatSync(canonicalRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(RUNTIME_MANIFEST_FILE_UNSAFE);
  }
  const path = resolve(canonicalRoot, `${digest}${ARIA_RAG_RUNTIME_MANIFEST_SUFFIX}`);
  const pathStat = lstatSync(path);
  if (!pathStat.isFile() || pathStat.isSymbolicLink()
    || pathStat.size <= 0 || pathStat.size > MAX_RUNTIME_MANIFEST_BYTES) {
    throw new Error(RUNTIME_MANIFEST_FILE_UNSAFE);
  }
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const descriptorStat = fstatSync(descriptor);
    if (!descriptorStat.isFile() || descriptorStat.size !== pathStat.size
      || descriptorStat.size <= 0 || descriptorStat.size > MAX_RUNTIME_MANIFEST_BYTES) {
      throw new Error(RUNTIME_MANIFEST_FILE_UNSAFE);
    }
    let manifest: unknown;
    try {
      manifest = JSON.parse(readFileSync(descriptor, 'utf8'));
    } catch {
      throw new Error(RUNTIME_MANIFEST_FILE_UNSAFE);
    }
    if (!isRecord(manifest)
      || manifest.manifest_sha256 !== digest
      || computeAriaServableManifestSha256(withoutManifestDigest(manifest)) !== digest) {
      throw new Error(RUNTIME_MANIFEST_DIGEST_MISMATCH);
    }
    return manifest;
  } finally {
    closeSync(descriptor);
  }
}

let configuredManifestCache:
  | { readonly key: string; readonly manifest: unknown | null }
  | undefined;

function configuredAriaServableManifest(): unknown | null {
  const key = `${process.env.ARIA_RAG_SERVABLE_MANIFEST_ROOT ?? ''}:`+
    `${process.env.ARIA_RAG_ACTIVE_MANIFEST_SHA256 ?? ''}`;
  if (configuredManifestCache?.key === key) return configuredManifestCache.manifest;
  const manifest = loadConfiguredAriaServableManifest();
  configuredManifestCache = Object.freeze({ key, manifest });
  return manifest;
}

export type AriaRagCorpusCapability =
  | { readonly status: 'NOT_CONFIGURED'; readonly reasonCode: string }
  | { readonly status: 'UNAVAILABLE'; readonly reasonCode: string }
  | {
    readonly status: 'AVAILABLE';
    readonly corpus: {
      readonly corpusId: string;
      readonly corpusVersionId: string;
      readonly physicalCollection: string;
      readonly manifestSha256: string;
      readonly resourceRegistrySha256: string;
      readonly academicYear: string;
      readonly curriculumVersion: string;
      readonly retrievalScope: Readonly<JsonRecord>;
      readonly retrievalScopeSha256: string;
      readonly resourceBindings: readonly {
        readonly resourceId: string;
        readonly resourceVersionId: string;
        readonly contentSha256: string;
        readonly chunks: readonly {
          readonly chunkId: string;
          readonly locator: Readonly<Record<string, string | number>>;
        }[];
      }[];
    };
  };

function locatorToDomain(locator: JsonRecord): Readonly<Record<string, string | number>> {
  return Object.freeze(Object.fromEntries(
    Object.entries(locator).filter((entry): entry is [string, string | number] =>
      typeof entry[1] === 'string' || typeof entry[1] === 'number'),
  ));
}

function isConsecutiveAcademicYear(value: string): boolean {
  const match = /^(\d{4})-(\d{4})$/.exec(value);
  return match !== null && Number(match[2]) === Number(match[1]) + 1;
}

function validateLocator(locator: JsonRecord): boolean {
  const values = Object.values(locator).filter((value) => value !== null);
  if (values.length === 0) return false;
  const page = locator.page;
  const pageStart = locator.page_start;
  const pageEnd = locator.page_end;
  const start = locator.start_char;
  const end = locator.end_char;
  return (pageStart === null) === (pageEnd === null)
    && !(page !== null && pageStart !== null)
    && (typeof pageStart !== 'number' || typeof pageEnd !== 'number' || pageEnd >= pageStart)
    && (start === null) === (end === null)
    && (typeof start !== 'number' || typeof end !== 'number' || end > start);
}

function validateCorpusBindings(
  manifest: JsonRecord,
  courseKey: string,
  requestedCorpusId: string,
): string | null {
  const corpusPairs = new Set<string>();
  const corpora = manifest.corpora as JsonRecord[];
  for (const corpus of corpora) {
    const pair = `${String(corpus.corpus_id)}:${String(corpus.corpus_version_id)}`;
    if (corpusPairs.has(pair)) return 'SERVABLE_MANIFEST_INVALID';
    corpusPairs.add(pair);
    if (!isConsecutiveAcademicYear(String(corpus.academic_year))) {
      return 'SERVABLE_MANIFEST_INVALID';
    }
    const scope = corpus.retrieval_scope as JsonRecord;
    const evidence = scope.evidence_subject as JsonRecord;
    if (evidence.collection !== corpus.physical_collection
      || evidence.school_year !== corpus.academic_year
      || evidence.programme_version !== corpus.curriculum_version) {
      return 'SERVABLE_SCOPE_BINDING_MISMATCH';
    }

    const versionIds = new Set<string>();
    for (const resource of corpus.resources as JsonRecord[]) {
      const resourceId = String(resource.resource_id);
      const resourceVersionId = String(resource.resource_version_id);
      if (versionIds.has(resourceVersionId)) return 'SERVABLE_MANIFEST_INVALID';
      versionIds.add(resourceVersionId);
      const record = getAriaResourceRecord(resourceId);
      const version = getAriaResourceVersion(resourceId, resourceVersionId);
      if (!record || !version
        || (corpus.corpus_id === requestedCorpusId
          && !record.placements.some((placement) => placement.courseKey === courseKey))
        || record.status !== 'ACTIVE'
        || !isAriaResourceRagCitable(record.visibility)
        || version.status !== 'ACTIVE'
        || version.contentSha256 !== resource.content_sha256) {
        return 'RESOURCE_VERSION_BINDING_MISMATCH';
      }
      const chunkIds = new Set<string>();
      for (const chunk of resource.chunks as JsonRecord[]) {
        const locator = chunk.locator as JsonRecord;
        if (!validateLocator(locator)) return 'SERVABLE_MANIFEST_INVALID';
        const chunkId = String(chunk.chunk_id);
        if (chunkIds.has(chunkId)) return 'SERVABLE_MANIFEST_INVALID';
        chunkIds.add(chunkId);
      }
    }
  }
  return null;
}

export function resolveAriaRagCorpusCapability(input: {
  readonly courseKey: string;
  readonly pedagogicalMode: AriaPedagogicalMode;
  readonly agentRole: string;
  readonly manifest: unknown | null;
  readonly expectedResourceRegistrySha256: string;
}): AriaRagCorpusCapability {
  const declaredCorpusId = resolveAriaCourseCorpusId({
    courseKey: input.courseKey,
    mode: input.pedagogicalMode,
    agentRole: input.agentRole,
  });
  if (!declaredCorpusId) {
    return { status: 'NOT_CONFIGURED', reasonCode: 'COURSE_HAS_NO_DECLARED_CORPUS' };
  }
  if (!input.manifest) {
    return { status: 'NOT_CONFIGURED', reasonCode: 'SERVABLE_MANIFEST_NOT_IMPORTED' };
  }
  if (!validateServableCorpusManifest(input.manifest)) {
    return { status: 'UNAVAILABLE', reasonCode: 'SERVABLE_MANIFEST_INVALID' };
  }

  const manifest = input.manifest as JsonRecord;
  const manifestSha256 = String(manifest.manifest_sha256);
  if (computeAriaServableManifestSha256(withoutManifestDigest(manifest)) !== manifestSha256) {
    return { status: 'UNAVAILABLE', reasonCode: 'SERVABLE_MANIFEST_DIGEST_MISMATCH' };
  }
  if (input.expectedResourceRegistrySha256 !== ARIA_RESOURCE_REGISTRY_SHA256
    || manifest.resource_registry_sha256 !== ARIA_RESOURCE_REGISTRY_SHA256
    || manifest.resource_registry_version !== ARIA_RESOURCE_REGISTRY_VERSION) {
    return { status: 'UNAVAILABLE', reasonCode: 'RESOURCE_REGISTRY_DIGEST_MISMATCH' };
  }
  const bindingError = validateCorpusBindings(manifest, input.courseKey, declaredCorpusId);
  if (bindingError) return { status: 'UNAVAILABLE', reasonCode: bindingError };

  const corpus = (manifest.corpora as JsonRecord[])
    .find((candidate) => candidate.corpus_id === declaredCorpusId);
  if (!corpus) return { status: 'UNAVAILABLE', reasonCode: 'DECLARED_CORPUS_NOT_SERVABLE' };
  const retrievalScope = corpus.retrieval_scope as JsonRecord;
  return Object.freeze({
    status: 'AVAILABLE' as const,
    corpus: Object.freeze({
      corpusId: String(corpus.corpus_id),
      corpusVersionId: String(corpus.corpus_version_id),
      physicalCollection: String(corpus.physical_collection),
      manifestSha256,
      resourceRegistrySha256: String(manifest.resource_registry_sha256),
      academicYear: String(corpus.academic_year),
      curriculumVersion: String(corpus.curriculum_version),
      retrievalScope: Object.freeze(retrievalScope),
      retrievalScopeSha256: sha256AriaRagJson(retrievalScope),
      resourceBindings: Object.freeze((corpus.resources as JsonRecord[]).map((resource) => Object.freeze({
        resourceId: String(resource.resource_id),
        resourceVersionId: String(resource.resource_version_id),
        contentSha256: String(resource.content_sha256),
        chunks: Object.freeze((resource.chunks as JsonRecord[]).map((chunk) => Object.freeze({
          chunkId: String(chunk.chunk_id),
          locator: locatorToDomain(chunk.locator as JsonRecord),
        }))),
      }))),
    }),
  });
}

export function getAriaRagCorpusCapability(
  courseKey: string,
  pedagogicalMode: AriaPedagogicalMode = 'DISCOVERY',
  agentRole: 'TUTOR' = 'TUTOR',
): AriaRagCorpusCapability {
  let manifest: unknown | null;
  try {
    manifest = configuredAriaServableManifest();
  } catch {
    return { status: 'UNAVAILABLE', reasonCode: 'RUNTIME_MANIFEST_CONFIGURATION_INVALID' };
  }
  return resolveAriaRagCorpusCapability({
    courseKey,
    pedagogicalMode,
    agentRole,
    manifest,
    expectedResourceRegistrySha256: ARIA_RESOURCE_REGISTRY_SHA256,
  });
}
