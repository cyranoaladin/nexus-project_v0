import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import type { AriaPedagogicalMode } from '../../domain/pedagogy/pedagogical-mode';
import { getAriaCourseCapabilityDeclaration } from '../../manifests/course-capabilities';

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const boundedIdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/);
const locatorSchema = z.object({
  chunk_index: z.number().int().nonnegative().nullable().optional(),
  page: z.number().int().positive().nullable().optional(),
  page_start: z.number().int().positive().nullable().optional(),
  page_end: z.number().int().positive().nullable().optional(),
  section: z.string().min(1).max(200).nullable().optional(),
  start_char: z.number().int().nonnegative().nullable().optional(),
  end_char: z.number().int().positive().nullable().optional(),
}).strict().refine((locator) => Object.values(locator).some((value) => value !== null && value !== undefined));

const corpusSchema = z.object({
  corpus_id: boundedIdSchema,
  corpus_version_id: boundedIdSchema,
  academic_year: z.string().regex(/^\d{4}-\d{4}$/),
  curriculum_version: boundedIdSchema,
  physical_collection: z.string().min(1).max(128).regex(/^[a-z0-9_]+$/),
  scope_id: boundedIdSchema,
  scope_sha256: digestSchema,
  resources: z.array(z.object({
    resource_id: z.string().uuid(),
    resource_version_id: z.string().uuid(),
    content_sha256: digestSchema,
    chunks: z.array(z.object({
      chunk_id: z.string().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/),
      locator: locatorSchema,
    }).strict()).min(1),
  }).strict()).min(1),
}).strict();

const manifestSchema = z.object({
  protocol_version: z.literal('1'),
  manifest_version: boundedIdSchema,
  resource_registry_version: boundedIdSchema,
  resource_registry_sha256: digestSchema,
  producer_repository: z.string().min(3).max(200).regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  producer_commit: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
  generated_at: z.string().datetime({ offset: true }),
  corpora: z.array(corpusSchema).min(1),
  manifest_sha256: digestSchema,
}).strict();

export type AriaServableCorpusManifest = z.infer<typeof manifestSchema>;
export type AriaServableCorpusManifestPayload = Omit<AriaServableCorpusManifest, 'manifest_sha256'>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function computeAriaServableManifestSha256(
  payload: AriaServableCorpusManifestPayload,
): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
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

export function resolveAriaRagCorpusCapability(input: {
  readonly courseKey: string;
  readonly pedagogicalMode: AriaPedagogicalMode;
  readonly agentRole: 'TUTOR';
  readonly manifest: AriaServableCorpusManifest | null;
  readonly expectedResourceRegistrySha256: string;
}): AriaRagCorpusCapability {
  const declaration = getAriaCourseCapabilityDeclaration(input.courseKey);
  if (!declaration?.chat) {
    return { status: 'NOT_CONFIGURED', reasonCode: 'COURSE_HAS_NO_DECLARED_CORPUS' };
  }
  if (!input.manifest) {
    return { status: 'NOT_CONFIGURED', reasonCode: 'SERVABLE_MANIFEST_NOT_IMPORTED' };
  }

  const parsed = manifestSchema.safeParse(input.manifest);
  if (!parsed.success) return { status: 'UNAVAILABLE', reasonCode: 'SERVABLE_MANIFEST_INVALID' };
  const { manifest_sha256: manifestSha256, ...payload } = parsed.data;
  if (computeAriaServableManifestSha256(payload) !== manifestSha256) {
    return { status: 'UNAVAILABLE', reasonCode: 'SERVABLE_MANIFEST_DIGEST_MISMATCH' };
  }
  if (parsed.data.resource_registry_sha256 !== input.expectedResourceRegistrySha256) {
    return { status: 'UNAVAILABLE', reasonCode: 'RESOURCE_REGISTRY_DIGEST_MISMATCH' };
  }
  const corpus = parsed.data.corpora.find((candidate) => candidate.corpus_id === declaration.chat?.corpusId);
  if (!corpus) return { status: 'UNAVAILABLE', reasonCode: 'DECLARED_CORPUS_NOT_SERVABLE' };
  return Object.freeze({
    status: 'AVAILABLE' as const,
    corpus: Object.freeze({
      corpusId: corpus.corpus_id,
      corpusVersionId: corpus.corpus_version_id,
      physicalCollection: corpus.physical_collection,
      manifestSha256,
      resourceRegistrySha256: parsed.data.resource_registry_sha256,
      academicYear: corpus.academic_year,
      curriculumVersion: corpus.curriculum_version,
      resourceBindings: Object.freeze(corpus.resources.map((resource) => Object.freeze({
        resourceId: resource.resource_id,
        resourceVersionId: resource.resource_version_id,
        contentSha256: resource.content_sha256,
        chunks: Object.freeze(resource.chunks.map((chunk) => Object.freeze({
          chunkId: chunk.chunk_id,
          locator: Object.freeze(Object.fromEntries(
            Object.entries(chunk.locator)
              .filter((entry): entry is [string, string | number] =>
                typeof entry[1] === 'string' || typeof entry[1] === 'number'),
          )),
        }))),
      }))),
    }),
  });
}

export function getAriaRagCorpusCapability(
  courseKey: string,
  pedagogicalMode: AriaPedagogicalMode = 'DISCOVERY',
  agentRole: 'TUTOR' = 'TUTOR',
  env: NodeJS.ProcessEnv = process.env,
): AriaRagCorpusCapability {
  const manifestPath = env.ARIA_RAG_SERVABLE_MANIFEST_PATH?.trim();
  const expectedManifestSha256 = env.ARIA_RAG_SERVABLE_MANIFEST_SHA256?.trim();
  const expectedRegistrySha256 = env.ARIA_RESOURCE_REGISTRY_SHA256?.trim();
  if (!manifestPath && !expectedManifestSha256 && !expectedRegistrySha256) {
    return resolveAriaRagCorpusCapability({
      courseKey, pedagogicalMode, agentRole, manifest: null,
      expectedResourceRegistrySha256: '',
    });
  }
  if (!manifestPath || !isAbsolute(manifestPath)
    || !expectedManifestSha256 || !digestSchema.safeParse(expectedManifestSha256).success
    || !expectedRegistrySha256 || !digestSchema.safeParse(expectedRegistrySha256).success) {
    return { status: 'UNAVAILABLE', reasonCode: 'SERVABLE_MANIFEST_CONFIGURATION_INVALID' };
  }
  try {
    const parsed = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
    if (parsed.manifest_sha256 !== expectedManifestSha256) {
      return { status: 'UNAVAILABLE', reasonCode: 'SERVABLE_MANIFEST_PIN_MISMATCH' };
    }
    return resolveAriaRagCorpusCapability({
      courseKey,
      pedagogicalMode,
      agentRole,
      manifest: parsed,
      expectedResourceRegistrySha256: expectedRegistrySha256,
    });
  } catch {
    return { status: 'UNAVAILABLE', reasonCode: 'SERVABLE_MANIFEST_LOAD_FAILED' };
  }
}
